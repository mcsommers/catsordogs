import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ViewToken,
} from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { getGate, type Gate } from '../../lib/api';
import {
  fetchAppFeedConfig,
  appendUniqueFeedItems,
  fetchFeedPage,
  fetchPlaybackForAnswer,
  reportAnswerView,
  type FeedItem,
} from '../../lib/feed';
import { shortQuestionDate } from '../../lib/format';
import { FeedEndScreen } from '../../components/FeedEndScreen';
import { FeedOverlay } from '../../components/FeedOverlay';
import { FeedLocked, NoQuestionToday } from '../../components/QuestionStates';
import { CenteredSpinner, PrimaryButton, Screen } from '../../components/ui';
import {
  hlsSource,
  safePause,
  safePlay,
  safePlayerDuration,
  safePlayerTime,
  safeRemoveListener,
  safeSetMuted,
  safeTimeUpdateInterval,
} from '../../lib/videoPlayer';
import { useSession } from '../../lib/session';
import { colors, fonts } from '../../theme';
import { MoreOptionsMenu } from '../../components/social/MoreOptionsMenu';
import { useSocialActions, type SocialSubject } from '../../components/social/useSocialActions';

/**
 * Feed tab (Pencil 06). UX invariant: unified vertical page scroll — see
 * docs/mobile-feed-scroll.md and AGENTS.md rule 6. FeedOverlay must live inside
 * FlatList renderItem; never float a full-screen overlay sibling above the list.
 */
const PAGE_SIZE = 12;
const FEED_END_KEY = '__feed_caught_up__';

