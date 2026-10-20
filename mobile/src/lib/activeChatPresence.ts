/** In-memory match id for foreground notification suppression (pairs with server active_chat_sessions). */

let localActiveMatchId: string | null = null;

export function setLocalActiveChatMatchId(matchId: string | null): void {
  localActiveMatchId = matchId;
}

export function getLocalActiveChatMatchId(): string | null {
  return localActiveMatchId;
}
