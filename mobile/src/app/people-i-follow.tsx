import { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getPeopleIFollow, unfollowUser, type FollowedPerson } from '../lib/social';
import { formatFollowedOn } from '../lib/format';
import { signPhotoPaths } from '../lib/profile';
import { confirmUnfollow } from '../components/social/confirmations';
import { BackButton, CenteredSpinner, PrimaryButton, Screen, styles as ui } from '../components/ui';
import { colors, fonts } from '../theme';

/** 08i People I follow — list cards match Outgoing on 07e. */
export default function PeopleIFollowScreen() {
  const [rows, setRows] = useState<FollowedPerson[]>([]);
  const [avatars, setAvatars] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const list = await getPeopleIFollow();
    setRows(list);
    const paths = list.map((r) => r.photoPath).filter(Boolean) as string[];
    setAvatars(await signPhotoPaths([...new Set(paths)]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [load])
  );

  const avatarUri = (path: string | null) => (path ? avatars.get(path) : undefined);

  if (loading) {
    return (
      <Screen dark>
        <CenteredSpinner dark />
      </Screen>
    );
  }

  return (
    <Screen dark flush edges={['top', 'bottom']}>
      <View style={styles.top}>
        <View style={ui.headerWithTitle}>
          <BackButton onPress={() => router.back()} dark />
          <Text style={ui.headerTitleDark}>People I follow</Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={colors.white}
          />
        }
      >
        {rows.length === 0 ? (
          <Text style={styles.empty}>You&apos;re not following anyone yet.</Text>
        ) : (
          rows.map((row) => (
            <View key={row.userId} style={styles.card}>
              <View style={styles.rowTop}>
                {avatarUri(row.photoPath) ? (
                  <Image source={{ uri: avatarUri(row.photoPath)! }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]} />
                )}
                <View style={styles.rowText}>
                  <Text style={styles.name}>
                    {row.firstName}, {row.age}
                  </Text>
                  {row.followedAt ? <Text style={styles.subline}>{formatFollowedOn(row.followedAt)}</Text> : null}
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable
                  style={[styles.outlineBtn, { flex: 1 }]}
                  onPress={() =>
                    confirmUnfollow(
                      {
                        firstName: row.firstName,
                        gender: row.gender,
                        avatarUri: avatarUri(row.photoPath),
                      },
                      async () => {
                        await unfollowUser(row.userId);
                        await load();
                      }
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Unfollow ${row.firstName}`}
                >
                  <Text style={styles.outlineBtnLabel}>Unfollow</Text>
                </Pressable>
                <PrimaryButton
                  label="View Profile"
                  onPress={() => router.push({ pathname: '/user/[id]', params: { id: row.userId } })}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.textDarkMuted, textAlign: 'center', paddingVertical: 32 },
  card: {
    backgroundColor: colors.surfaceDark,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: 14,
    gap: 12,
  },
  rowTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { backgroundColor: colors.borderDark },
  rowText: { flex: 1, gap: 3 },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
  subline: { fontFamily: fonts.body, fontSize: 13, color: colors.textDarkMuted, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10 },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF33',
    borderRadius: 9999,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
});
