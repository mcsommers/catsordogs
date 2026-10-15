import { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  cancelMatchRequest,
  declineMatchRequest,
  getConversations,
  getIncomingMatchRequests,
  getOutgoingMatchRequests,
  type ConversationSummary,
  type IncomingMatchRequest,
  type OutgoingMatchRequest,
} from '../../lib/social';
import { signPhotoPaths } from '../../lib/profile';
import { formatOutgoingMatchLine, formatRelativeTime } from '../../lib/format';
import { confirmCancelMatch, confirmDeclineMatch } from '../../components/social/confirmations';
import { CenteredSpinner, PrimaryButton, Screen, styles as ui } from '../../components/ui';
import { colors, fonts } from '../../theme';

type Segment = 'chats' | 'incoming' | 'outgoing';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'chats', label: 'Chats' },
  { key: 'incoming', label: 'Incoming' },
  { key: 'outgoing', label: 'Outgoing' },
];

export default function Matches() {
  const [segment, setSegment] = useState<Segment>('chats');
  const [incoming, setIncoming] = useState<IncomingMatchRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingMatchRequest[]>([]);
  const [chats, setChats] = useState<ConversationSummary[]>([]);
  const [avatars, setAvatars] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [inc, out, conv] = await Promise.all([
      getIncomingMatchRequests(),
      getOutgoingMatchRequests(),
      getConversations(),
    ]);
    setIncoming(inc);
    setOutgoing(out);
    setChats(conv);
    const paths = [...inc, ...out, ...conv]
      .map((r) => ('photoPath' in r ? r.photoPath : null))
      .filter(Boolean) as string[];
    const signed = await signPhotoPaths([...new Set(paths)]);
    setAvatars(signed);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const avatarUri = (path: string | null) => (path ? avatars.get(path) : undefined);
  const peerUnread = (row: ConversationSummary) =>
    row.unreadCount > 0 && !row.lastMessageIsMine ? row.unreadCount : 0;
  const totalUnreadChats = chats.reduce((sum, c) => sum + peerUnread(c), 0);

  if (loading) {
    return (
      <Screen dark edges={['top']}>
        <CenteredSpinner dark />
      </Screen>
    );
  }

  return (
    <Screen dark edges={['top']} flush>
      <View style={styles.header}>
        <Text style={styles.title}>Matches</Text>
        <View style={styles.segments}>
          {SEGMENTS.map(({ key, label }) => (
            <Pressable
              key={key}
              style={[styles.segment, segment === key && styles.segmentActive]}
              onPress={() => setSegment(key)}
            >
              <View style={styles.segmentInner}>
                <Text style={[styles.segmentLabel, segment === key && styles.segmentLabelActive]}>{label}</Text>
                {key === 'chats' && totalUnreadChats > 0 ? (
                  <View style={styles.segmentBadge}>
                    <Text style={styles.segmentBadgeLabel}>
                      {totalUnreadChats > 99 ? '99+' : String(totalUnreadChats)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.white} />}
      >
        {segment === 'incoming' &&
          (incoming.length === 0 ? (
            <Text style={styles.empty}>No incoming requests right now.</Text>
          ) : (
            incoming.map((row) => (
              <View key={row.userId} style={styles.card}>
                <Pressable
                  style={styles.rowTop}
                  onPress={() => router.push({ pathname: '/user/[id]', params: { id: row.userId } })}
                >
                  {avatarUri(row.photoPath) ? (
                    <Image source={{ uri: avatarUri(row.photoPath)! }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]} />
                  )}
                  <View style={styles.rowText}>
                    <Text style={styles.name}>
                      {row.firstName}, {row.age}
                    </Text>
                    <Text style={styles.subline}>
                      {row.questionText
                        ? `Liked your answer to ${row.questionText}`
                        : 'Wants to match with you'}
                    </Text>
                    <Text style={styles.time}>{formatRelativeTime(row.requestedAt)}</Text>
                  </View>
                </Pressable>
                <View style={styles.actions}>
                  <Pressable
                    style={[styles.outlineBtn, { flex: 1 }]}
                    onPress={() =>
                      confirmDeclineMatch(
                        { firstName: row.firstName, gender: row.gender, avatarUri: avatarUri(row.photoPath) },
                        async () => {
                          await declineMatchRequest(row.userId);
                          await load();
                        }
                      )
                    }
                  >
                    <Text style={styles.outlineBtnLabel}>Decline</Text>
                  </Pressable>
                  <PrimaryButton
                    label="View Profile"
                    onPress={() => router.push({ pathname: '/user/[id]', params: { id: row.userId } })}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ))
          ))}

        {segment === 'outgoing' &&
          (outgoing.length === 0 ? (
            <Text style={styles.empty}>No outgoing requests.</Text>
          ) : (
            outgoing.map((row) => (
              <View key={row.userId} style={styles.card}>
                <Pressable
                  style={styles.rowTop}
                  onPress={() => router.push({ pathname: '/user/[id]', params: { id: row.userId } })}
                >
                  {avatarUri(row.photoPath) ? (
                    <Image source={{ uri: avatarUri(row.photoPath)! }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]} />
                  )}
                  <View style={styles.rowText}>
                    <Text style={styles.name}>
                      {row.firstName}, {row.age}
                    </Text>
                    <Text style={styles.subline}>{formatOutgoingMatchLine(row.requestedAt)}</Text>
                  </View>
                </Pressable>
                <View style={styles.actions}>
                  <Pressable
                    style={[styles.outlineBtn, { flex: 1 }]}
                    onPress={() =>
                      confirmCancelMatch(
                        { firstName: row.firstName, gender: row.gender, avatarUri: avatarUri(row.photoPath) },
                        async () => {
                          await cancelMatchRequest(row.userId);
                          await load();
                        }
                      )
                    }
                  >
                    <Text style={styles.outlineBtnLabel}>Cancel Request</Text>
                  </Pressable>
                  <PrimaryButton
                    label="View Profile"
                    onPress={() => router.push({ pathname: '/user/[id]', params: { id: row.userId } })}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ))
          ))}

        {segment === 'chats' &&
          (chats.length === 0 ? (
            <Text style={styles.empty}>No chats yet — match with someone to start talking.</Text>
          ) : (
            chats.map((row) => (
              <Pressable
                key={row.matchId}
                style={styles.chatRow}
                onPress={() => router.push({ pathname: '/chat/[matchId]', params: { matchId: row.matchId } })}
              >
                {avatarUri(row.photoPath) ? (
                  <Image source={{ uri: avatarUri(row.photoPath)! }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]} />
                )}
                <View style={styles.rowText}>
                  <Text style={styles.name}>
                    {row.firstName}, {row.age}
                  </Text>
                  <Text
                    style={[styles.preview, peerUnread(row) > 0 && styles.previewUnread]}
                    numberOfLines={1}
                  >
                    {row.lastMessageBody
                      ? row.lastMessageIsMine
                        ? `You: ${row.lastMessageBody}`
                        : row.lastMessageBody
                      : 'Say hi!'}
                  </Text>
                </View>
                <View style={styles.metaCol}>
                  {row.lastMessageAt ? (
                    <Text style={styles.time}>{formatRelativeTime(row.lastMessageAt)}</Text>
                  ) : null}
                  {peerUnread(row) > 0 ? <View style={styles.unreadDot} /> : null}
                </View>
              </Pressable>
            ))
          ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 16 },
  title: { ...ui.title, color: colors.white },
  segments: {
    flexDirection: 'row',
    backgroundColor: '#00000040',
    borderRadius: 9999,
    padding: 3,
    gap: 4,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 9999, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.accentDog },
  segmentInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segmentLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textDarkMuted },
  segmentLabelActive: { fontFamily: fonts.bodyBold, color: colors.white },
  segmentBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBadgeLabel: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.accentDog },
  list: { paddingHorizontal: 20, paddingBottom: 120, gap: 12 },
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
  chatRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarPlaceholder: { backgroundColor: colors.borderDark },
  rowText: { flex: 1, gap: 4 },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
  subline: { fontFamily: fonts.body, fontSize: 13, color: colors.textDarkMuted, lineHeight: 18 },
  preview: { fontFamily: fonts.body, fontSize: 13, color: colors.textDarkMuted },
  previewUnread: { fontFamily: fonts.bodySemi, color: colors.white },
  metaCol: { alignItems: 'flex-end', gap: 6 },
  time: { fontFamily: fonts.body, fontSize: 11, color: colors.textDarkFaint },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentDog },
  actions: { flexDirection: 'row', gap: 8 },
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
