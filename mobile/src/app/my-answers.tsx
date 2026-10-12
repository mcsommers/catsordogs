import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { fetchUserAnswersPage, PROFILE_ANSWER_PAGE_SIZE, type ProfileAnswer } from '../lib/profile';
import { ProfileArchiveCard } from '../components/profile/ProfileArchiveCard';
import { PROFILE_PAD } from '../components/profile/profileLayout';
import { BackButton, CenteredSpinner } from '../components/ui';
import { colors, fonts } from '../theme';

/** 08a Your Answers — full archive with lazy loading (Pencil 08a). */
export default function MyAnswersScreen() {
  const [answers, setAnswers] = useState<ProfileAnswer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const loadingMoreRef = useRef(false);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchUserAnswersPage(null, 0, PROFILE_ANSWER_PAGE_SIZE);
      setAnswers(page.items);
      setTotal(page.totalCount);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || answers.length >= total) return;
    loadingMoreRef.current = true;
    try {
      const page = await fetchUserAnswersPage(null, answers.length, PROFILE_ANSWER_PAGE_SIZE);
      setAnswers((prev) => [...prev, ...page.items]);
      setTotal(page.totalCount);
    } finally {
      loadingMoreRef.current = false;
    }
  }, [answers.length, total]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} hero />
        <Text style={styles.title}>Your Answers</Text>
        <View style={styles.headerSpacer} />
      </View>
      {loading ? (
        <CenteredSpinner dark />
      ) : (
        <FlatList
          data={answers}
          keyExtractor={(a) => a.answerId}
          contentContainerStyle={{ paddingHorizontal: PROFILE_PAD, paddingBottom: 32, gap: 8 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <ProfileArchiveCard
              answer={item}
              onPress={() =>
                router.push({ pathname: '/answer/[answerId]', params: { answerId: item.answerId, userId: 'self' } })
              }
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No answers yet.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDark },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PROFILE_PAD,
    paddingVertical: 12,
    gap: 12,
  },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 17, color: colors.white },
  headerSpacer: { width: 36 },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.textDarkMuted, textAlign: 'center', marginTop: 24 },
});
