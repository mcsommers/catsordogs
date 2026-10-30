import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ViewToken,
} from 'react-native';
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { getGate } from '../../lib/api';
import { fetchPlaybackForAnswer, reportAnswerView } from '../../lib/feed';
import {
  fetchUserAnswersPage,
  deleteMyAnswer,
  fetchUserProfile,
  PROFILE_ANSWER_PAGE_SIZE,
  type ProfileAnswer,
} from '../../lib/profile';
import { BackButton, CenteredSpinner } from '../../components/ui';
import { AnswerDetailOverlay } from '../../components/AnswerDetailOverlay';
import { getFollowState } from '../../lib/social';
import type { FeedMatchState } from '../../lib/feed';
import { MoreOptionsMenu, type MoreMenuAction } from '../../components/social/MoreOptionsMenu';
import { confirmDeleteVideo } from '../../components/social/confirmations';
import { toIsoDate } from '../../lib/format';
import { useSocialActions, type SocialSubject } from '../../components/social/useSocialActions';
import {
  hlsSource,
  safePause,
  safeRemoveListener,
  safeSetMuted,
  safeTimeUpdateInterval,
} from '../../lib/videoPlayer';
import { useVideoPlaybackControl } from '../../hooks/useVideoPlaybackControl';
import { useVideoChromeVisibility } from '../../hooks/useVideoChromeVisibility';
import { colors, fonts } from '../../theme';

const GATE_MESSAGE = "Answer today's question to watch other people's videos.";

const EMPTY_SUBJECT = {
  firstName: '',
  age: null as number | null,
  city: null as string | null,
  distanceMiles: null as number | null,
};

function oneParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function numParam(value: string | string[] | undefined): number | null {
  const raw = oneParam(value);
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * 06k Answer detail — unified vertical page scroll (docs/mobile-feed-scroll.md).
 */
export default function AnswerDetailScreen() {
  const params = useLocalSearchParams<{
    answerId: string;
    userId: string;
    firstName?: string;
    age?: string;
    city?: string;
    distanceMiles?: string;
    /** From profile when opening 06k: whether you already follow this person. */
    isFollowed?: string;
  }>();
  const answerId = oneParam(params.answerId);
  const userId = oneParam(params.userId);
  const isSelf = userId === 'self';
  const targetUserId = isSelf ? null : userId ?? null;
  const subjectFromRoute = {
    firstName: oneParam(params.firstName) ?? '',
    age: numParam(params.age),
    city: oneParam(params.city) || null,
    distanceMiles: numParam(params.distanceMiles),
  };
  const { height: windowHeight } = useWindowDimensions();
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const pageHeight = measuredHeight > 0 ? measuredHeight : windowHeight > 0 ? windowHeight : 1;
  const isFocused = useIsFocused();

  const onPageLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && h !== measuredHeight) setMeasuredHeight(h);
  }, [measuredHeight]);

  const [answers, setAnswers] = useState<ProfileAnswer[]>([]);
  const [subject, setSubject] = useState(
    subjectFromRoute.firstName || subjectFromRoute.age != null ? subjectFromRoute : EMPTY_SUBJECT
  );
  const [subjectUserId, setSubjectUserId] = useState<string | null>(null);
  const [subjectGender, setSubjectGender] = useState<string | null>(null);
  const [subjectAvatarUri, setSubjectAvatarUri] = useState<string | null>(null);
  const [isFollowed, setIsFollowed] = useState(() => oneParam(params.isFollowed) === '1');
  const [acceptsFollowers, setAcceptsFollowers] = useState(true);
  const [matchState, setMatchState] = useState<FeedMatchState>('none');
  const [loading, setLoading] = useState(true);
  const [gateOpen, setGateOpen] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [ownMenuOpen, setOwnMenuOpen] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const viewReportedRef = useRef<string | null>(null);
  const listRef = useRef<FlatList<ProfileAnswer>>(null);
  const scrollToIndexRef = useRef(0);
  const updatesAllowedRef = useRef(true);

  const player = useVideoPlayer(hlsSource(playbackUrl), (p) => {
    p.loop = true;
    p.muted = true;
  });

  const activeAnswerId = answers[activeIndex]?.answerId;
  const playback = useVideoPlaybackControl(
    player,
    activeAnswerId,
    isFocused && !!playbackUrl && !playbackError && !loading && answers.length > 0,
  );
  const { chromeVisible, toggleChromeVisibility } = useVideoChromeVisibility(activeAnswerId);

  useEffect(() => {
    safeSetMuted(player, muted);
  }, [muted, player]);

  useFocusEffect(
    useCallback(() => {
      updatesAllowedRef.current = true;
      return () => {
        updatesAllowedRef.current = false;
        playback.pauseForNavigation();
      };
    }, [playback.pauseForNavigation])
  );

  const leaveScreen = useCallback(() => {
    updatesAllowedRef.current = false;
    safePause(player);
    router.back();
  }, [player]);

  const deleteActive = useCallback(
    (target: ProfileAnswer) => {
      confirmDeleteVideo(target.questionDate === toIsoDate(new Date()), async () => {
        try {
          updatesAllowedRef.current = false;
          safePause(player);
          await deleteMyAnswer(target.answerId);
          router.dismissTo('/(tabs)/profile');
        } catch (e) {
          updatesAllowedRef.current = true;
          Alert.alert('Could not delete video', (e as Error).message || 'Try again.');
        }
      });
    },
    [player]
  );

  const onOwnMenuSelect = useCallback(
    (action: MoreMenuAction) => {
      if (action === 'delete_video' && answers[activeIndex]) deleteActive(answers[activeIndex]);
    },
    [activeIndex, answers, deleteActive]
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  const refreshFollowState = useCallback(async () => {
    if (isSelf || !targetUserId) return;
    try {
      const fs = await getFollowState(targetUserId);
      setIsFollowed(fs.following);
      setAcceptsFollowers(fs.acceptsFollowers);
    } catch {
      // Keep route or prior state if the check fails.
    }
  }, [isSelf, targetUserId]);

  useFocusEffect(
    useCallback(() => {
      refreshFollowState();
    }, [refreshFollowState])
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [g, profile] = await Promise.all([getGate(), fetchUserProfile(targetUserId)]);
        if (cancelled) return;
        setGateOpen(g.state === 'open');
        if (profile) {
          setSubject({
            firstName: profile.firstName || subjectFromRoute.firstName,
            age: profile.age ?? subjectFromRoute.age,
            city: profile.city ?? subjectFromRoute.city,
            distanceMiles: profile.distanceMiles ?? subjectFromRoute.distanceMiles,
          });
          if (!isSelf && profile.userId) {
            setSubjectUserId(profile.userId);
            setSubjectGender(profile.gender);
            setSubjectAvatarUri(profile.photos[0]?.url ?? null);
            setMatchState((profile.matchState as FeedMatchState) || 'none');
            await refreshFollowState();
          }
        } else {
          setSubject(EMPTY_SUBJECT);
        }
        let offset = 0;
        let found: ProfileAnswer[] = [];
        let total = 0;
        let startIndex = 0;
        while (offset === 0 || (found.length < total && !found.some((a) => a.answerId === answerId))) {
          const page = await fetchUserAnswersPage(targetUserId, offset, PROFILE_ANSWER_PAGE_SIZE);
          if (cancelled) return;
          total = page.totalCount;
          found = [...found, ...page.items];
          const idx = found.findIndex((a) => a.answerId === answerId);
          if (idx >= 0) startIndex = idx;
          if (page.items.length === 0) break;
          offset += page.items.length;
          if (found.some((a) => a.answerId === answerId)) break;
        }
        scrollToIndexRef.current = startIndex >= 0 ? startIndex : 0;
        if (!cancelled) {
          setAnswers(found);
          setActiveIndex(scrollToIndexRef.current);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [answerId, targetUserId, refreshFollowState]);

  useEffect(() => {
    if (loading || answers.length === 0 || !isFocused) return;
    const idx = Math.min(scrollToIndexRef.current, answers.length - 1);
    if (idx <= 0) return;
    const t = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: pageHeight * idx, animated: false });
    });
    return () => cancelAnimationFrame(t);
  }, [loading, answers.length, pageHeight, isFocused]);

  const active = answers[activeIndex] ?? null;

  const socialSubject: SocialSubject | null =
    !isSelf && subjectUserId
      ? {
          userId: subjectUserId,
          firstName: subject.firstName,
          gender: subjectGender,
          avatarUri: subjectAvatarUri,
          isFollowed,
          matchState,
          answerId: active?.answerId ?? answerId,
          surface: 'answer',
        }
      : null;

  const social = useSocialActions(socialSubject, {
    onStateChange: (_userId, patch) => {
      if (patch.isFollowed != null) setIsFollowed(patch.isFollowed);
      if (patch.matchState != null) setMatchState(patch.matchState);
    },
    onBlocked: () => leaveScreen(),
    onNotInterested: () => leaveScreen(),
  });

  const openSubjectProfile = useCallback(() => {
    if (isSelf || !subjectUserId) return;
    router.push({ pathname: '/user/[id]', params: { id: subjectUserId } });
  }, [isSelf, subjectUserId]);

  useEffect(() => {
    if (!active || active.status !== 'live') {
      setPlaybackUrl(null);
      setPlaybackError(active?.status !== 'live' ? 'This answer is not available.' : null);
      return;
    }
    if (!isSelf && !gateOpen) {
      setPlaybackUrl(null);
      setPlaybackError(GATE_MESSAGE);
      return;
    }
    setPlaybackError(null);
    let cancelled = false;
    (async () => {
      try {
        const urls = await fetchPlaybackForAnswer(active.answerId);
        if (!cancelled && updatesAllowedRef.current) setPlaybackUrl(urls.playbackUrl);
      } catch {
        if (!cancelled && updatesAllowedRef.current) {
          setPlaybackUrl(null);
          setPlaybackError(GATE_MESSAGE);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active?.answerId, active?.status, gateOpen, isSelf]);

  useEffect(() => {
    if (!isFocused || !playbackUrl || !active) {
      setVideoProgress(0);
      return;
    }
    const syncProgress = () => {
      if (!updatesAllowedRef.current) return;
      const dur = active.durationSeconds || 1;
      setVideoProgress((player.currentTime ?? 0) / dur);
    };
    safeTimeUpdateInterval(player, 0.25);
    syncProgress();
    viewReportedRef.current = null;
    const onTime = player.addListener('timeUpdate', syncProgress);
    const onStatus = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') syncProgress();
    });
    const tick = setInterval(syncProgress, 250);
    return () => {
      safeRemoveListener(onTime);
      safeRemoveListener(onStatus);
      clearInterval(tick);
      safeTimeUpdateInterval(player, 0);
    };
  }, [playbackUrl, active?.answerId, active?.durationSeconds, player, active, isFocused]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (!updatesAllowedRef.current) return;
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.index != null) setActiveIndex(first.index);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const viewabilityConfigCallbackPairs = useRef([{ viewabilityConfig, onViewableItemsChanged }]).current;

  const renderRow = useCallback(
    ({ item, index }: { item: ProfileAnswer; index: number }) => {
      const isActive = index === activeIndex;
      return (
        <View style={{ height: pageHeight }} pointerEvents="box-none">
          {isActive && !playbackError ? (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={toggleChromeVisibility}
              accessibilityLabel={chromeVisible ? 'Hide video controls' : 'Show video controls'}
              accessibilityRole="button"
            />
          ) : null}
          <AnswerDetailOverlay
            answer={item}
            subject={subject}
            avatarUrl={subjectAvatarUri}
            muted={muted}
            onToggleMute={toggleMute}
            onBack={leaveScreen}
            onOpenProfile={isSelf ? undefined : openSubjectProfile}
            onMoreOptions={isSelf ? () => setOwnMenuOpen(true) : social.openMenu}
            onHeart={isSelf ? () => {} : social.onHeartPress}
            hideHeart={isSelf}
            isFollowed={!isSelf && isFollowed}
            matchState={isSelf ? 'none' : matchState}
            videoProgress={isActive ? videoProgress : 0}
            showProgress={isActive}
            playbackError={isActive ? playbackError : null}
            isPlaying={isActive ? playback.isPlaying : false}
            onTogglePlayPause={playback.togglePlayPause}
            chromeVisible={isActive ? chromeVisible : true}
          />
        </View>
      );
    },
    [
      activeIndex,
      isFollowed,
      isSelf,
      leaveScreen,
      matchState,
      muted,
      openSubjectProfile,
      pageHeight,
      playbackError,
      social.onHeartPress,
      social.openMenu,
      subject,
      subjectAvatarUri,
      toggleMute,
      videoProgress,
      playback.isPlaying,
      playback.togglePlayPause,
      chromeVisible,
      toggleChromeVisibility,
      playbackError,
    ]
  );

  const reportViewIfNeeded = useCallback(() => {
    if (!updatesAllowedRef.current || !active || viewReportedRef.current === active.answerId) return;
    reportAnswerView(active.answerId).then((counted) => {
      if (counted) viewReportedRef.current = active.answerId;
    });
  }, [active]);

  useEffect(() => {
    if (!isFocused || !active || loading || answers.length === 0) return;
    reportViewIfNeeded();
  }, [isFocused, active?.answerId, loading, answers.length, reportViewIfNeeded]);

  const showVideo = isFocused && !!playbackUrl && !loading && answers.length > 0;

  const videoBackdrop = showVideo ? (
    <VideoView
      player={player}
      style={[StyleSheet.absoluteFill, styles.videoLayer]}
      contentFit="cover"
      nativeControls={false}
      surfaceType={Platform.OS === 'android' ? 'textureView' : undefined}
      pointerEvents="none"
    />
  ) : (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} pointerEvents="none" />
  );

  if (loading) {
    return (
      <View style={styles.root}>
        <CenteredSpinner dark />
      </View>
    );
  }

  if (answers.length === 0) {
    return (
      <View style={[styles.root, styles.centered]}>
        <BackButton onPress={leaveScreen} dark />
        <Text style={styles.emptyText}>This answer is not available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root} onLayout={onPageLayout}>
      {!isSelf ? (
        <MoreOptionsMenu
          visible={social.menuOpen}
          isFollowed={isFollowed}
          acceptsFollowers={acceptsFollowers}
          firstName={subject.firstName}
          age={subject.age}
          avatarUri={subjectAvatarUri}
          onDismiss={social.closeMenu}
          onSelect={social.runMenuAction}
        />
      ) : (
        <MoreOptionsMenu
          own
          visible={ownMenuOpen}
          isFollowed={false}
          firstName={subject.firstName}
          age={subject.age}
          avatarUri={subjectAvatarUri}
          onDismiss={() => setOwnMenuOpen(false)}
          onSelect={onOwnMenuSelect}
        />
      )}
      {videoBackdrop}
      {answers.length === 1 ? (
        renderRow({ item: answers[0], index: 0 })
      ) : (
        <FlatList
          ref={listRef}
          data={answers}
          keyExtractor={(a) => a.answerId}
          style={StyleSheet.absoluteFill}
          pagingEnabled
          bounces={false}
          getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
          viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
          renderItem={renderRow}
          extraData={subject}
          showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={reportViewIfNeeded}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  emptyText: { fontFamily: fonts.body, fontSize: 15, color: colors.textDarkMuted, textAlign: 'center' },
  videoLayer: { zIndex: 0 },
});
