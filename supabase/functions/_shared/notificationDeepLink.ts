/** HTTPS app paths for notification email and universal links (same on iOS and Android). */

export function websiteOriginFromEnv(): string {
  const raw =
    Deno.env.get('PUBLIC_WEBSITE_URL') ??
    Deno.env.get('EXPO_PUBLIC_WEBSITE_URL') ??
    'https://catsordogs.net';
  const trimmed = raw.trim().replace(/\/$/, '');
  if (!trimmed.startsWith('https://')) {
    throw new Error('PUBLIC_WEBSITE_URL must be an https origin.');
  }
  return trimmed;
}

export function notificationOpenPath(kind: string, data: Record<string, unknown>): string | null {
  switch (kind) {
    case 'daily_question':
    case 'nudge':
      return '/question';
    case 'match_request': {
      const senderId = data.sender_id;
      return typeof senderId === 'string' && senderId.length > 0 ? `/user/${senderId}` : '/matches';
    }
    case 'match': {
      const matchId = data.match_id;
      return typeof matchId === 'string' && matchId.length > 0 ? `/chat/${matchId}` : '/matches';
    }
    case 'message': {
      const matchId = data.match_id;
      return typeof matchId === 'string' && matchId.length > 0 ? `/chat/${matchId}` : '/matches';
    }
    default:
      return null;
  }
}

export function notificationOpenUrl(origin: string, kind: string, data: Record<string, unknown>): string | null {
  const path = notificationOpenPath(kind, data);
  if (!path) return null;
  return `${origin.replace(/\/$/, '')}${path}`;
}
