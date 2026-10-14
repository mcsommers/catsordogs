import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { setSpecificInterestsRequest } from '../lib/specificInterestsPicker';
import {
  loadFeedRankingSettings,
  loadFilterDefinitions,
  loadFilterPreferences,
  RANKING_LABELS,
  resetFeedSettings,
  saveFilterPreferences,
  updateFeedRankingSettings,
  type FeedRankingSettings,
  type FilterDefinition,
  type SharedInterestsWeight,
} from '../lib/feedSettings';
import { supabase } from '../lib/supabase';
import { RangeSlider } from '../components/RangeSlider';
import {
  AppTextInput,
  BackButton,
  CenteredSpinner,
  Chip,
  PrimaryButton,
  Screen,
  SectionHeader,
  styles as ui,
} from '../components/ui';
import { colors, fonts } from '../theme';

type Option = { value: string };

const WEIGHTS: SharedInterestsWeight[] = ['low', 'medium', 'high'];
const SHARED_INTERESTS_WEIGHTS: SharedInterestsWeight[] = [...WEIGHTS, 'specific'];

/** "70+" / 7'0"+" at the top end of the slider. */
function formatRangeValue(d: FilterDefinition, n: number): string {
  const top = n >= (d.maxValue ?? Infinity);
  if (d.unit === 'in') return `${Math.floor(n / 12)}'${n % 12}"${top ? '+' : ''}`;
  return `${n}${top ? '+' : ''}`;
}

function RangeFilter({
  d,
  filters,
  setFilter,
}: {
  d: FilterDefinition;
  filters: Record<string, unknown>;
  setFilter: (key: string, value: unknown) => void;
}) {
  const lo0 = d.minValue as number;
  const hi0 = d.maxValue as number;
  const saved = filters[d.key] as { min?: number; max?: number } | undefined;
  const low = Math.min(Math.max(saved?.min ?? lo0, lo0), hi0);
  const high = Math.min(Math.max(saved?.max ?? hi0, lo0), hi0);
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.rangeLabelRow}>
        <Text style={styles.filterLabel}>{d.label}</Text>
        <Text style={styles.rangeValue}>{`${formatRangeValue(d, low)} – ${formatRangeValue(d, high)}`}</Text>
      </View>
      <RangeSlider
        min={lo0}
        max={hi0}
        low={low}
        high={high}
        onChange={(l, h) => setFilter(d.key, l <= lo0 && h >= hi0 ? null : { min: l, max: h })}
      />
      <View style={styles.rangeLabelRow}>
        <Text style={styles.rangeScale}>{formatRangeValue(d, lo0)}</Text>
        <Text style={styles.rangeScale}>{formatRangeValue(d, hi0)}</Text>
      </View>
    </View>
  );
}

