import type { ImperativeRouter } from 'expo-router';

type NotificationPayload = {
  kind?: string;
  type?: string;
  match_id?: string;
  sender_id?: string;
};

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Expo Router can pass the same query key as a string or a one-item array. */
export function firstRouteParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Path to open from a notification email, https app link, custom scheme, or Android intent URL.
 * `catsordogs://user/{id}` puts the screen name in the hostname; intent:// URLs keep /user/{id} in the string.
 */
export function pathFromNotificationUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const deep = url.match(new RegExp(`/(user|chat)/(${UUID})`, 'i'));
  if (deep) return `/${deep[1].toLowerCase()}/${deep[2].toLowerCase()}`;

  const named = url.match(/(?:catsordogs:\/\/|catsordogs\.net\/)(question|matches|notifications)\b/i);
  if (named) return `/${named[1].toLowerCase()}`;
  return null;
}

export function pushAppPath(router: ImperativeRouter, href: string): boolean {
  const user = href.match(new RegExp(`^/user/(${UUID})`, 'i'));
  if (user) {
    router.push({ pathname: '/user/[id]', params: { id: user[1] } });
    return true;
  }
  const chat = href.match(new RegExp(`^/chat/(${UUID})`, 'i'));
  if (chat) {
    const justMatched = href.includes('justMatched=1');
    router.push({
      pathname: '/chat/[matchId]',
      params: justMatched ? { matchId: chat[1], justMatched: '1' } : { matchId: chat[1] },
    });
    return true;
  }
  if (href === '/question' || href === '/matches' || href === '/notifications') {
    router.push(href);
    return true;
  }
  return false;
}

/** Navigate after a push tap or a universal link (paths match notification email links). */
export function navigateFromNotificationPayload(
  router: ImperativeRouter,
  raw: Record<string, unknown> | undefined
): boolean {
  if (!raw) return false;
  const data = raw as NotificationPayload;
  const kind = typeof data.kind === 'string' ? data.kind : undefined;

  if (kind === 'daily_question' || kind === 'nudge') {
    return pushAppPath(router, '/question');
  }
  if (kind === 'match_request' && typeof data.sender_id === 'string') {
    return pushAppPath(router, `/user/${data.sender_id}`);
  }
  if ((kind === 'match' || kind === 'message') && typeof data.match_id === 'string') {
    return pushAppPath(
      router,
      kind === 'match' ? `/chat/${data.match_id}?justMatched=1` : `/chat/${data.match_id}`,
    );
  }
  return false;
}
