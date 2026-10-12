import { supabase } from './supabase';
import type { UploadRefusal, VideoRow } from './recording';
import { uploadRefusal } from './recording';

export type GateState = 'profile_incomplete' | 'no_question_today' | 'not_answered' | 'open';

export type Gate = { state: GateState; questionId: string | null; questionText: string | null };

/** Reports the phone's IANA time zone so "today" for the gate follows local midnight. */
export async function syncDeviceTimeZone(): Promise<void> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!tz) return;
  const { error } = await supabase.rpc('set_time_zone', { p_time_zone: tz });
  if (error) throw error;
}

export async function getGate(): Promise<Gate> {
  const { data, error } = await supabase.rpc('get_gate_status');
  if (error) throw error;
  const row = (data ?? [])[0];
  return {
    state: (row?.state ?? 'no_question_today') as GateState,
    questionId: row?.question_id ?? null,
    questionText: row?.question_text ?? null,
  };
}

export async function getProfileCompleted(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('profile_completed_at').eq('id', userId).maybeSingle();
  if (error) throw error;
  return !!data?.profile_completed_at;
}

/**
 * The question shown on the recording screen. A person's first recording uses
 * the onboarding question (an admin can switch it to a fixed question); after
 * that it is today's question. Either way it is filed under today's question.
 */
export async function getQuestionToAnswer(): Promise<{ text: string } | null> {
  const { count, error: countError } = await supabase.from('answers').select('id', { count: 'exact', head: true });
  if (countError) throw countError;
  if ((count ?? 0) === 0) {
    const { data, error } = await supabase.rpc('get_onboarding_question');
    if (error) throw error;
    const row = (data ?? [])[0];
    return row ? { text: row.prompt_text } : null;
  }
  const { data, error } = await supabase.rpc('get_todays_question');
  if (error) throw error;
  const row = (data ?? [])[0];
  return row ? { text: row.text } : null;
}

export async function getRecordingLengthSeconds(): Promise<number> {
  const { data, error } = await supabase.rpc('get_app_config');
  if (error) throw error;
  return (data ?? [])[0]?.recording_length_seconds;
}

async function functionErrorBody(error: unknown): Promise<{ error?: string; reason?: string; limit?: number } | null> {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === 'function') {
    return context.json().catch(() => null);
  }
  return { error: (error as Error).message };
}

export type StartedUpload = { videoId: string; uploadUrl: string; recordingLengthSeconds: number };

/** Asks the server to start a recording. Every attempt counts toward the daily limit. */
export async function startUpload(): Promise<{ ok: true; upload: StartedUpload } | { ok: false; refusal: UploadRefusal }> {
  const { data, error } = await supabase.functions.invoke('create-video-upload');
  if (error) return { ok: false, refusal: uploadRefusal(await functionErrorBody(error)) };
  return {
    ok: true,
    upload: { videoId: data.video_id, uploadUrl: data.upload_url, recordingLengthSeconds: data.recording_length_seconds },
  };
}

export async function uploadRecording(uploadUrl: string, fileUri: string): Promise<boolean> {
  const FileSystem = await import('expo-file-system/legacy');
  const result = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': 'video/mp4' },
  });
  return result.status >= 200 && result.status < 300;
}

export async function getVideo(videoId: string): Promise<VideoRow | null> {
  const { data, error } = await supabase
    .from('videos')
    .select('id, status, reject_reason, duration_seconds, captions_status, caption_segments')
    .eq('id', videoId)
    .maybeSingle();
  if (error) throw error;
  return data as VideoRow | null;
}

export async function submitAnswer(videoId: string): Promise<void> {
  const { error } = await supabase.rpc('submit_answer', { p_video_id: videoId });
  if (error) throw error;
}

export async function saveCaptionTexts(videoId: string, texts: string[]): Promise<void> {
  const { error } = await supabase.rpc('update_caption_segments', { p_video_id: videoId, p_texts: texts });
  if (error) throw error;
}

export async function resetCaptions(videoId: string): Promise<void> {
  const { error } = await supabase.rpc('reset_captions', { p_video_id: videoId });
  if (error) throw error;
}
