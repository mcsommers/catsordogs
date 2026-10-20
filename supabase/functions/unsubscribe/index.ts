// The unsubscribe link in every email. Opening it (or an email app's one-click
// unsubscribe, which POSTs to it) turns email off for that type, or for all
// types. No login is needed, so it checks the link's signature instead.
//
// GET redirects to the marketing site (HTML renders correctly; Supabase function
// URLs often show raw HTML in the browser). POST returns plain text for one-click
// unsubscribe in mail clients.
import { requireEnv } from '../_shared/http.ts';
import { serviceClient } from '../_shared/clients.ts';
import { websiteOriginFromEnv } from '../_shared/notificationDeepLink.ts';
import {
  NOTIFICATION_SETTINGS_WEB_PATH,
  emailUnsubscribedLandingUrl,
  unsubscribeConfirmationMessage,
  verifyUnsubscribe,
} from '../_shared/unsubscribe.ts';

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

function notificationSettingsUrl(): string {
  return `${websiteOriginFromEnv()}${NOTIFICATION_SETTINGS_WEB_PATH}`;
}

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

  const settingsUrl = notificationSettingsUrl();
  if (req.method === 'POST') {
    return text(unsubscribeConfirmationMessage(type, settingsUrl));
  }
  return Response.redirect(emailUnsubscribedLandingUrl(websiteOriginFromEnv(), type), 302);
});
