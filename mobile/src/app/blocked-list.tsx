import { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { listBlockedAndNotInterested, undoNotInterested, unblockUser } from '../lib/social';
import { signPhotoPaths } from '../lib/profile';
import { longDate } from '../lib/format';
import { confirmUnblock } from '../components/social/confirmations';
import { BackButton, CenteredSpinner, Screen, styles as ui } from '../components/ui';
import { colors, fonts } from '../theme';

type Tab = 'blocked' | 'not_interested';

export default function BlockedListScreen() {
  const [tab, setTab] = useState<Tab>('blocked');
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listBlockedAndNotInterested>>>([]);
  const [avatars, setAvatars] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const list = await listBlockedAndNotInterested();
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

  const blocked = rows.filter((r) => r.kind === 'blocked');
  const notInterested = rows.filter((r) => r.kind === 'not_interested');
  const shown = tab === 'blocked' ? blocked : notInterested;

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
          <Text style={ui.headerTitleDark}>Blocked and Not Interested</Text>
        </View>
        <View style={styles.tabs}>
          <Pressable style={[styles.tab, tab === 'blocked' && styles.tabActive]} onPress={() => setTab('blocked')}>
            <Text style={[styles.tabLabel, tab === 'blocked' && styles.tabLabelActive]}>Blocked ({blocked.length})</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'not_interested' && styles.tabActive]}
            onPress={() => setTab('not_interested')}
          >
            <Text style={[styles.tabLabel, tab === 'not_interested' && styles.tabLabelActive]}>
              Not Interested ({notInterested.length})
            </Text>
          </Pressable>
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
        {shown.length === 0 ? (
          <Text style={styles.empty}>No one here yet.</Text>
        ) : (
          shown.map((row) => (
            <View key={`${row.kind}-${row.userId}`} style={styles.row}>
              {row.photoPath && avatars.get(row.photoPath) ? (
                <Image source={{ uri: avatars.get(row.photoPath)! }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPh]} />
              )}
              <View style={styles.rowText}>
                <Text style={styles.name}>
                  {row.firstName}, {row.age}
                </Text>
                <Text style={styles.date}>{longDate(row.createdAt.slice(0, 10))}</Text>
              </View>
              <Pressable
                style={styles.actionBtn}
                onPress={() => {
                  if (tab === 'blocked') {
                    confirmUnblock(
                      {
                        firstName: row.firstName,
                        avatarUri: row.photoPath ? avatars.get(row.photoPath) : undefined,
                      },
                      async () => {
                        await unblockUser(row.userId);
                        await load();
                      }
                    );
                  } else {
                    void undoNotInterested(row.userId).then(load);
                  }
                }}
              >
                <Text style={styles.actionLabel}>{tab === 'blocked' ? 'Unblock' : 'Undo'}</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: colors.surfaceDark,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  tabActive: { borderColor: colors.accentDog },
  tabLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textDarkMuted, textAlign: 'center' },
  tabLabelActive: { fontFamily: fonts.bodyBold, color: colors.white },
  list: { padding: 20, gap: 10, paddingBottom: 40 },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.textDarkMuted, textAlign: 'center', paddingVertical: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceDark,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPh: { backgroundColor: colors.borderDark },
  rowText: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  date: { fontFamily: fonts.body, fontSize: 11, color: colors.textDarkFaint },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9999, backgroundColor: '#FFFFFF14' },
  actionLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.white },
});
