// Signed email unsubscribe links. The link carries the person, the type (or
// "all"), and a signature only we can make, so nobody can unsubscribe someone
// else by guessing. Plain TypeScript with no imports so it can be tested with
// Node and run in the Edge Functions.

export const NOTIFICATION_TYPES = ['daily_question', 'matches', 'messages', 'nudges'] as const;

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
