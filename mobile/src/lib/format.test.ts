import {
  clock,
  formatDistanceMiles,
  formatFollowedOn,
  formatHeightFeetInches,
  formatProfileIdentityLabel,
  formatStreakBadge,
  longDate,
  questionPillLabel,
  segmentRange,
  shortQuestionDate,
  splitHeightInches,
  timerLabel,
  toIsoDate,
} from './format';

describe('formatting', () => {
  it('shows the recording timer against the admin-set length', () => {
    expect(timerLabel(0, 14)).toBe('0:00 / 0:14');
    expect(timerLabel(7.6, 14)).toBe('0:07 / 0:14');
    expect(timerLabel(20, 14)).toBe('0:14 / 0:14');
    expect(timerLabel(3, 60)).toBe('0:03 / 1:00');
  });

  it('shows minutes and seconds', () => {
    expect(clock(74)).toBe('1:14');
    expect(clock(-2)).toBe('0:00');
  });

  it('shows caption time ranges like the design', () => {
    expect(segmentRange(0, 5)).toBe('0:00 \u2013 0:05');
    expect(segmentRange(10, 13.2)).toBe('0:10 \u2013 0:14');
  });

  it('shows and stores birthdays', () => {
    expect(longDate('2010-06-03')).toBe('June 3, 2010');
    expect(toIsoDate(new Date(2000, 0, 31))).toBe('2000-01-31');
  });

  it('formats height in feet and inches', () => {
    expect(splitHeightInches(69)).toEqual({ feet: 5, inches: 9 });
    expect(formatHeightFeetInches(69)).toBe('5\'9"');
  });

  it('formats feed labels', () => {
    expect(shortQuestionDate('2026-10-05')).toBe('Oct 5');
    expect(questionPillLabel('2026-10-05', 'Hi?')).toBe('Oct 5 · Hi?');
    expect(formatDistanceMiles(2)).toBe('2 miles away');
    expect(formatDistanceMiles(1)).toBe('1 mile away');
    expect(formatStreakBadge(14)).toBe('14-day streak');
  });

  it('shows when you followed someone', () => {
    expect(formatFollowedOn(new Date(2026, 9, 15).toISOString())).toBe('Followed on Oct 15');
  });

  it('formats profile identity next to age', () => {
    expect(formatProfileIdentityLabel(['Straight'], 'Man')).toBe('straight male');
    expect(formatProfileIdentityLabel(['Gay'], 'Woman')).toBe('gay female');
    expect(formatProfileIdentityLabel(['Bisexual'], 'Non-binary')).toBe('bisexual non-binary');
    expect(formatProfileIdentityLabel(['Straight'], null)).toBe('straight');
    expect(formatProfileIdentityLabel([], 'Man')).toBe('male');
    expect(formatProfileIdentityLabel([], null)).toBeNull();
  });
});
