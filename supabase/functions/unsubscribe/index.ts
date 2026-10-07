// The unsubscribe link in every email. Opening it (or an email app's one-click
// unsubscribe, which POSTs to it) turns email off for that type, or for all
// types. No login is needed, so it checks the link's signature instead.
//
// It answers in plain text: Supabase does not display HTML pages from Edge
// Functions on its default address.
import { requireEnv } from '../_shared/http.ts';
import { serviceClient } from '../_shared/clients.ts';
import { verifyUnsubscribe } from '../_shared/unsubscribe.ts';

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') return text('Use GET or POST.', 405);
  const params = new URL(req.url).searchParams;
  const user = params.get('u') ?? '';
  const type = params.get('t') ?? '';
  const signature = params.get('s') ?? '';

  const valid = /^[0-9a-f-]{36}$/i.test(user) && (await verifyUnsubscribe(requireEnv('UNSUBSCRIBE_SECRET'), user, type, signature));
  if (!valid) return text('This unsubscribe link is not valid.', 400);

  const { error } = await serviceClient().rpc('unsubscribe_email', { p_user_id: user, p_type: type });
  if (error) {
    console.error('unsubscribe failed', error);
    return text('Something went wrong. Please try again.', 500);
  }
  return text(
    type === 'all'
      ? 'You are unsubscribed from all Cats or Dogs? emails. You can change this any time in the app\'s notification settings.'
      : 'You are unsubscribed from these Cats or Dogs? emails. You can change this any time in the app\'s notification settings.',
  );
});
