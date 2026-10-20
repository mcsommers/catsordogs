import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Bell, BellOff, Flag, HeartOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getConversations,
  getMessages,
  markConversationRead,
  reportMessage,
  sendMessage,
  setActiveChat,
  setConversationMuted,
  blockUser,
  unmatchUser,
  type ChatMessage,
} from '../../lib/social';
import { setLocalActiveChatMatchId } from '../../lib/activeChatPresence';
import { signPhotoPaths } from '../../lib/profile';
import { supabase } from '../../lib/supabase';
import { useMatchesAlert } from '../../lib/matchesAlertContext';
import { useSession } from '../../lib/session';
import { BackButton, CenteredSpinner, Screen } from '../../components/ui';
import {
  confirmMuteChat,
  confirmReportMessage,
  confirmUnmatch,
} from '../../components/social/confirmations';
import { newMatchChatIntro, unmatchedChatNotice } from '../../components/social/socialCopy';
import { colors, fonts } from '../../theme';

/** Matches `composer.paddingTop` — gap from separator to field and from field to keyboard. */
const COMPOSER_EDGE_PAD = 8;

export default function ChatScreen() {
  const { matchId, justMatched } = useLocalSearchParams<{ matchId: string; justMatched?: string }>();
  const { session } = useSession();
  const { refreshMatchesAlert } = useMatchesAlert();
  const insets = useSafeAreaInsets();
  const me = session?.user.id;
  const [peerName, setPeerName] = useState('');
  const [peerAge, setPeerAge] = useState(0);
  const [peerCity, setPeerCity] = useState<string | null>(null);
  const [peerUserId, setPeerUserId] = useState('');
  const [peerAvatarUri, setPeerAvatarUri] = useState<string | undefined>();
  const [muted, setMuted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showMatchIntro, setShowMatchIntro] = useState(justMatched === '1');
  const [closed, setClosed] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const scrollToLatest = useCallback((animated = false) => {
    const run = () => listRef.current?.scrollToEnd({ animated });
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
  }, []);

  useEffect(() => {
    const onShow = (e: { endCoordinates: { height: number; screenY: number } }) => {
      if (Platform.OS === 'android') {
        const screenHeight = Dimensions.get('screen').height;
        const fromTop = Math.max(0, screenHeight - e.endCoordinates.screenY);
        setKeyboardHeight(Math.max(e.endCoordinates.height, fromTop));
        return;
      }
      const windowHeight = Dimensions.get('window').height;
      setKeyboardHeight(Math.max(0, windowHeight - e.endCoordinates.screenY));
    };
    const onHide = () => setKeyboardHeight(0);
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (keyboardHeight <= 0) return;
    scrollToLatest(true);
  }, [keyboardHeight, scrollToLatest]);

  const keyboardOpen = keyboardHeight > 0;
  const composerBottomPad = keyboardOpen ? COMPOSER_EDGE_PAD : insets.bottom + COMPOSER_EDGE_PAD;
  const iosKeyboardLift = Platform.OS === 'ios' && keyboardOpen ? keyboardHeight : 0;
  const androidKeyboardLift = Platform.OS === 'android' && keyboardOpen ? keyboardHeight : 0;

  const loadMeta = useCallback(async () => {
    const conv = await getConversations();
    const row = conv.find((c) => c.matchId === matchId);
    if (row) {
      setPeerName(row.firstName);
      setPeerAge(row.age);
      setPeerCity(row.city);
      setPeerUserId(row.userId);
      setMuted(row.muted);
      setClosed(row.closed);
      if (row.photoPath) {
        const signed = await signPhotoPaths([row.photoPath]);
        setPeerAvatarUri(signed.get(row.photoPath));
      } else {
        setPeerAvatarUri(undefined);
      }
    }
  }, [matchId]);

  const loadMessages = useCallback(async () => {
    const rows = await getMessages(matchId);
    setMessages(rows);
  }, [matchId]);

  const syncThread = useCallback(async () => {
    await loadMessages();
    await markConversationRead(matchId);
    await refreshMatchesAlert();
  }, [loadMessages, matchId, refreshMatchesAlert]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadMeta(), syncThread()]);
        setUnavailable(false);
      } catch {
        setUnavailable(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadMeta, syncThread]);

  useEffect(() => {
    if (loading || messages.length === 0) return;
    scrollToLatest(false);
  }, [loading, messages.length, matchId, scrollToLatest]);

  useFocusEffect(
    useCallback(() => {
      if (loading) return;
      void syncThread()
        .then(() => scrollToLatest(false))
        .catch(() => {});
    }, [loading, syncThread, scrollToLatest])
  );

  const pingActiveChat = useCallback(() => {
    if (!matchId) return;
    setLocalActiveChatMatchId(matchId);
    void setActiveChat(matchId).catch(() => {});
  }, [matchId]);

  const clearActiveChat = useCallback(() => {
    setLocalActiveChatMatchId(null);
    void setActiveChat(null).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!matchId) return;
      pingActiveChat();
      const heartbeat = setInterval(pingActiveChat, 45_000);
      const appSub = AppState.addEventListener('change', (state) => {
        if (state === 'active') pingActiveChat();
        else clearActiveChat();
      });
      return () => {
        clearInterval(heartbeat);
        appSub.remove();
        clearActiveChat();
      };
    }, [matchId, pingActiveChat, clearActiveChat])
  );

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const msg: ChatMessage = {
            id: String(row.id),
            senderId: String(row.sender_id),
            kind: String(row.kind),
            body: String(row.body ?? ''),
            createdAt: String(row.created_at),
          };
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          scrollToLatest(true);
          if (msg.senderId !== me) {
            void markConversationRead(matchId)
              .then(() => refreshMatchesAlert())
              .catch(() => {});
          }
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, me, scrollToLatest]);

  const lastPeerMessage = [...messages].reverse().find((m) => m.senderId !== me);

  const threadEmptyWithIntro = messages.length === 0 && showMatchIntro && peerName;

  const onSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const sent = await sendMessage(matchId, body);
      setDraft('');
      setMessages((prev) => [
        ...prev,
        { id: sent.id, senderId: me!, kind: 'text', body, createdAt: sent.createdAt },
      ]);
      setShowMatchIntro(false);
      await markConversationRead(matchId);
      await refreshMatchesAlert();
      scrollToLatest(true);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Screen dark>
        <CenteredSpinner dark />
      </Screen>
    );
  }

  if (unavailable) {
    return (
      <Screen dark edges={['top']}>
        <BackButton onPress={() => router.back()} dark />
        <Text style={styles.unavailable}>This conversation is no longer available.</Text>
      </Screen>
    );
  }

  return (
    <Screen dark flush edges={['top']}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <BackButton onPress={() => router.back()} dark />
        <Pressable
          style={styles.headerIdentity}
          onPress={() => peerUserId && router.push({ pathname: '/user/[id]', params: { id: peerUserId } })}
          accessibilityRole="button"
          accessibilityLabel={peerName ? `View ${peerName}'s profile` : 'View profile'}
        >
          {peerAvatarUri ? (
            <Image source={{ uri: peerAvatarUri }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]} />
          )}
          <View style={styles.headerTextCol}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {peerName ? (peerAge > 0 ? `${peerName}, ${peerAge}` : peerName) : 'Chat'}
            </Text>
            {peerCity ? (
              <Text style={styles.headerLocation} numberOfLines={1}>{peerCity}</Text>
            ) : null}
          </View>
        </Pressable>
        {closed ? null : (
        <View style={styles.headerActions}>
          <Pressable
            style={styles.iconBtn}
            onPress={() =>
              confirmUnmatch(
                { firstName: peerName, avatarUri: peerAvatarUri },
                async () => {
                  await unmatchUser(peerUserId);
                  router.back();
                },
                async () => {
                  await blockUser(peerUserId);
                  router.back();
                },
              )
            }
            accessibilityLabel="Unmatch"
          >
            <HeartOff size={16} color={colors.white} />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => {
              if (!lastPeerMessage) return;
              confirmReportMessage(
                { firstName: peerName, avatarUri: peerAvatarUri },
                async () => {
                  await reportMessage(lastPeerMessage.id);
                },
                async () => {
                  await reportMessage(lastPeerMessage.id);
                  await blockUser(peerUserId);
                  router.back();
                },
              );
            }}
            accessibilityLabel="Report message"
          >
            <Flag size={16} color={colors.white} />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => {
              if (muted) {
                void setConversationMuted(matchId, false).then(() => setMuted(false));
                return;
              }
              confirmMuteChat({ firstName: peerName, avatarUri: peerAvatarUri }, async () => {
                await setConversationMuted(matchId, true);
                setMuted(true);
              });
            }}
            accessibilityLabel={muted ? 'Unmute chat' : 'Mute chat'}
          >
            {muted ? <BellOff size={16} color={colors.white} /> : <Bell size={16} color={colors.white} />}
          </Pressable>
        </View>
        )}
      </View>

      <View style={[styles.flex, iosKeyboardLift > 0 && { paddingBottom: iosKeyboardLift }]}>
        <FlatList
          ref={listRef}
          style={styles.flex}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={[
            styles.thread,
            threadEmptyWithIntro ? styles.threadIntroOnly : styles.threadAnchoredBottom,
          ]}
          ListHeaderComponent={
            showMatchIntro && peerName && !closed
              ? () => (
                  <View style={styles.matchIntro}>
                    <Text style={styles.matchIntroText}>{newMatchChatIntro(peerName)}</Text>
                  </View>
                )
              : undefined
          }
          ListFooterComponent={
            closed && peerName
              ? () => (
                  <View style={styles.matchIntro}>
                    <Text style={styles.matchIntroText}>{unmatchedChatNotice(peerName)}</Text>
                  </View>
                )
              : undefined
          }
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollToLatest(false)}
          onLayout={() => scrollToLatest(false)}
          renderItem={({ item }) => {
            const mine = item.senderId === me;
            return (
              <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={styles.bubbleText}>{item.body}</Text>
                </View>
              </View>
            );
          }}
        />
        {closed ? null : (
        <View
          style={[
            styles.composer,
            { paddingBottom: composerBottomPad },
            androidKeyboardLift > 0 && { marginBottom: androidKeyboardLift },
          ]}
        >
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Message…"
            placeholderTextColor={colors.textDarkFaint}
            multiline
            maxLength={1000}
          />
          <Pressable style={[styles.sendBtn, !draft.trim() && styles.sendDisabled]} onPress={onSend} disabled={!draft.trim() || sending}>
            <Text style={styles.sendLabel}>Send</Text>
          </Pressable>
        </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  headerIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarPlaceholder: { backgroundColor: colors.surfaceDark },
  headerTextCol: { flex: 1, gap: 1, minWidth: 0 },
  headerTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
  headerLocation: { fontFamily: fonts.body, fontSize: 11, color: colors.textDarkMuted },
  headerActions: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thread: { padding: 16, gap: 8, flexGrow: 1 },
  /** Short threads (and each new message) sit just above the composer, not under the header. */
  threadAnchoredBottom: { justifyContent: 'flex-end' },
  threadIntroOnly: { justifyContent: 'center' },
  matchIntro: {
    paddingHorizontal: 8,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailable: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textDarkMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  matchIntroText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textDarkMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  bubbleWrap: { maxWidth: '82%' },
  bubbleWrapMine: { alignSelf: 'flex-end' },
  bubbleWrapTheirs: { alignSelf: 'flex-start' },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: colors.accentDog },
  bubbleTheirs: { backgroundColor: colors.surfaceDark, borderWidth: 1, borderColor: colors.borderDark },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, color: colors.white, lineHeight: 20 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: COMPOSER_EDGE_PAD,
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.white,
  },
  sendBtn: {
    backgroundColor: colors.accentDog,
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendDisabled: { opacity: 0.4 },
  sendLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
});
