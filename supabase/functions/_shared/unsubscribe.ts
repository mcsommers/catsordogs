// Signed email unsubscribe links. The link carries the person, the type (or
// "all"), and a signature only we can make, so nobody can unsubscribe someone
// else by guessing. Plain TypeScript with no imports so it can be tested with
// Node and run in the Edge Functions.

export const NOTIFICATION_TYPES = ['daily_question', 'matches', 'messages', 'nudges'] as const;

/** Labels match notification settings (08c) in the mobile app. */
export const NOTIFICATION_EMAIL_LABELS: Record<(typeof NOTIFICATION_TYPES)[number], string> = {
  daily_question: 'Daily question',
  matches: 'Matches',
  messages: 'Messages',
  nudges: 'Nudges',
};

/** HTTPS path on the marketing site; opens 08c in the installed app (universal link). */
export const NOTIFICATION_SETTINGS_WEB_PATH = '/notifications';

/** Browser landing page after a successful GET unsubscribe (rendered on catsordogs.net). */
export const EMAIL_UNSUBSCRIBED_WEB_PATH = '/email-unsubscribed';

export function emailUnsubscribedLandingUrl(siteOrigin: string, type: string): string {
  const base = siteOrigin.replace(/\/$/, '');
  return `${base}${EMAIL_UNSUBSCRIBED_WEB_PATH}?type=${encodeURIComponent(type)}`;
}

export function unsubscribeLeadSentence(type: string): string {
  if (type === 'all') {
    return 'You are unsubscribed from all Cats or Dogs? notification emails.';
  }
  const label = (NOTIFICATION_EMAIL_LABELS as Record<string, string>)[type];
  if (!label) {
    return 'You are unsubscribed from these Cats or Dogs? emails.';
  }
  return `You are unsubscribed from Cats or Dogs? emails regarding ${label}.`;
}

/** Plain-text body after a successful email unsubscribe (Edge Function response). */
export function unsubscribeConfirmationMessage(type: string, settingsHttpsUrl?: string): string {
  const lead = unsubscribeLeadSentence(type);
  if (!settingsHttpsUrl) {
    return `${lead} You can change this any time in the app's notification settings.`;
  }
  return `${lead} You can change this any time in the app's notification settings: ${settingsHttpsUrl}`;
}

async function sign(secret: string, user: string, type: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${user}.${type}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function unsubscribeUrl(baseUrl: string, secret: string, user: string, type: string): Promise<string> {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/unsubscribe`);
  url.searchParams.set('u', user);
  url.searchParams.set('t', type);
  url.searchParams.set('s', await sign(secret, user, type));
  return url.toString();
}

export async function verifyUnsubscribe(secret: string, user: string, type: string, signature: string): Promise<boolean> {
  if (type !== 'all' && !(NOTIFICATION_TYPES as readonly string[]).includes(type)) return false;
  const expected = await sign(secret, user, type);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
