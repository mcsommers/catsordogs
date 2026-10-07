// The notification worker. The database wakes it every minute (see the README,
// "Notifications"). It asks the database for due notifications (which have
// already applied each person's push/email preferences), sends them by Expo
// push and Resend email, and reports back so failures are retried.
//
// Not callable by the app: it needs the shared secret in x-worker-secret.
import { json, requireEnv } from '../_shared/http.ts';
import { serviceClient } from '../_shared/clients.ts';
import { unsubscribeUrl } from '../_shared/unsubscribe.ts';

type Work = {
  id: string; user_id: string; type: string; title: string; body: string; data: Record<string, unknown>;
  email: string | null; push_tokens: string[]; send_push: boolean; send_email: boolean;
};

const BATCHES = 5;
const BATCH_SIZE = 50;

function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Returns how many phones accepted it. Phones Expo says no longer exist are removed.
async function sendPush(work: Work, db: ReturnType<typeof serviceClient>): Promise<number> {
  const res = await fetch(Deno.env.get('EXPO_PUSH_URL') || 'https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(Deno.env.get('EXPO_ACCESS_TOKEN') ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` } : {}),
    },
    body: JSON.stringify(work.push_tokens.map((to) => ({ to, title: work.title, body: work.body, data: { ...work.data, type: work.type }, sound: 'default' }))),
  });
  if (!res.ok) throw new Error(`Expo push failed with status ${res.status}.`);
  const tickets: { status: string; details?: { error?: string } }[] = (await res.json()).data ?? [];
  let accepted = 0;
  for (let i = 0; i < work.push_tokens.length; i++) {
    const ticket = tickets[i];
    if (ticket?.status === 'ok') accepted++;
    else if (ticket?.details?.error === 'DeviceNotRegistered') await db.rpc('remove_device_token', { p_token: work.push_tokens[i] });
  }
  if (accepted === 0) throw new Error('Expo accepted none of the push messages.');
  return accepted;
}

async function sendEmail(work: Work): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('Email is not configured (RESEND_API_KEY is missing).');
  const base = Deno.env.get('PUBLIC_FUNCTIONS_URL') || `${requireEnv('SUPABASE_URL')}/functions/v1`;
  const link = await unsubscribeUrl(base, requireEnv('UNSUBSCRIBE_SECRET'), work.user_id, work.type);
  const res = await fetch(`${Deno.env.get('RESEND_BASE_URL') || 'https://api.resend.com'}/emails`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM') || 'Cats or Dogs? <noreply@catsordogs.net>',
      to: [work.email],
      subject: work.title,
      text: `${work.body}\n\nYou can turn these emails off any time: ${link}`,
      html: `<p>${escapeHtml(work.body)}</p><p style="color:#888;font-size:12px"><a href="${escapeHtml(link)}">Unsubscribe from these emails</a></p>`,
      headers: { 'List-Unsubscribe': `<${link}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }),
  });
  if (!res.ok) throw new Error(`Resend failed with status ${res.status}.`);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!sameSecret(req.headers.get('x-worker-secret') ?? '', requireEnv('NOTIFICATION_WORKER_SECRET'))) {
    return json({ error: 'Not allowed.' }, 401);
  }

  const db = serviceClient();
  let sent = 0;
  let failed = 0;
  for (let batch = 0; batch < BATCHES; batch++) {
    const { data, error } = await db.rpc('claim_notifications', { p_limit: BATCH_SIZE });
    if (error) {
      console.error('claim failed', error);
      return json({ error: 'Could not read the queue.' }, 500);
    }
    const rows = (data ?? []) as Work[];
    for (const work of rows) {
      const problems: string[] = [];
      let delivered = false;
      if (work.send_push) {
        try { await sendPush(work, db); delivered = true; } catch (e) { problems.push(String((e as Error).message)); }
      }
      if (work.send_email) {
        try { await sendEmail(work); delivered = true; } catch (e) { problems.push(String((e as Error).message)); }
      }
      // Delivered on at least one channel counts as sent, so a failing email
      // never causes the same push to be sent again.
      await db.rpc('complete_notification', { p_id: work.id, p_ok: delivered, p_error: delivered ? null : problems.join(' | ') });
      if (delivered) sent++; else { failed++; console.error('notification failed', work.id, problems); }
    }
    if (rows.length < BATCH_SIZE) break;
  }
  return json({ sent, failed });
});
