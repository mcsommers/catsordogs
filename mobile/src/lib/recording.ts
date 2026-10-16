export type CaptionSegment = { start: number; end: number; text: string };

/** Full caption as one string (Review, Edit Captions). */
export function joinedCaptionText(segments: CaptionSegment[]): string {
  return segments.map((s) => s.text.trim()).filter(Boolean).join(' ');
}

const CAPTION_SEGMENT_MAX = 500;

/** Server limit: each timed segment can hold up to 500 characters. */
export function maxCaptionEditLength(segmentCount: number): number {
  return Math.max(CAPTION_SEGMENT_MAX, segmentCount * CAPTION_SEGMENT_MAX);
}

/**
 * Maps one edited caption back onto the existing timed segments (timing unchanged).
 * Words are split across segments in proportion to the automatic caption lengths.
 */
export function splitCaptionForSegments(edited: string, template: CaptionSegment[]): string[] {
  const n = template.length;
  if (n === 0) return [];
  const trimmed = edited.trim();
  if (n === 1) return [trimmed];

  const words = trimmed.length ? trimmed.split(/\s+/).filter(Boolean) : [];
  if (words.length === 0) return template.map(() => '');

  const weights = template.map((s) => Math.max(1, s.text.trim().length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map((w) => Math.max(0, Math.round((words.length * w) / totalWeight)));
  let diff = words.length - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; diff !== 0 && i < n; i++) {
    if (diff > 0) {
      counts[i]++;
      diff--;
    } else if (counts[i] > 0) {
      counts[i]--;
      diff++;
    }
  }

  const texts: string[] = [];
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const take = counts[i];
    texts.push(words.slice(idx, idx + take).join(' '));
    idx += take;
  }
  if (idx < words.length) {
    const last = texts.length - 1;
    texts[last] = [texts[last], words.slice(idx).join(' ')].filter(Boolean).join(' ');
  }
  return texts;
}

/** How long Review waits for Mux auto-captions after the video is ready (05d). */
export const CAPTION_WAIT_MS = 8000;

export const CAPTION_FALLBACK_TEXT = 'No caption.';

export type VideoRow = {
  id: string;
  status: 'awaiting_upload' | 'processing' | 'ready' | 'rejected' | 'failed' | 'cancelled' | string;
  reject_reason: string | null;
  duration_seconds: number | null;
  captions_status: 'pending' | 'ready' | 'unavailable' | string;
  caption_segments: CaptionSegment[] | null;
};

/** What Review & Submit shows for a recording (05, 05d, 05e, or a problem). */
export type ReviewState =
  | { kind: 'processing' }
  | { kind: 'ready'; caption: string }
  | { kind: 'no_speech' }
  | { kind: 'too_long' }
  | { kind: 'failed' };

export function reviewState(
  row: VideoRow | null,
  uploadFailed = false,
  opts?: { captionWaitTimedOut?: boolean }
): ReviewState {
  if (uploadFailed) return { kind: 'failed' };
  if (!row) return { kind: 'processing' };
  if (row.status === 'rejected') return { kind: 'too_long' };
  if (row.status === 'failed' || row.status === 'cancelled') return { kind: 'failed' };
  if (row.status !== 'ready') return { kind: 'processing' };
  if (row.captions_status === 'pending') {
    if (opts?.captionWaitTimedOut) return { kind: 'ready', caption: CAPTION_FALLBACK_TEXT };
    return { kind: 'processing' };
  }
  const segments = row.caption_segments ?? [];
  if (row.captions_status === 'unavailable' || segments.length === 0) return { kind: 'no_speech' };
  // An owner who erased every caption can still go back and edit them.
  return { kind: 'ready', caption: joinedCaptionText(segments) };
}

export type UploadRefusal =
  | { kind: 'daily_limit'; limit: number; message: string }
  | { kind: 'no_question_today'; message: string }
  | { kind: 'already_answered'; message: string }
  | { kind: 'profile_incomplete'; message: string }
  | { kind: 'other'; message: string };

/** Reads why create-video-upload refused to start a recording. */
export function uploadRefusal(body: { error?: string; reason?: string; limit?: number } | null): UploadRefusal {
  const message = body?.error || 'We couldn\u2019t start the recording. Please try again.';
  switch (body?.reason) {
    case 'daily_limit':
      return { kind: 'daily_limit', limit: Number(body.limit) || 0, message };
    case 'no_question_today':
    case 'already_answered':
    case 'profile_incomplete':
      return { kind: body.reason, message };
    default:
      return { kind: 'other', message };
  }
}
