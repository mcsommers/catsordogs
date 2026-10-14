import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
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
  type RankingWeight,
} from '../lib/feedSettings';
import { supabase } from '../lib/supabase';
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

const WEIGHTS: RankingWeight[] = ['low', 'medium', 'high'];

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
      <Text style={styles.filterLabel}>{d.label}</Text>
      {d.control === 'segmented' && d.optionCategory ? (
        <View style={styles.chips}>
          {(options[d.optionCategory] ?? []).map((o) => (
            <Chip
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
      {d.control === 'range' ? (
        <View style={styles.rangeRow}>
          <AppTextInput
            style={[styles.input, { flex: 1 }]}
            keyboardType="number-pad"
            placeholder="Min"
            placeholderTextColor={colors.textDarkFaint}
            focusScrollAnchorRef={anchorRef}
            value={
              filters[d.key] && typeof filters[d.key] === 'object'
                ? String((filters[d.key] as { min?: number }).min ?? '')
                : ''
            }
            onChangeText={(t) => {
              const cur = (filters[d.key] as { min?: number; max?: number }) ?? {};
              setFilter(d.key, { ...cur, min: t ? Number(t) : undefined });
            }}
          />
          <AppTextInput
            style={[styles.input, { flex: 1 }]}
            keyboardType="number-pad"
            placeholder="Max"
            placeholderTextColor={colors.textDarkFaint}
            focusScrollAnchorRef={anchorRef}
            value={
              filters[d.key] && typeof filters[d.key] === 'object'
                ? String((filters[d.key] as { max?: number }).max ?? '')
                : ''
            }
            onChangeText={(t) => {
              const cur = (filters[d.key] as { min?: number; max?: number }) ?? {};
              setFilter(d.key, { ...cur, max: t ? Number(t) : undefined });
            }}
          />
        </View>
      ) : null}
      {d.control === 'multi' && d.optionCategory ? (
        <View style={styles.chips}>
          {(options[d.optionCategory] ?? []).map((o) => {
            const arr = Array.isArray(filters[d.key]) ? (filters[d.key] as string[]) : [];
            const on = arr.includes(o.value);
            return (
              <Chip
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

  const load = useCallback(async () => {
    const [d, f, r, opts] = await Promise.all([
      loadFilterDefinitions(),
      loadFilterPreferences(),
      loadFeedRankingSettings(),
      supabase.from('profile_options').select('category, value').eq('active', true),
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
      if (ranking) await updateFeedRankingSettings(ranking);
      Alert.alert('Saved', 'Your feed settings were updated.');
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message || 'Try again.');
    } finally {
      setSaving(false);
    }
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
      {(Object.keys(RANKING_LABELS) as (keyof FeedRankingSettings)[]).map((key) => (
        <View key={key} style={styles.filterCard}>
          <Text style={styles.filterLabel}>{RANKING_LABELS[key].title}</Text>
          <Text style={styles.filterHint}>{RANKING_LABELS[key].description}</Text>
          <View style={styles.segment}>
            {WEIGHTS.map((w) => (
              <Pressable
                key={w}
                style={[styles.segmentBtn, ranking[key] === w && styles.segmentBtnActive]}
                onPress={() => setRanking({ ...ranking, [key]: w })}
              >
                <Text style={[styles.segmentLabel, ranking[key] === w && styles.segmentLabelActive]}>
                  {w.charAt(0).toUpperCase() + w.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
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
  rangeRow: { flexDirection: 'row', gap: 8 },
  rankingHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 8 },
  resetLink: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accentDog, paddingTop: 4 },
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
