import type { FeedRankingSettings } from './feedSettings';
import { feedSettingsHasUnsavedChanges, snapshotFeedSettings } from './feedSettingsDirty';

const ranking = (over: Partial<FeedRankingSettings> = {}): FeedRankingSettings => ({
  sharedInterests: 'medium',
  specificInterests: [],
  relationshipGoals: 'medium',
  distance: 'medium',
  ...over,
});

describe('feed settings dirty state', () => {
  it('detects filter and ranking edits against a baseline', () => {
    const base = snapshotFeedSettings({}, ranking());
    expect(feedSettingsHasUnsavedChanges({}, ranking(), base)).toBe(false);
    expect(feedSettingsHasUnsavedChanges({ show_me: 'Women' }, ranking(), base)).toBe(true);
    expect(feedSettingsHasUnsavedChanges({}, ranking({ distance: 'high' }), base)).toBe(true);
  });

  it('treats interest pick order as unchanged', () => {
    const filters = {};
    const r = ranking({ specificInterests: ['Coffee', 'Hiking'] });
    const base = snapshotFeedSettings(filters, ranking({ specificInterests: ['Hiking', 'Coffee'] }));
    expect(feedSettingsHasUnsavedChanges(filters, r, base)).toBe(false);
  });
});
