import { supabase } from './supabase';

export type FilterControl = 'segmented' | 'range' | 'number' | 'multi';

export type FilterDefinition = {
  key: string;
  label: string;
  control: FilterControl;
  profileField: string | null;
  optionCategory: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  sortOrder: number;
};

export type RankingWeight = 'low' | 'medium' | 'high';

/** Shared Interests also offers "specific": score on the interests the person picked. */
export type SharedInterestsWeight = RankingWeight | 'specific';

export type FeedRankingSettings = {
  sharedInterests: SharedInterestsWeight;
  /** The interests picked for "specific" (kept even while another option is selected). */
  specificInterests: string[];
  relationshipGoals: RankingWeight;
  distance: RankingWeight;
};

const RANKING_FIELDS: (keyof FeedRankingSettings)[] = [
  'sharedInterests',
  'specificInterests',
  'relationshipGoals',
  'distance',
];

const RANKING_DB: Record<keyof FeedRankingSettings, string> = {
  sharedInterests: 'shared_interests',
  specificInterests: 'specific_interests',
  relationshipGoals: 'relationship_goals',
  distance: 'distance',
};

function mapFilterDef(row: Record<string, unknown>): FilterDefinition {
  return {
    key: String(row.key),
    label: String(row.label),
    control: String(row.control) as FilterControl,
    profileField: row.profile_field ? String(row.profile_field) : null,
    optionCategory: row.option_category ? String(row.option_category) : null,
    minValue: row.min_value == null ? null : Number(row.min_value),
    maxValue: row.max_value == null ? null : Number(row.max_value),
    unit: row.unit ? String(row.unit) : null,
    sortOrder: Number(row.sort_order) || 0,
  };
}

function mapRanking(row: Record<string, unknown>): FeedRankingSettings {
  return {
    sharedInterests: String(row.shared_interests ?? 'medium') as SharedInterestsWeight,
    specificInterests: Array.isArray(row.specific_interests) ? (row.specific_interests as string[]) : [],
    relationshipGoals: String(row.relationship_goals ?? 'medium') as RankingWeight,
    distance: String(row.distance ?? 'medium') as RankingWeight,
  };
}

export async function loadFilterDefinitions(): Promise<FilterDefinition[]> {
  const { data, error } = await supabase
    .from('filter_definitions')
    .select('key, label, control, profile_field, option_category, min_value, max_value, unit, sort_order')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []).map(mapFilterDef);
}

export async function loadFilterPreferences(): Promise<Record<string, unknown>> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return {};
  const { data, error } = await supabase.from('filter_preferences').select('filters').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  const filters = data?.filters;
  return filters && typeof filters === 'object' && !Array.isArray(filters) ? (filters as Record<string, unknown>) : {};
}

export async function saveFilterPreferences(filters: Record<string, unknown>): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new Error('Not signed in.');
  const { error } = await supabase.from('filter_preferences').update({ filters }).eq('user_id', uid);
  if (error) throw error;
}

export async function loadFeedRankingSettings(): Promise<FeedRankingSettings> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) {
    return {
      sharedInterests: 'medium',
      specificInterests: [],
      relationshipGoals: 'medium',
      distance: 'medium',
    };
  }
  const { data, error } = await supabase
    .from('feed_settings')
    .select('shared_interests, specific_interests, relationship_goals, distance')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRanking(data as Record<string, unknown>) : mapRanking({});
}

export async function updateFeedRankingSettings(partial: Partial<FeedRankingSettings>): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new Error('Not signed in.');
  const payload: Record<string, string | string[]> = {};
  for (const key of RANKING_FIELDS) {
    if (partial[key] != null) payload[RANKING_DB[key]] = partial[key]!;
  }
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from('feed_settings').update(payload).eq('user_id', uid);
  if (error) throw error;
}

export async function resetFeedSettings(): Promise<void> {
  const { error } = await supabase.rpc('reset_feed_settings');
  if (error) throw error;
}

export const RANKING_LABELS: Record<Exclude<keyof FeedRankingSettings, 'specificInterests'>, { title: string; description: string }> = {
  sharedInterests: {
    title: 'Shared Interests',
    description: 'How much overlap in your chosen Interests matters. Pick Specific to choose exactly which interests count most.',
  },
  relationshipGoals: {
    title: 'Relationship Goals',
    description: 'How much your relationship goals need to align.',
  },
  distance: {
    title: 'Distance',
    description: 'How much closer profiles are favored.',
  },
};
