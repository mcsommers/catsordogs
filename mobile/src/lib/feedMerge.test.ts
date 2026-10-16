import type { FeedItem } from './feed';
import { appendUniqueFeedItems } from './feedMerge';

const item = (answerId: string): FeedItem => ({
  answerId,
  userId: 'u',
  questionId: 'q',
  questionDate: '2026-01-01',
  questionText: 't',
  firstName: 'n',
  gender: null,
  age: 30,
  distanceMiles: null,
  city: null,
  captionText: '',
  captionSegments: [],
  durationSeconds: 10,
  isFollowed: false,
  submittedAt: '',
  streakDays: 0,
  matchState: 'none',
});

describe('appendUniqueFeedItems', () => {
  it('appends only rows whose answerId is not already in the list', () => {
    const prev = [item('a'), item('b')];
    const next = [item('b'), item('c')];
    const merged = appendUniqueFeedItems(prev, next);
    expect(merged.map((it) => it.answerId)).toEqual(['a', 'b', 'c']);
  });
});
