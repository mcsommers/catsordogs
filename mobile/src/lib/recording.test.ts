import {
  CAPTION_FALLBACK_TEXT,
  joinedCaptionText,
  reviewState,
  splitCaptionForSegments,
  uploadRefusal,
  type VideoRow,
} from './recording';

const row = (over: Partial<VideoRow>): VideoRow => ({
  id: 'v1',
  status: 'ready',
  reject_reason: null,
  duration_seconds: 9,
  captions_status: 'ready',
  caption_segments: [
    { start: 0, end: 4, text: 'Honestly? ' },
    { start: 4, end: 9, text: 'I love graffiti.' },
  ],
  ...over,
});

describe('editing captions as one field', () => {
  const template = [
    { start: 0, end: 4, text: 'Honestly? ' },
    { start: 4, end: 9, text: 'I love graffiti.' },
  ];

  it('joins segments for display', () => {
    expect(joinedCaptionText(template)).toBe('Honestly? I love graffiti.');
  });

  it('splits edited text back across the same number of segments', () => {
    const texts = splitCaptionForSegments('Hi there everyone', template);
    expect(texts).toHaveLength(2);
    expect(texts.join(' ')).toBe('Hi there everyone');
  });
});

describe('what Review & Submit shows', () => {
  it('shows the captions when the video and captions are ready (05)', () => {
    expect(reviewState(row({}))).toEqual({ kind: 'ready', caption: 'Honestly? I love graffiti.' });
  });

  it('waits while the video is uploading or processing, or captions are pending (05d)', () => {
    expect(reviewState(null).kind).toBe('processing');
    expect(reviewState(row({ status: 'awaiting_upload' })).kind).toBe('processing');
    expect(reviewState(row({ status: 'processing' })).kind).toBe('processing');
    expect(reviewState(row({ captions_status: 'pending' })).kind).toBe('processing');
  });

  it('shows a placeholder caption after the wait timeout while Mux is still pending', () => {
    expect(reviewState(row({ captions_status: 'pending' }), false, { captionWaitTimedOut: true })).toEqual({
      kind: 'ready',
      caption: CAPTION_FALLBACK_TEXT,
    });
  });

  it('says no speech was found when captions are unavailable (05e)', () => {
    expect(reviewState(row({ captions_status: 'unavailable', caption_segments: [] })).kind).toBe('no_speech');
  });

  it('still lets the owner edit captions they erased', () => {
    const erased = row({ caption_segments: [{ start: 0, end: 4, text: ' ' }] });
    expect(reviewState(erased)).toEqual({ kind: 'ready', caption: '' });
  });

  it('asks for a re-record when the video was too long or failed', () => {
    expect(reviewState(row({ status: 'rejected', reject_reason: 'too_long' })).kind).toBe('too_long');
    expect(reviewState(row({ status: 'failed' })).kind).toBe('failed');
    expect(reviewState(row({}), true).kind).toBe('failed');
  });
});

describe('why a recording could not start', () => {
  it('reads the daily limit and its admin-set number (04f)', () => {
    expect(uploadRefusal({ error: "You have reached today's limit of 10 recordings.", reason: 'daily_limit', limit: 10 })).toEqual({
      kind: 'daily_limit',
      limit: 10,
      message: "You have reached today's limit of 10 recordings.",
    });
  });

  it('recognises no question today, already answered and an unfinished profile', () => {
    expect(uploadRefusal({ reason: 'no_question_today', error: 'x' }).kind).toBe('no_question_today');
    expect(uploadRefusal({ reason: 'already_answered', error: 'x' }).kind).toBe('already_answered');
    expect(uploadRefusal({ reason: 'profile_incomplete', error: 'x' }).kind).toBe('profile_incomplete');
  });

  it('falls back to the server message, or a plain one', () => {
    expect(uploadRefusal({ error: 'We could not start the upload. Please try again.' })).toEqual({
      kind: 'other',
      message: 'We could not start the upload. Please try again.',
    });
    expect(uploadRefusal(null).message).toMatch(/couldn/);
  });
});
