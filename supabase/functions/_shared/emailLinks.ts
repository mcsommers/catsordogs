// Deep links into the mobile app (catsordogs://…). Kept in plain TypeScript so
// Node tests and Edge Functions can share it.

const DEFAULT_SCHEME = 'catsordogs';

function scheme(): string {
  return (typeof Deno !== 'undefined' ? Deno.env.get('MOBILE_APP_SCHEME') : process.env.MOBILE_APP_SCHEME) ||
    DEFAULT_SCHEME;
}

export function appDeepLink(path: string, query?: Record<string, string>): string {
  const base = `${scheme()}://${path.replace(/^\//, '')}`;
  if (!query || Object.keys(query).length === 0) return base;
  const url = new URL(base);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

/** Where "Open the app" goes for each notification email type. */
export function openAppUrlForNotification(type: string, data: Record<string, unknown>): string {
  switch (type) {
    case 'daily_question':
    case 'nudges':
      return appDeepLink('feed');
    case 'matches':
      return appDeepLink('matches', { segment: 'incoming' });
    case 'messages': {
      const matchId = data.match_id;
      if (typeof matchId === 'string' && matchId.length > 0) return appDeepLink(`chat/${matchId}`);
      return appDeepLink('matches', { segment: 'chats' });
    }
    case 'moderation':
      return appDeepLink('feed');
    default:
      return appDeepLink('feed');
  }
}

export function notificationSettingsAppUrl(): string {
  return appDeepLink('notifications');
}
