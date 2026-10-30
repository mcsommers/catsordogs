import { supabase } from './supabase';

export { hasMatchesTabAlert } from './matchesTabAlert';
import type { FeedMatchState } from './feed';

export type FollowState = {
  following: boolean;
  canNudge: boolean;
  alreadyNudged: boolean;
  acceptsFollowers: boolean;
};

export type MatchStateDetail = {
  state: FeedMatchState;
  matchId: string | null;
  answerId: string | null;
  questionText: string | null;
  requestedAt: string | null;
  photoPath: string | null;
};

export type IncomingMatchRequest = {
  userId: string;
  firstName: string;
  gender: string | null;
  age: number;
  photoPath: string | null;
  answerId: string | null;
  questionText: string | null;
  questionDate: string | null;
  requestedAt: string;
};

export type OutgoingMatchRequest = {
  userId: string;
  firstName: string;
  gender: string | null;
  age: number;
  photoPath: string | null;
  requestedAt: string;
};

export type ConversationSummary = {
  matchId: string;
  userId: string;
  firstName: string;
  age: number;
  photoPath: string | null;
  city: string | null;
  matchedAt: string;
  lastMessageBody: string | null;
  lastMessageKind: string | null;
  lastMessageAt: string | null;
  lastMessageIsMine: boolean;
  muted: boolean;
  unreadCount: number;
  /** True when the other person unmatched. History stays; sending does not. */
  closed: boolean;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  kind: string;
  body: string;
  createdAt: string;
};

export type BlockedOrNotInterestedRow = {
  kind: 'blocked' | 'not_interested';
  userId: string;
  firstName: string;
  age: number;
  photoPath: string | null;
  createdAt: string;
};

export type NotificationPreference = {
  type: 'daily_question' | 'matches' | 'messages' | 'nudges';
  pushEnabled: boolean;
  emailEnabled: boolean;
};

function row<T>(data: T[] | null | undefined): T | undefined {
  return (data ?? [])[0];
}

export async function followUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('follow_user', { p_user_id: userId });
  if (error) throw error;
}

export async function unfollowUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('unfollow_user', { p_user_id: userId });
  if (error) throw error;
}

export type FollowedPerson = {
  userId: string;
  firstName: string;
  age: number;
  gender: string | null;
  photoPath: string | null;
  followedAt: string;
};

export async function getPeopleIFollow(): Promise<FollowedPerson[]> {
  const { data, error } = await supabase.rpc('get_people_i_follow');
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>) => ({
    userId: String(r.user_id),
    firstName: String(r.first_name ?? ''),
    age: Number(r.age) || 0,
    gender: r.gender ? String(r.gender) : null,
    photoPath: r.photo_path ? String(r.photo_path) : null,
    followedAt: String(r.followed_at ?? ''),
  }));
}

export async function getFollowState(userId: string): Promise<FollowState> {
  const { data, error } = await supabase.rpc('get_follow_state', { p_user_id: userId });
  if (error) throw error;
  const r = row(data as Record<string, unknown>[]);
  return {
    following: Boolean(r?.following),
    canNudge: Boolean(r?.can_nudge),
    alreadyNudged: Boolean(r?.already_nudged),
    acceptsFollowers: r?.accepts_followers !== false,
  };
}

export async function nudgeUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('nudge_user', { p_user_id: userId });
  if (error) throw error;
}

export async function blockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('block_user', { p_user_id: userId });
  if (error) throw error;
}

export async function unblockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('unblock_user', { p_user_id: userId });
  if (error) throw error;
}

export async function markNotInterested(userId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_not_interested', { p_user_id: userId });
  if (error) throw error;
}

export async function undoNotInterested(userId: string): Promise<void> {
  const { error } = await supabase.rpc('undo_not_interested', { p_user_id: userId });
  if (error) throw error;
}

export async function listBlockedAndNotInterested(): Promise<BlockedOrNotInterestedRow[]> {
  const { data, error } = await supabase.rpc('list_blocked_and_not_interested');
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>) => ({
    kind: String(r.kind) as 'blocked' | 'not_interested',
    userId: String(r.user_id),
    firstName: String(r.first_name ?? ''),
    age: Number(r.age) || 0,
    photoPath: r.photo_path ? String(r.photo_path) : null,
    createdAt: String(r.created_at),
  }));
}

export async function flagAnswer(answerId: string): Promise<string> {
  const { data, error } = await supabase.rpc('flag_answer', { p_answer_id: answerId });
  if (error) throw error;
  return String(data ?? 'flagged');
}

export async function reportProfile(userId: string): Promise<string> {
  const { data, error } = await supabase.rpc('report_profile', { p_user_id: userId });
  if (error) throw error;
  return String(data ?? 'reported');
}

export async function reportMessage(messageId: string): Promise<string> {
  const { data, error } = await supabase.rpc('report_message', { p_message_id: messageId });
  if (error) throw error;
  return String(data ?? 'reported');
}

export async function sendMatchRequest(userId: string, answerId?: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('send_match_request', {
    p_user_id: userId,
    p_answer_id: answerId ?? null,
  });
  if (error) throw error;
  return String(data ?? 'sent');
}

export async function cancelMatchRequest(userId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_match_request', { p_user_id: userId });
  if (error) throw error;
}

export async function acceptMatchRequest(userId: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_match_request', { p_user_id: userId });
  if (error) throw error;
  return String(data ?? '');
}

export async function declineMatchRequest(userId: string): Promise<void> {
  const { error } = await supabase.rpc('decline_match_request', { p_user_id: userId });
  if (error) throw error;
}

