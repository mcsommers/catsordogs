// Marketing site: deliver a support form submission to the support inbox.
// Called from the database via pg_net (see private.dispatch_website_support_inquiry).
import { json, requireEnv } from '../_shared/http.ts';

const SUPPORT_INBOX = 'catsordogsapp+support@gmail.com';

function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function sendSupportEmail(fromEmail: string, message: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('Email is not configured (RESEND_API_KEY is missing).');
  const text = `From: ${fromEmail}\n\n${message}`;
  const res = await fetch(`${Deno.env.get('RESEND_BASE_URL') || 'https://api.resend.com'}/emails`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM') || 'Cats or Dogs? <noreply@catsordogs.net>',
      to: [SUPPORT_INBOX],
      reply_to: fromEmail,
      subject: 'Website support inquiry',
      text,
      html: `<p><strong>From:</strong> ${escapeHtml(fromEmail)}</p><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend failed with status ${res.status}.`);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!sameSecret(req.headers.get('x-worker-secret') ?? '', requireEnv('NOTIFICATION_WORKER_SECRET'))) {
    return json({ error: 'Not allowed.' }, 401);
  }

  let inquiryEmail = '';
  let inquiryMessage = '';
  try {
    const body = await req.json();
    inquiryEmail = typeof body?.inquiry_email === 'string' ? body.inquiry_email.trim() : '';
    inquiryMessage = typeof body?.inquiry_message === 'string' ? body.inquiry_message.trim() : '';
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  if (!isValidEmail(inquiryEmail)) return json({ error: 'Invalid inquiry_email.' }, 400);
  if (inquiryMessage.length < 10 || inquiryMessage.length > 4000) {
    return json({ error: 'Invalid inquiry_message.' }, 400);
  }

  try {
    await sendSupportEmail(inquiryEmail, inquiryMessage);
    return json({ ok: true });
  } catch (e) {
    console.error('website-support-inquiry failed', e);
    return json({ error: 'Could not send email.' }, 500);
  }
});