export default function Feed() {
  const { session, loading: sessionLoading } = useSession();
  const { date: feedDate, feedReload } = useLocalSearchParams<{ date?: string; feedReload?: string }>();
  const lastFeedReloadRef = useRef<string | undefined>(undefined);
  const { height: windowHeight } = useWindowDimensions();
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const pageHeight = measuredHeight > 0 ? measuredHeight : windowHeight;
  const onFeedLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && h !== measuredHeight) setMeasuredHeight(h);
  }, [measuredHeight]);

  const [gate, setGate] = useState<Gate | null>(null);
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(false);

  const [items, setItems] = useState<FeedItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [feedFailed, setFeedFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [minWatch, setMinWatch] = useState(3);
  const [lookbackDays, setLookbackDays] = useState(7);
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const [dayBanner, setDayBanner] = useState<string | null>(null);
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(() => new Set());
  const loadingMoreRef = useRef(false);
  const loadingFeedRef = useRef(false);
  const feedLoadEpochRef = useRef(0);
  const viewReportedRef = useRef<string | null>(null);
  const flatRef = useRef<FlatList<FeedItem>>(null);

  const listRows = useMemo((): FeedItem[] => {
    if (items.length === 0) return [];
    if (items.length >= totalCount) {
      return [
        ...items,
        {
          answerId: FEED_END_KEY,
          userId: '',
          questionId: '',
          questionDate: '',
          questionText: '',
          firstName: '',
          gender: null,
          age: 0,
          distanceMiles: null,
          city: null,
          captionText: '',
          captionSegments: [],
          durationSeconds: 0,
          isFollowed: false,
          submittedAt: '',
          streakDays: 0,
          matchState: 'none',
        },
      ];
    }
    return items;
  }, [items, totalCount]);

  const onEndPage = items.length > 0 && activeIndex >= items.length;
  const activeItem = !onEndPage ? items[activeIndex] ?? null : null;
  const feedActiveRef = useRef(true);

  const patchFeedUser = useCallback((userId: string, patch: Partial<Pick<FeedItem, 'isFollowed' | 'matchState'>>) => {
    setItems((prev) => prev.map((it) => (it.userId === userId ? { ...it, ...patch } : it)));
  }, []);

  const socialSubject: SocialSubject | null = activeItem
    ? {
        userId: activeItem.userId,
        firstName: activeItem.firstName,
        gender: activeItem.gender,
        avatarUri: activeItem.avatarUrl,
        isFollowed: activeItem.isFollowed,
        matchState: activeItem.matchState,
        answerId: activeItem.answerId,
        surface: 'feed',
      }
    : null;

  const social = useSocialActions(socialSubject, {
    onStateChange: (patch) => {
      if (activeItem) patchFeedUser(activeItem.userId, patch);
    },
    onBlocked: () => {
      if (activeItem) setItems((prev) => prev.filter((it) => it.userId !== activeItem.userId));
    },
    onNotInterested: () => {
      if (activeItem) setItems((prev) => prev.filter((it) => it.userId !== activeItem.userId));
    },
  });

  const openFeedSettings = useCallback(() => router.push('/feed-settings'), []);

  const player = useVideoPlayer(hlsSource(playbackUrl), (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    safeSetMuted(player, muted);
  }, [muted, player]);

  useEffect(() => {
    if (!session) {
      setPlaybackUrl(null);
      safePause(player);
    }
  }, [session, player]);

  useFocusEffect(
    useCallback(() => {
      const shouldPlay = gate?.state === 'open' && !onEndPage && items.length > 0;
      feedActiveRef.current = shouldPlay;
      if (shouldPlay && playbackUrl) safePlay(player);
      else safePause(player);
      return () => {
        feedActiveRef.current = false;
        safePause(player);
      };
    }, [gate?.state, onEndPage, items.length, playbackUrl, player])
  );

  useEffect(() => {
    if (!playbackUrl) return;
    const playIfActive = () => {
      if (feedActiveRef.current) safePlay(player);
    };
    playIfActive();
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') playIfActive();
    });
    return () => safeRemoveListener(sub);
  }, [playbackUrl, player]);

  const loadGate = useCallback(async () => {
    if (!session) return;
    setFailed(false);
    try {
      const g = await getGate();
      setGate(g);
    } catch {
      setFailed(true);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      if (sessionLoading || !session) return;
      loadGate();
    }, [sessionLoading, session, loadGate])
  );

  useEffect(() => {
    if (sessionLoading || !session) return;
    loadGate();
  }, [sessionLoading, session, loadGate]);

  const loadInitialFeed = useCallback(async () => {
    if (!gate || gate.state !== 'open') return;
    const epoch = ++feedLoadEpochRef.current;
    loadingMoreRef.current = false;
    loadingFeedRef.current = true;
    setLoadingFeed(true);
    setFeedFailed(false);
    try {
      const [config, page] = await Promise.all([
        fetchAppFeedConfig(),
        fetchFeedPage(0, PAGE_SIZE, feedDate ?? null),
      ]);
      if (epoch !== feedLoadEpochRef.current) return;
      setMinWatch(config.minWatchSeconds);
      setLookbackDays(config.feedLookbackDays);
      setItems(page.items);
      setTotalCount(page.totalCount);
      setActiveIndex(0);
    } catch {
      if (epoch === feedLoadEpochRef.current) setFeedFailed(true);
    } finally {
      if (epoch === feedLoadEpochRef.current) {
        loadingFeedRef.current = false;
        setLoadingFeed(false);
      }
    }
  }, [gate, feedDate]);

  useEffect(() => {
    loadInitialFeed();
  }, [loadInitialFeed]);

  useEffect(() => {
    if (!feedReload || feedReload === lastFeedReloadRef.current) return;
    lastFeedReloadRef.current = feedReload;
    flatRef.current?.scrollToOffset({ offset: 0, animated: false });
    loadInitialFeed();
  }, [feedReload, loadInitialFeed]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || loadingFeedRef.current || items.length >= totalCount) return;
    const epoch = feedLoadEpochRef.current;
    const offset = items.length;
    loadingMoreRef.current = true;
    try {
      const page = await fetchFeedPage(offset, PAGE_SIZE, feedDate ?? null);
      if (epoch !== feedLoadEpochRef.current) return;
      if (page.items.length > 0) {
        setItems((prev) => appendUniqueFeedItems(prev, page.items));
      }
    } catch {
      // keep what we have
    } finally {
      if (epoch === feedLoadEpochRef.current) loadingMoreRef.current = false;
    }
  }, [items.length, totalCount, feedDate]);

  useEffect(() => {
    if (!activeItem) {
      setPlaybackUrl(null);
      return;
    }
    let cancelled = false;
    setWatchedSeconds(0);
    setVideoProgress(0);
    viewReportedRef.current = null;
    setPlaybackUrl(null);
    fetchPlaybackForAnswer(activeItem.answerId)
      .then((urls) => {
        if (!cancelled) setPlaybackUrl(urls.playbackUrl);
      })
      .catch(() => {
        if (!cancelled) setPlaybackUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeItem?.answerId]);

  useEffect(() => {
    if (!activeItem || !playbackUrl) {
      setVideoProgress(0);
      return;
    }

    const syncPlayback = () => {
      if (!feedActiveRef.current) return;
      const t = safePlayerTime(player);
      const dur = safePlayerDuration(player, activeItem.durationSeconds);
      setWatchedSeconds(t);
      setVideoProgress(dur > 0 ? Math.min(1, t / dur) : 0);
      // Minimum watch is for view counts only — never blocks swiping to the next clip.
      if (t >= minWatch && viewReportedRef.current !== activeItem.answerId) {
        viewReportedRef.current = activeItem.answerId;
        reportAnswerView(activeItem.answerId);
      }
    };

    safeTimeUpdateInterval(player, 0.1);
    syncPlayback();
    const onTime = player.addListener('timeUpdate', syncPlayback);
    const onStatus = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') syncPlayback();
    });
    const tick = setInterval(syncPlayback, 250);

    return () => {
      safeRemoveListener(onTime);
      safeRemoveListener(onStatus);
      clearInterval(tick);
      safeTimeUpdateInterval(player, 0);
      safePause(player);
    };
  }, [activeItem?.answerId, activeItem?.durationSeconds, playbackUrl, minWatch, player]);

  const feedScrollRef = useRef({
    items: items,
    dismissedBanners,
    loadMore,
  });
  feedScrollRef.current = { items, dismissedBanners, loadMore };

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.index == null) return;
    const idx = first.index;
    setActiveIndex(idx);
    const { items: rows, dismissedBanners: dismissed, loadMore: more } = feedScrollRef.current;
    if (idx > 0 && rows[idx] && rows[idx - 1]) {
      const prevDate = rows[idx - 1].questionDate;
      const nextDate = rows[idx].questionDate;
      if (prevDate !== nextDate && !dismissed.has(nextDate)) {
        setDayBanner(shortQuestionDate(nextDate));
      }
    }
    if (idx >= rows.length - 3) more();
  }, []);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const viewabilityConfigCallbackPairs = useRef([
    { viewabilityConfig, onViewableItemsChanged },
  ]).current;

  const renderFeedRow = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.answerId === FEED_END_KEY) {
        return (
          <View style={{ height: pageHeight, backgroundColor: colors.bgDark }}>
            <FeedEndScreen
              lookbackDays={lookbackDays}
              onBrowse={() => router.push('/browse-questions')}
              onFeedSettings={openFeedSettings}
            />
          </View>
        );
      }
      const isActive = item.answerId === activeItem?.answerId;
      return (
        <View style={{ height: pageHeight }} pointerEvents="box-none">
          <FeedOverlay
            item={item}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            onOpenProfile={() => router.push({ pathname: '/user/[id]', params: { id: item.userId } })}
            onBrowse={() => router.push('/browse-questions')}
            onFeedSettings={openFeedSettings}
            onMoreOptions={social.openMenu}
            onHeart={social.onHeartPress}
            showDayBanner={isActive ? dayBanner : null}
            onDismissDayBanner={() => {
              setDismissedBanners((s) => new Set(s).add(item.questionDate));
              setDayBanner(null);
            }}
            videoProgress={isActive ? videoProgress : 0}
          />
        </View>
      );
    },
    [activeItem?.answerId, dayBanner, lookbackDays, muted, openFeedSettings, pageHeight, social.onHeartPress, social.openMenu, videoProgress]
  );

  const showVideo = !!session && !!playbackUrl && gate?.state === 'open';

  if (sessionLoading || !session) return <CenteredSpinner dark />;

  if (failed) {
    return (
      <Screen dark edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.body}>We couldn&apos;t reach the server. Check your connection and try again.</Text>
          <PrimaryButton label="Try Again" onPress={loadGate} style={{ alignSelf: 'stretch' }} />
        </View>
      </Screen>
    );
  }
  if (!gate) return <CenteredSpinner dark />;

  if (gate.state === 'profile_incomplete') return <Redirect href="/build-profile" />;

  if (gate.state === 'no_question_today') {
    return (
      <Screen dark edges={['top']}>
        <NoQuestionToday
          checking={checking}
          onCheckAgain={async () => {
            setChecking(true);
            await loadGate();
            setChecking(false);
          }}
        />
      </Screen>
    );
  }
  if (gate.state === 'not_answered') {
    return (
      <Screen dark edges={['top']}>
        <FeedLocked question={gate.questionText ?? ''} onAnswer={() => router.push('/question')} />
      </Screen>
    );
  }

  if (loadingFeed && items.length === 0) return <CenteredSpinner dark />;

  if (feedFailed) {
    return (
      <Screen dark edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.body}>We couldn&apos;t load the feed. Check your connection and try again.</Text>
          <PrimaryButton label="Try Again" onPress={loadInitialFeed} style={{ alignSelf: 'stretch' }} />
        </View>
      </Screen>
    );
  }

  if (!loadingFeed && items.length === 0) {
    return (
      <Screen dark edges={['top']}>
        <FeedEndScreen
          lookbackDays={lookbackDays}
          onBrowse={() => router.push('/browse-questions')}
          onFeedSettings={openFeedSettings}
        />
      </Screen>
    );
  }

  return (
    <View style={styles.root} onLayout={onFeedLayout}>
      <MoreOptionsMenu
        visible={social.menuOpen}
        isFollowed={activeItem?.isFollowed ?? false}
        onDismiss={social.closeMenu}
        onSelect={social.runMenuAction}
      />
      {showVideo ? (
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
      )}
      <FlatList
        ref={flatRef}
        data={listRows}
        extraData={{ activeId: activeItem?.answerId, muted, videoProgress, dayBanner }}
        keyExtractor={(item) => item.answerId}
        pagingEnabled
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
        bounces={false}
        onEndReached={() => {
          if (items.length < totalCount) loadMore();
        }}
        onEndReachedThreshold={0.6}
        getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
        style={StyleSheet.absoluteFill}
        renderItem={renderFeedRow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  videoLayer: { zIndex: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24, backgroundColor: colors.bgDark },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textDarkMuted, textAlign: 'center' },
});
