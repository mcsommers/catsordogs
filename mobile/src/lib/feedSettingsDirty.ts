import type { FeedRankingSettings } from './feedSettings';

export const DISCARD_FEED_SETTINGS_TITLE = 'Discard changes?';
export const DISCARD_FEED_SETTINGS_BODY =
  'You have unsaved changes to your feed settings. If you leave now, your changes won\u2019t be saved.';
export const DISCARD_FEED_SETTINGS_LEAVE = 'Leave Without Saving';
export const DISCARD_FEED_SETTINGS_KEEP = 'Keep Editing';

function stableFilters(filters: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(filters).sort()) {
    const value = filters[key];
    out[key] = Array.isArray(value) ? [...value].map(String).sort() : value;
  }
  return out;
}

function stableRanking(ranking: FeedRankingSettings): FeedRankingSettings {
  return {
    ...ranking,
    specificInterests: [...ranking.specificInterests].sort(),
  };
}

export function snapshotFeedSettings(
  filters: Record<string, unknown>,
  ranking: FeedRankingSettings
): string {
  return JSON.stringify({ filters: stableFilters(filters), ranking: stableRanking(ranking) });
}

export function feedSettingsHasUnsavedChanges(
  filters: Record<string, unknown>,
  ranking: FeedRankingSettings,
  baseline: string | null
): boolean {
  if (!baseline) return false;
  return snapshotFeedSettings(filters, ranking) !== baseline;
}