export async function getMatchState(userId: string): Promise<MatchStateDetail> {
  const { data, error } = await supabase.rpc('get_match_state', { p_user_id: userId });
  if (error) throw error;
  const r = row(data as Record<string, unknown>[]);
  return {
    state: (String(r?.state ?? 'none') as FeedMatchState) || 'none',
    matchId: r?.match_id ? String(r.match_id) : null,
    answerId: r?.answer_id ? String(r.answer_id) : null,
    questionText: r?.question_text ? String(r.question_text) : null,
    requestedAt: r?.requested_at ? String(r.requested_at) : null,
    photoPath: r?.photo_path ? String(r.photo_path) : null,
  };
}

export async function getIncomingMatchRequests(): Promise<IncomingMatchRequest[]> {
  const { data, error } = await supabase.rpc('get_incoming_match_requests');
  if (error) throw error;
  return (data ?? []).map(mapIncoming);
}

export async function getOutgoingMatchRequests(): Promise<OutgoingMatchRequest[]> {
  const { data, error } = await supabase.rpc('get_outgoing_match_requests');
  if (error) throw error;
  return (data ?? []).map(mapOutgoing);
}

function mapIncoming(r: Record<string, unknown>): IncomingMatchRequest {
  return {
    userId: String(r.user_id),
    firstName: String(r.first_name ?? ''),
    gender: r.gender ? String(r.gender) : null,
    age: Number(r.age) || 0,
    photoPath: r.photo_path ? String(r.photo_path) : null,
    answerId: r.answer_id ? String(r.answer_id) : null,
    questionText: r.question_text ? String(r.question_text) : null,
    questionDate: r.question_date ? String(r.question_date) : null,
    requestedAt: String(r.requested_at),
  };
}

function mapOutgoing(r: Record<string, unknown>): OutgoingMatchRequest {
  return {
    userId: String(r.user_id),
    firstName: String(r.first_name ?? ''),
    gender: r.gender ? String(r.gender) : null,
    age: Number(r.age) || 0,
    photoPath: r.photo_path ? String(r.photo_path) : null,
    requestedAt: String(r.requested_at),
  };
}

export async function getConversations(): Promise<ConversationSummary[]> {
  const { data, error } = await supabase.rpc('get_conversations');
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>) => ({
    matchId: String(r.match_id),
    userId: String(r.user_id),
    firstName: String(r.first_name ?? ''),
    age: Number(r.age) || 0,
    photoPath: r.photo_path ? String(r.photo_path) : null,
    city: r.city ? String(r.city) : null,
    matchedAt: String(r.matched_at),
    lastMessageBody: r.last_message_body != null ? String(r.last_message_body) : null,
    lastMessageKind: r.last_message_kind != null ? String(r.last_message_kind) : null,
    lastMessageAt: r.last_message_at != null ? String(r.last_message_at) : null,
    lastMessageIsMine: Boolean(r.last_message_is_mine),
    muted: Boolean(r.muted),
    unreadCount: Number(r.unread_count) || 0,
    closed: Boolean(r.closed),
  }));
}

export async function markConversationRead(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_conversation_read', { p_match_id: matchId });
  if (error) throw error;
}

export async function getMessages(matchId: string, before?: string | null, limit = 50): Promise<ChatMessage[]> {
  const { data, error } = await supabase.rpc('get_messages', {
    p_match_id: matchId,
    p_before: before ?? null,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    senderId: String(r.sender_id),
    kind: String(r.kind),
    body: String(r.body ?? ''),
    createdAt: String(r.created_at),
  }));
}

export async function sendMessage(matchId: string, body: string): Promise<{ id: string; createdAt: string }> {
  const { data, error } = await supabase.rpc('send_message', { p_match_id: matchId, p_body: body });
  if (error) throw error;
  const r = row(data as Record<string, unknown>[]);
  return { id: String(r?.id), createdAt: String(r?.created_at) };
}

export async function setConversationMuted(matchId: string, muted: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_conversation_muted', { p_match_id: matchId, p_muted: muted });
  if (error) throw error;
}

export async function unmatchUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('unmatch_user', { p_user_id: userId });
  if (error) throw error;
}

/** RPC only; prefer `deleteAccountFully` which also removes Mux assets and storage. */
export async function deleteAccountRpc(): Promise<void> {
  const { error } = await supabase.rpc('delete_account');
  if (error) throw error;
}

export async function deleteAccountFully(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
}

export async function getNotificationPreferences(): Promise<NotificationPreference[]> {
  const { data, error } = await supabase.rpc('get_notification_preferences');
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>) => ({
    type: String(r.type) as NotificationPreference['type'],
    pushEnabled: Boolean(r.push_enabled),
    emailEnabled: Boolean(r.email_enabled),
  }));
}

export async function setNotificationPreference(
  type: NotificationPreference['type'],
  channel: 'push' | 'email',
  enabled: boolean
): Promise<void> {
  const { error } = await supabase.rpc('set_notification_preference', {
    p_type: type,
    p_channel: channel,
    p_enabled: enabled,
  });
  if (error) throw error;
}

export async function registerDeviceToken(token: string, platform: 'ios' | 'android'): Promise<void> {
  const { error } = await supabase.rpc('register_device_token', { p_token: token, p_platform: platform });
  if (error) throw error;
}

/** Tell the server you are viewing this chat (suppresses message push). Pass null when leaving. */
export async function setActiveChat(matchId: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_active_chat', { p_match_id: matchId });
  if (error) throw error;
}
