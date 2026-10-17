/** Which Matches segment to open when the orange heart (06u) is tapped. */
export type MatchesAlertLanding = 'chats' | 'incoming';

/**
 * Chats wins when both are waiting, because an unread peer message is the
 * higher-priority new item. Null means the heart is not lit.
 */
export function matchesAlertLanding(
  incoming: readonly unknown[],
  conversations: readonly { unreadCount: number }[]
): MatchesAlertLanding | null {
  if (conversations.some((c) => c.unreadCount > 0)) return 'chats';
  if (incoming.length > 0) return 'incoming';
  return null;
}

/** Orange Matches tab heart (06u): incoming requests or unread peer chat messages. */
export function hasMatchesTabAlert(
  incoming: readonly unknown[],
  conversations: readonly { unreadCount: number }[]
): boolean {
  return matchesAlertLanding(incoming, conversations) !== null;
}
