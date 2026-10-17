// Pre-launch: send one operational email when the marketing site gets a new signup.
// Called from the database via pg_net (see private.dispatch_website_launch_signup_alert).
import { json, requireEnv } from '../_shared/http.ts';

const OWNER_EMAIL = 'mikesommers@gmail.com';

function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function sendOwnerEmail(signupEmail: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('Email is not configured (RESEND_API_KEY is missing).');
  const body =
    `Email address: ${signupEmail}\n\nThey asked to be notified when the Cats or Dogs? app launches.`;
  const res = await fetch(`${Deno.env.get('RESEND_BASE_URL') || 'https://api.resend.com'}/emails`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM') || 'Cats or Dogs? <noreply@catsordogs.net>',
      to: [OWNER_EMAIL],
      subject: 'New website launch signup',
      text: body,
      html: `<p>${escapeHtml(body).replace(/\n/g, '<br>')}</p>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend failed with status ${res.status}.`);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!sameSecret(req.headers.get('x-worker-secret') ?? '', requireEnv('NOTIFICATION_WORKER_SECRET'))) {
    return json({ error: 'Not allowed.' }, 401);
  }

  let signupEmail = '';
  try {
    const body = await req.json();
    signupEmail = typeof body?.signup_email === 'string' ? body.signup_email.trim() : '';
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  if (!isValidEmail(signupEmail)) return json({ error: 'Invalid signup_email.' }, 400);

  try {
    await sendOwnerEmail(signupEmail);
    return json({ ok: true });
  } catch (e) {
    console.error('website-launch-signup-alert failed', e);
    return json({ error: 'Could not send email.' }, 500);
  }
});
