import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { fetchBrowseQuestions, type BrowseQuestion } from '../lib/feed';
import { shortQuestionDate } from '../lib/format';
import { BackButton, CenteredSpinner, Screen } from '../components/ui';
import { colors, fonts } from '../theme';

const PAGE = 30;

export default function BrowseQuestions() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<BrowseQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string) => {
    setFailed(false);
    setLoading(true);
    try {
      const { items: rows } = await fetchBrowseQuestions(q, 0, PAGE);
      setItems(rows);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('');
  }, [load]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(query), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, load]);

  function openDay(item: BrowseQuestion) {
    router.replace({ pathname: '/(tabs)/feed', params: { date: item.questionDate } });
  }

  return (
    <Screen dark edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.title}>Browse Questions</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.search}>
        <Search size={18} color={colors.textDarkMuted} />
        <TextInput
          style={styles.input}
          placeholder="Search questions"
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
      {loading ? (
        <CenteredSpinner dark />
      ) : failed ? (
        <Text style={styles.empty}>We couldn&apos;t load questions. Try again.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.questionId}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}
          ListEmptyComponent={<Text style={styles.empty}>No questions match your search.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => openDay(item)} accessibilityRole="button">
              <View style={styles.rowTop}>
                <Text style={styles.date}>{shortQuestionDate(item.questionDate)}</Text>
                {item.isToday ? <Text style={styles.live}>Live now · Today&apos;s feed</Text> : null}
              </View>
              <Text style={styles.question}>{item.questionText}</Text>
              <Text style={styles.count}>{item.responseCount} responses</Text>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.white },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.surfaceDark,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderDark,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.white, padding: 0 },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
    paddingVertical: 16,
    gap: 6,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  date: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.accentDog },
  live: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textDarkMuted },
  question: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22, color: colors.white },
  count: { fontFamily: fonts.body, fontSize: 13, color: colors.textDarkMuted },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.textDarkMuted, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
});