function FilterDefinitionCard({
  d,
  filters,
  setFilter,
  options,
}: {
  d: FilterDefinition;
  filters: Record<string, unknown>;
  setFilter: (key: string, value: unknown) => void;
  options: Record<string, Option[]>;
}) {
  const anchorRef = useRef<View>(null);

  return (
    <View ref={anchorRef} collapsable={false} style={styles.filterCard}>
      {d.control !== 'range' ? <Text style={styles.filterLabel}>{d.label}</Text> : null}
      {d.control === 'segmented' && d.optionCategory ? (
        <View style={styles.chips}>
          {(options[d.optionCategory] ?? []).map((o) => (
            <Chip
              dark
              key={o.value}
              label={o.value}
              selected={filters[d.key] === o.value}
              onPress={() => setFilter(d.key, filters[d.key] === o.value ? null : o.value)}
            />
          ))}
        </View>
      ) : null}
      {d.control === 'number' ? (
        <AppTextInput
          style={styles.input}
          keyboardType="number-pad"
          placeholder={d.unit ? `Max ${d.unit}` : 'Any'}
          placeholderTextColor={colors.textDarkFaint}
          focusScrollAnchorRef={anchorRef}
          value={filters[d.key] != null ? String(filters[d.key]) : ''}
          onChangeText={(t) => setFilter(d.key, t ? Number(t) : null)}
        />
      ) : null}
      {d.control === 'range' && d.minValue != null && d.maxValue != null ? (
        <RangeFilter d={d} filters={filters} setFilter={setFilter} />
      ) : null}
      {d.control === 'multi' && d.optionCategory ? (
        <View style={styles.chips}>
          {(options[d.optionCategory] ?? []).map((o) => {
            const arr = Array.isArray(filters[d.key]) ? (filters[d.key] as string[]) : [];
            const on = arr.includes(o.value);
            return (
              <Chip
                dark
                key={o.value}
                label={o.value}
                selected={on}
                onPress={() => {
                  const next = on ? arr.filter((v) => v !== o.value) : [...arr, o.value];
                  setFilter(d.key, next.length ? next : null);
                }}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export default function FeedSettingsScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const [defs, setDefs] = useState<FilterDefinition[]>([]);
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [ranking, setRanking] = useState<FeedRankingSettings | null>(null);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // What Shared Interests was set to before "Specific" was chosen (Specific with no picks goes back to it).
  const beforeSpecific = useRef<SharedInterestsWeight>('medium');

  // Coming back from the Specific Interests screen with nothing picked: undo the Specific choice.
  useFocusEffect(
    useCallback(() => {
      setRanking((prev) =>
        prev && prev.sharedInterests === 'specific' && prev.specificInterests.length === 0
          ? { ...prev, sharedInterests: beforeSpecific.current }
          : prev,
      );
    }, []),
  );

  const load = useCallback(async () => {
    const [d, f, r, opts] = await Promise.all([
      loadFilterDefinitions(),
      loadFilterPreferences(),
      loadFeedRankingSettings(),
      supabase.from('profile_options').select('category, value').eq('active', true).order('sort_order'),
    ]);
    setDefs(d);
    setFilters(f);
    setRanking(r);
    const grouped: Record<string, Option[]> = {};
    for (const row of opts.data ?? []) {
      const cat = String(row.category);
      grouped[cat] = grouped[cat] ?? [];
      grouped[cat].push({ value: String(row.value) });
    }
    setOptions(grouped);
  }, []);

  useEffect(() => {
    load()
      .catch(() => Alert.alert('Could not load', 'Check your connection and try again.'))
      .finally(() => setLoading(false));
  }, [load]);

  const setFilter = (key: string, value: unknown) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value === null || value === undefined || value === '') delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await saveFilterPreferences(filters);
      if (ranking) {
        const noPicks = ranking.sharedInterests === 'specific' && ranking.specificInterests.length === 0;
        await updateFeedRankingSettings(
          noPicks ? { ...ranking, sharedInterests: beforeSpecific.current } : ranking,
        );
        if (noPicks) setRanking({ ...ranking, sharedInterests: beforeSpecific.current });
      }
      Alert.alert('Saved', 'Your feed settings were updated.');
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const openSpecificInterests = () => {
    if (!ranking) return;
    setSpecificInterestsRequest({
      options: (options.interest ?? []).map((o) => o.value),
      value: ranking.specificInterests,
      onChange: (value) => setRanking((prev) => (prev ? { ...prev, specificInterests: value } : prev)),
    });
    router.push('/specific-interests');
  };

  const onResetRanking = async () => {
    try {
      await resetFeedSettings();
      setRanking(await loadFeedRankingSettings());
    } catch {
      Alert.alert('Could not reset', 'Try again.');
    }
  };

  if (loading || !ranking) {
    return (
      <Screen dark>
        <CenteredSpinner dark />
      </Screen>
    );
  }

  return (
    <Screen dark scroll scrollRef={scrollRef} scrollContentRef={contentRef} edges={['top', 'bottom']}>
      <BackButton onPress={() => router.back()} dark />
      <Text style={styles.title}>Feed Settings</Text>
      <Text style={styles.lead}>
        Filters decide who can appear in your feed. Ranking signals decide the order they appear in.
      </Text>

      <SectionHeader title="Filters" />
      <View style={styles.block}>
        {defs.map((d) => (
          <FilterDefinitionCard key={d.key} d={d} filters={filters} setFilter={setFilter} options={options} />
        ))}
      </View>

      <View style={styles.rankingHeader}>
        <SectionHeader title="Ranking" helper="Adjust how much each signal matters for the order of your feed." />
        <Pressable onPress={onResetRanking}>
          <Text style={styles.resetLink}>Reset</Text>
        </Pressable>
      </View>
      {(Object.keys(RANKING_LABELS) as (keyof typeof RANKING_LABELS)[]).map((key) => (
        <View key={key} style={styles.filterCard}>
          <Text style={styles.filterLabel}>{RANKING_LABELS[key].title}</Text>
          <Text style={styles.filterHint}>{RANKING_LABELS[key].description}</Text>
          <View style={styles.segment}>
            {(key === 'sharedInterests' ? SHARED_INTERESTS_WEIGHTS : WEIGHTS).map((w) => (
              <Pressable
                key={w}
                style={[styles.segmentBtn, ranking[key] === w && styles.segmentBtnActive]}
                onPress={() => {
                  if (key === 'sharedInterests' && w === 'specific' && ranking.sharedInterests !== 'specific') {
                    beforeSpecific.current = ranking.sharedInterests;
                  }
                  setRanking({ ...ranking, [key]: w });
                }}
              >
                <Text style={[styles.segmentLabel, ranking[key] === w && styles.segmentLabelActive]}>
                  {w.charAt(0).toUpperCase() + w.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
          {key === 'sharedInterests' && ranking.sharedInterests === 'specific' ? (
            <Pressable style={styles.specificRow} onPress={openSpecificInterests}>
              <Text style={styles.specificLabel}>Choose specific interests</Text>
              <View style={styles.specificValue}>
                <Text style={styles.specificCount}>{`${ranking.specificInterests.length} selected`}</Text>
                <ChevronRight size={15} color={colors.textDarkFaint} />
              </View>
            </Pressable>
          ) : null}
        </View>
      ))}

      <PrimaryButton label="Save" onPress={onSave} loading={saving} style={{ marginTop: 8 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...ui.title, color: colors.white, marginTop: 8 },
  lead: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textDarkMuted, marginBottom: 8 },
  block: { gap: 12 },
  filterCard: {
    backgroundColor: colors.surfaceDark,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: 14,
    gap: 10,
  },
  filterLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  filterHint: { fontFamily: fonts.body, fontSize: 12, color: colors.textDarkMuted, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    backgroundColor: '#00000040',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.white,
  },
  rangeLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rangeScale: { fontFamily: fonts.body, fontSize: 11, color: colors.textDarkMuted },
  rangeValue: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accentDog },
  rankingHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 8 },
  resetLink: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accentDog, paddingTop: 4 },
  specificRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#00000040',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  specificLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
  specificValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  specificCount: { fontFamily: fonts.body, fontSize: 13, color: colors.textDarkMuted },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#00000040',
    borderRadius: 9999,
    padding: 3,
    gap: 4,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 9999, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.accentDog },
  segmentLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textDarkMuted },
  segmentLabelActive: { fontFamily: fonts.bodyBold, color: colors.white },
});
