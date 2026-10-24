import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { fetchBrowseQuestions, type BrowseQuestion } from '../lib/feed';
import { historyQuestionDate } from '../lib/format';
import { questionHighlightParts } from '../lib/questionHighlight';
import { AppTextInput, BackButton, CenteredSpinner, Screen, styles as ui } from '../components/ui';
import { colors, fonts } from '../theme';

const PAGE = 30;

function HighlightedQuestion({ text, query }: { text: string; query: string }) {
  const parts = questionHighlightParts(text, query);
  return (
    <Text style={styles.question}>
      {parts.map((part, i) =>
        part.highlight ? (
          <Text key={i} style={styles.questionHighlight}>{part.text}</Text>
        ) : (
          part.text
        ),
      )}
    </Text>
  );
}

export default function BrowseQuestions() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<BrowseQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadEpochRef = useRef(0);
  const hasListRef = useRef(false);

  const load = useCallback(async (q: string, background: boolean) => {
    const epoch = ++loadEpochRef.current;
    setFailed(false);
    if (!background) setLoading(true);
    try {
      const { items: rows } = await fetchBrowseQuestions(q, 0, PAGE);
      if (epoch !== loadEpochRef.current) return;
      setItems(rows);
      hasListRef.current = true;
    } catch {
      if (epoch === loadEpochRef.current) setFailed(true);
    } finally {
      if (epoch === loadEpochRef.current && !background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query;
    const background = hasListRef.current;
    const run = () => load(q, background);
    if (q.trim() === '') {
      run();
      return;
    }
    debounceRef.current = setTimeout(run, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, load]);

  function openDay(item: BrowseQuestion) {
    router.replace({ pathname: '/(tabs)/feed', params: { date: item.questionDate } });
  }

  const searching = query.trim().length > 0;

  const chrome = (
    <View style={styles.chrome}>
      <View style={ui.headerWithTitle}>
        <BackButton onPress={() => router.back()} dark />
        <Text style={ui.headerTitleDark}>Question History</Text>
      </View>
      <View style={[styles.search, searching && styles.searchActive]}>
        <Search size={18} color={searching ? colors.accentDog : colors.textDarkMuted} />
        <AppTextInput
          style={styles.input}
          placeholder="Search past questions..."
          placeholderTextColor={colors.textDarkMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
            <X size={18} color={colors.textDarkMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <Screen dark flush edges={['top', 'bottom']}>
      {chrome}
      {loading ? (
        <CenteredSpinner dark />
      ) : failed ? (
        <Text style={styles.empty}>We couldn&apos;t load questions. Try again.</Text>
      ) : (
        <FlatList
          style={styles.list}
          data={items}
          keyExtractor={(item) => item.questionId}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.empty}>No questions match your search.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => openDay(item)} accessibilityRole="button">
              <View style={styles.dateRow}>
                <Text style={styles.date}>{historyQuestionDate(item.questionDate)}</Text>
                {item.isToday ? <Text style={styles.live}>Live now</Text> : null}
              </View>
              <HighlightedQuestion text={item.questionText} query={query} />
              {!item.isToday ? (
                <Text style={styles.count}>{item.responseCount} responses</Text>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const H_PAD = 20;

const styles = StyleSheet.create({
  /** Fixed top chrome so the list never scrolls under the search field. */
  chrome: {
    paddingHorizontal: H_PAD,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 16,
    backgroundColor: colors.bgDark,
    zIndex: 1,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceDark,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderDark,
    paddingHorizontal: 14,
    minHeight: 48,
    paddingVertical: 10,
  },
  searchActive: { borderColor: colors.accentDog, borderWidth: 1.5 },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.white,
    padding: 0,
    minHeight: 28,
    ...(Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' as const } : null),
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: H_PAD, paddingBottom: 40 },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
    paddingVertical: 16,
    gap: 6,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  date: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.accentDog },
  live: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textDarkMuted },
  question: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22, color: colors.white },
  questionHighlight: { color: colors.accentDog, fontFamily: fonts.bodyBold },
  count: { fontFamily: fonts.body, fontSize: 13, color: colors.textDarkMuted },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.textDarkMuted, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
});
