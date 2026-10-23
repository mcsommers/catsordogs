import type { ImperativeRouter } from 'expo-router';

type NotificationPayload = {
  kind?: string;
  type?: string;
  match_id?: string;
  sender_id?: string;
};

/** Navigate after a push tap or a universal link (paths match notification email links). */
export function navigateFromNotificationPayload(
  router: ImperativeRouter,
  raw: Record<string, unknown> | undefined
): boolean {
  if (!raw) return false;
  const data = raw as NotificationPayload;
  const kind = typeof data.kind === 'string' ? data.kind : undefined;

  if (kind === 'daily_question' || kind === 'nudge') {
    router.push('/question');
    return true;
  }
  if (kind === 'match_request' && typeof data.sender_id === 'string') {
    router.push(`/user/${data.sender_id}`);
    return true;
  }
  if ((kind === 'match' || kind === 'message') && typeof data.match_id === 'string') {
    router.push(kind === 'match' ? `/chat/${data.match_id}?justMatched=1` : `/chat/${data.match_id}`);
    return true;
  }
  return false;
}
