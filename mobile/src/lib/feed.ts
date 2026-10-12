import type { CaptionSegment } from './recording';
import { supabase } from './supabase';

export type FeedMatchState = 'none' | 'sent' | 'incoming' | 'matched';

export type FeedItem = {
  answerId: string;
  userId: string;
  questionId: string;
  questionDate: string;
  questionText: string;
  firstName: string;
  age: number;
  distanceMiles: number | null;
  captionText: string;
  captionSegments: CaptionSegment[];
  durationSeconds: number;
  isFollowed: boolean;
  submittedAt: string;
  streakDays: number;
  matchState: FeedMatchState;
};

export type BrowseQuestion = {
  questionId: string;
  questionDate: string;
  questionText: string;
  responseCount: number;
  isToday: boolean;
};

export type AppFeedConfig = {
  minWatchSeconds: number;
  feedLookbackDays: number;
};

type FeedRow = {
  answer_id: string;
  user_id: string;
  question_id: string;
  question_date: string;
  question_text: string;
  first_name: string;
  age: number;
  distance_miles: number | null;
  caption_text: string;
  caption_segments: CaptionSegment[] | null;
  duration_seconds: number;
  is_followed: boolean;
  submitted_at: string;
  streak_days: number;
  match_state: string;
  total_count: number;
};

function mapFeedRow(row: FeedRow): FeedItem {
  return {
    answerId: row.answer_id,
    userId: row.user_id,
    questionId: row.question_id,
    questionDate: row.question_date,
    questionText: row.question_text,
    firstName: row.first_name,
    age: row.age,
    distanceMiles: row.distance_miles,
    captionText: row.caption_text ?? '',
    captionSegments: Array.isArray(row.caption_segments) ? row.caption_segments : [],
    durationSeconds: Number(row.duration_seconds) || 0,
    isFollowed: row.is_followed,
    submittedAt: row.submitted_at,
    streakDays: row.streak_days ?? 0,
    matchState: (row.match_state as FeedMatchState) || 'none',
  };
}

export async function fetchFeedPage(offset: number, limit: number, questionDate?: string | null): Promise<{ items: FeedItem[]; totalCount: number }> {
  const { data, error } = await supabase.rpc('get_feed', {
    p_limit: limit,
    p_offset: offset,
    p_date: questionDate ?? null,
  });
  if (error) throw error;
  const rows = (data ?? []) as FeedRow[];
  const items = rows.map(mapFeedRow);
  const totalCount = rows[0]?.total_count != null ? Number(rows[0].total_count) : items.length;
  return { items, totalCount };
}

export async function fetchBrowseQuestions(query: string, offset: number, limit: number): Promise<{ items: BrowseQuestion[]; totalCount: number }> {
  const { data, error } = await supabase.rpc('browse_questions', {
    p_query: query.trim() || null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  const rows = data ?? [];
  const items = rows.map((r: Record<string, unknown>) => ({
    questionId: String(r.question_id),
    questionDate: String(r.question_date),
    questionText: String(r.question_text),
    responseCount: Number(r.response_count) || 0,
    isToday: Boolean(r.is_today),
  }));
  const totalCount = rows[0]?.total_count != null ? Number(rows[0].total_count) : items.length;
  return { items, totalCount };
}

export async function fetchAppFeedConfig(): Promise<AppFeedConfig> {
  const { data, error } = await supabase.rpc('get_app_config');
  if (error) throw error;
  const row = (data ?? [])[0];
  return {
    minWatchSeconds: row?.min_watch_seconds ?? 3,
    feedLookbackDays: row?.feed_lookback_days ?? 7,
  };
}

export type PlaybackUrls = { playbackUrl: string; thumbnailUrl: string };

export async function fetchPlaybackForAnswer(answerId: string): Promise<PlaybackUrls> {
  const { data, error } = await supabase.functions.invoke('get-playback-url', { body: { answer_id: answerId } });
  if (error) throw error;
  if (!data?.playback_url) throw new Error('That video is not available.');
  return { playbackUrl: data.playback_url, thumbnailUrl: data.thumbnail_url ?? '' };
}

/** Returns true when the view counted on the server. */
export async function reportAnswerView(answerId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('record_answer_view', { p_answer_id: answerId });
  if (error) throw error;
  return Boolean(data);
}
