const APP_SCHEME = 'catsordogs';

export type AppDeepLinkTarget =
  | { screen: '/feed' }
  | { screen: '/matches'; segment: 'chats' | 'incoming' | 'outgoing' }
  | { screen: '/notifications' }
  | { screen: '/chat/[matchId]'; matchId: string };

/** Parses in-app deep links from email (catsordogs://…). Returns null for auth and unknown URLs. */
export function parseAppDeepLink(url: string | null | undefined): AppDeepLinkTarget | null {
  if (!url) return null;
  const prefix = `${APP_SCHEME}://`;
  if (!url.startsWith(prefix)) return null;
  const rest = url.slice(prefix.length).split('#')[0] ?? '';
  if (rest.startsWith('auth-callback')) return null;

  const qIndex = rest.indexOf('?');
  const pathPart = (qIndex >= 0 ? rest.slice(0, qIndex) : rest).replace(/\/$/, '');
  const query = qIndex >= 0 ? rest.slice(qIndex + 1) : '';
  const params = new URLSearchParams(query);

  if (pathPart === 'feed' || pathPart === '') return { screen: '/feed' };
  if (pathPart === 'notifications') return { screen: '/notifications' };
  if (pathPart === 'matches') {
    const segment = params.get('segment');
    if (segment === 'incoming' || segment === 'outgoing' || segment === 'chats') {
      return { screen: '/matches', segment };
    }
    return { screen: '/matches', segment: 'chats' };
  }
  if (pathPart.startsWith('chat/')) {
    const matchId = pathPart.slice('chat/'.length);
    if (matchId) return { screen: '/chat/[matchId]', matchId };
  }
  return null;
}

export function hrefForAppDeepLink(target: AppDeepLinkTarget): string {
  switch (target.screen) {
    case '/feed':
      return '/feed';
    case '/notifications':
      return '/notifications';
    case '/matches':
      return `/matches?segment=${target.segment}`;
    case '/chat/[matchId]':
      return `/chat/${target.matchId}`;
    default:
      return '/feed';
  }
}
