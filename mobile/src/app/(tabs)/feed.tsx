import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from 'react-native';
import { Redirect, router, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { getGate, type Gate } from '../../lib/api';
import {
  fetchAppFeedConfig,
  appendUniqueFeedItems,
  fetchFeedPage,
  fetchPlaybackForAnswer,
  type FeedItem,
} from '../../lib/feed';
import { loadFilterPreferencesUpdatedAt } from '../../lib/feedSettings';
import { pauseFeedPlaybackBeforeNavigation, registerFeedPlaybackPause } from '../../lib/feedPlaybackCoordinator';
import { clearFeedPlayerPool, pauseAllFeedPlayers } from '../../lib/feedPlayerPool';
import { FeedEndScreen } from '../../components/FeedEndScreen';
import { FeedPageRow } from '../../components/FeedPageRow';
import { FeedLocked, NoQuestionToday } from '../../components/QuestionStates';
import { CenteredSpinner, PrimaryButton, Screen } from '../../components/ui';
import { useSession } from '../../lib/session';
import { colors, fonts } from '../../theme';
import { MoreOptionsMenu } from '../../components/social/MoreOptionsMenu';
import { useSocialActions, type SocialSubject } from '../../components/social/useSocialActions';

/**
 * Feed tab (Pencil 06). UX invariant: unified vertical page scroll — see
 * docs/mobile-feed-scroll.md and AGENTS.md rule 6. Each row uses FeedPageRow
 * (video + FeedOverlay in renderItem); never float a full-screen overlay sibling above the list.
 */
const PAGE_SIZE = 12;
const FEED_END_KEY = '__feed_caught_up__';
/** Pull-to-refresh spinner sits below the status bar / playback progress chrome. */
const FEED_REFRESH_SPINNER_OFFSET = 50;
/** Prefetch playback URLs for clips near the active row (see FeedPageRow mount radius). */
const PREFETCH_AHEAD = 2;
const PREFETCH_BEHIND = 1;

export default function Feed() {
  const isFocused = useIsFocused();
  const { session, loading: sessionLoading } = useSession();
  const { date: feedDate, feedReload } = useLocalSearchParams<{ date?: string; feedReload?: string }>();
  const lastFeedReloadRef = useRef<string | undefined>(undefined);
  const filtersUpdatedAtRef = useRef<string | null>(null);
  const { height: windowHeight } = useWindowDimensions();
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const pageHeight = measuredHeight > 0 ? measuredHeight : windowHeight;
  const onFeedLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && h !== measuredHeight) setMeasuredHeight(h);
  }, [measuredHeight]);

  const [gate, setGate] = useState<Gate | null>(null);
  const gateRef = useRef<Gate | null>(null);
  gateRef.current = gate;
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(false);

  const [items, setItems] = useState<FeedItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [feedRefreshing, setFeedRefreshing] = useState(false);
  const [feedFailed, setFeedFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playbackUrls, setPlaybackUrls] = useState<Record<string, string>>({});
  const [muted, setMuted] = useState(true);
  const [minWatch, setMinWatch] = useState(3);
  const [lookbackDays, setLookbackDays] = useState(7);
  const loadingMoreRef = useRef(false);
  const loadingFeedRef = useRef(false);
  const feedLoadEpochRef = useRef(0);
  const flatRef = useRef<FlatList<FeedItem>>(null);
  const playbackUrlsRef = useRef(playbackUrls);
  playbackUrlsRef.current = playbackUrls;
  const scrollOffsetRef = useRef(0);
  /** Index when the feed last lost focus (from scroll offset), for return from Question History / settings. */
  const feedIndexOnBlurRef = useRef(0);
  const activeIndexRef = useRef(0);
  const suppressViewabilityRef = useRef(false);
  /** After pull-to-refresh clears a browse `date` param, skip the duplicate load from the param change. */
  const skipFeedDateEffectRef = useRef(false);
  /** `date` query from Question History; used so empty state is spinner until that day finishes loading. */
  const loadedBrowseDateRef = useRef<string | null | undefined>(undefined);

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
          acceptsFollowers: true,
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
    onStateChange: (userId, patch) => {
      patchFeedUser(userId, patch);
    },
    onBlocked: () => {
      if (activeItem) setItems((prev) => prev.filter((it) => it.userId !== activeItem.userId));
    },
    onNotInterested: () => {
      if (activeItem) setItems((prev) => prev.filter((it) => it.userId !== activeItem.userId));
    },
  });

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const feedScrollRef = useRef({ items, pageHeight, listRowCount: 0 });
  feedScrollRef.current = { items, pageHeight, listRowCount: listRows.length };
  const loadMoreRef = useRef<() => void>(() => {});

  const indexForScrollOffset = useCallback((offsetY: number) => {
    const { pageHeight: h, listRowCount } = feedScrollRef.current;
    if (h <= 0) return 0;
    const max = Math.max(0, listRowCount - 1);
    return Math.min(max, Math.max(0, Math.round(offsetY / h)));
  }, []);

  const applyFeedPageIndex = useCallback(
    (idx: number) => {
      const { listRowCount } = feedScrollRef.current;
      const max = Math.max(0, listRowCount - 1);
      const clamped = Math.min(max, Math.max(0, idx));
      feedIndexOnBlurRef.current = clamped;
      activeIndexRef.current = clamped;
      setActiveIndex(clamped);
      const { pageHeight: h } = feedScrollRef.current;
      if (h > 0) scrollOffsetRef.current = clamped * h;
      return clamped;
    },
    [],
  );

  const rememberFeedPage = useCallback(() => {
    const fromScroll = indexForScrollOffset(scrollOffsetRef.current);
    const idx = Math.max(fromScroll, activeIndexRef.current);
    return applyFeedPageIndex(idx);
  }, [applyFeedPageIndex, indexForScrollOffset]);

  const restoreFeedPage = useCallback(() => {
    const { pageHeight: h, listRowCount } = feedScrollRef.current;
    if (h <= 0 || listRowCount === 0) return;
    suppressViewabilityRef.current = true;
    const idx = applyFeedPageIndex(feedIndexOnBlurRef.current);
    requestAnimationFrame(() => {
      flatRef.current?.scrollToOffset({ offset: idx * h, animated: false });
    });
    setTimeout(() => {
      suppressViewabilityRef.current = false;
    }, 400);
  }, [applyFeedPageIndex]);

  const openBrowse = useCallback(() => {
    rememberFeedPage();
    pauseFeedPlaybackBeforeNavigation();
    router.push('/browse-questions');
  }, [rememberFeedPage]);

  const openFeedSettings = useCallback(() => {
    rememberFeedPage();
    pauseFeedPlaybackBeforeNavigation();
    router.push('/feed-settings');
  }, [rememberFeedPage]);

  useFocusEffect(
    useCallback(() => {
      restoreFeedPage();
      return () => {
        feedIndexOnBlurRef.current = activeIndexRef.current;
      };
    }, [restoreFeedPage]),
  );

  const feedPlaybackActive =
    isFocused && !!session && gate?.state === 'open' && !onEndPage && items.length > 0;

  useEffect(() => {
    return registerFeedPlaybackPause(pauseAllFeedPlayers);
  }, []);

  useEffect(() => {
    if (!session) {
      pauseAllFeedPlayers();
      setPlaybackUrls({});
      clearFeedPlayerPool();
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        pauseAllFeedPlayers();
      };
    }, []),
  );

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

  const loadInitialFeed = useCallback(
    async (questionDate?: string | null, options?: { force?: boolean }) => {
      const g = gateRef.current;
      if (!g || g.state !== 'open') return;
      const dateFilter = questionDate !== undefined ? questionDate : (feedDate ?? null);
      const { items: currentItems } = feedScrollRef.current;
      const alreadyLoaded =
        !options?.force &&
        currentItems.length > 0 &&
        loadedBrowseDateRef.current === dateFilter &&
        !feedFailed;
      if (alreadyLoaded) {
        applyFeedPageIndex(indexForScrollOffset(scrollOffsetRef.current));
        return;
      }
      const epoch = ++feedLoadEpochRef.current;
      loadingMoreRef.current = false;
      loadingFeedRef.current = true;
      setLoadingFeed(true);
      setFeedFailed(false);
      try {
        const [config, page] = await Promise.all([
          fetchAppFeedConfig(),
          fetchFeedPage(0, PAGE_SIZE, dateFilter),
        ]);
        if (epoch !== feedLoadEpochRef.current) return;
        setMinWatch(config.minWatchSeconds);
        setLookbackDays(config.feedLookbackDays);
        setItems(page.items);
        setTotalCount(page.totalCount);
        setPlaybackUrls({});
        clearFeedPlayerPool();
        setActiveIndex(0);
        scrollOffsetRef.current = 0;
        feedIndexOnBlurRef.current = 0;
        flatRef.current?.scrollToOffset({ offset: 0, animated: false });
      } catch {
        if (epoch === feedLoadEpochRef.current) setFeedFailed(true);
      } finally {
        if (epoch === feedLoadEpochRef.current) {
          loadingFeedRef.current = false;
          setLoadingFeed(false);
          loadedBrowseDateRef.current = dateFilter;
        }
      }
    },
    [applyFeedPageIndex, feedDate, feedFailed, indexForScrollOffset],
  );

  const refreshTodayFeed = useCallback(async () => {
    if (!gate || gate.state !== 'open') return;
    if (loadingFeedRef.current) return;
    flatRef.current?.scrollToOffset({ offset: 0, animated: false });
    const browsingPastDay = Boolean(feedDate);
    if (browsingPastDay) {
      skipFeedDateEffectRef.current = true;
      router.replace({ pathname: '/(tabs)/feed' });
    }
    await loadInitialFeed(browsingPastDay ? null : undefined, { force: true });
  }, [gate, feedDate, loadInitialFeed]);

  const onPullRefresh = useCallback(async () => {
    setFeedRefreshing(true);
    try {
      await refreshTodayFeed();
    } finally {
      setFeedRefreshing(false);
    }
  }, [refreshTodayFeed]);

  /** Question History passes `date`; clear stale list before paint so Android does not flash the caught-up empty state. */
  useLayoutEffect(() => {
    if (!feedDate) return;
    loadedBrowseDateRef.current = undefined;
    setLoadingFeed(true);
    setFeedFailed(false);
    setItems([]);
    setTotalCount(0);
    setActiveIndex(0);
    scrollOffsetRef.current = 0;
    feedIndexOnBlurRef.current = 0;
    setPlaybackUrls({});
    clearFeedPlayerPool();
    flatRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [feedDate]);

  useEffect(() => {
    if (skipFeedDateEffectRef.current) {
      skipFeedDateEffectRef.current = false;
      return;
    }
    if (gate?.state !== 'open') return;
    loadInitialFeed();
  }, [loadInitialFeed, gate?.state]);

  useEffect(() => {
    if (!feedReload || feedReload === lastFeedReloadRef.current) return;
    lastFeedReloadRef.current = feedReload;
    void refreshTodayFeed();
  }, [feedReload, refreshTodayFeed]);

  useFocusEffect(
    useCallback(() => {
      if (sessionLoading || !session || !gate || gate.state !== 'open') return;
      loadFilterPreferencesUpdatedAt()
        .then((ts) => {
          if (!ts) return;
          if (filtersUpdatedAtRef.current === null) {
            filtersUpdatedAtRef.current = ts;
            return;
          }
          if (ts !== filtersUpdatedAtRef.current) {
            filtersUpdatedAtRef.current = ts;
            flatRef.current?.scrollToOffset({ offset: 0, animated: false });
            loadInitialFeed(undefined, { force: true });
          }
        })
        .catch(() => {});
    }, [sessionLoading, session, gate, loadInitialFeed]),
  );

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

  loadMoreRef.current = loadMore;
  feedScrollRef.current = { items, pageHeight, listRowCount: listRows.length };

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (suppressViewabilityRef.current) return;
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.index == null) return;
    const { items: rows } = feedScrollRef.current;
    const idx = first.index;
    applyFeedPageIndex(idx);
    if (idx >= rows.length - 3) loadMoreRef.current();
  }, [applyFeedPageIndex]);

  const onFeedScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
      applyFeedPageIndex(indexForScrollOffset(e.nativeEvent.contentOffset.y));
    },
    [applyFeedPageIndex, indexForScrollOffset],
  );

  useEffect(() => {
    if (gate?.state !== 'open' || items.length === 0 || onEndPage) return;
    const videoIndex = Math.min(activeIndex, items.length - 1);
    const start = Math.max(0, videoIndex - PREFETCH_BEHIND);
    const end = Math.min(items.length - 1, videoIndex + PREFETCH_AHEAD);
    let cancelled = false;

    for (let i = start; i <= end; i++) {
      const answerId = items[i].answerId;
      if (playbackUrlsRef.current[answerId]) continue;
      fetchPlaybackForAnswer(answerId)
        .then((urls) => {
          if (cancelled) return;
          setPlaybackUrls((prev) =>
            prev[answerId] === urls.playbackUrl ? prev : { ...prev, [answerId]: urls.playbackUrl },
          );
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [activeIndex, items, gate?.state, onEndPage]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const viewabilityConfigCallbackPairs = useRef([
    { viewabilityConfig, onViewableItemsChanged },
  ]).current;

  const toggleMuted = useCallback(() => setMuted((m) => !m), []);

  const renderFeedRow = useCallback(
    ({ item, index }: { item: FeedItem; index: number }) => {
      if (item.answerId === FEED_END_KEY) {
        return (
          <View style={{ height: pageHeight, backgroundColor: colors.bgDark }}>
            <FeedEndScreen
              lookbackDays={lookbackDays}
              onBrowse={openBrowse}
              onFeedSettings={openFeedSettings}
            />
          </View>
        );
      }
      return (
        <FeedPageRow
          item={item}
          index={index}
          activeIndex={activeIndex}
          pageHeight={pageHeight}
          playbackUrl={playbackUrls[item.answerId] ?? null}
          feedActive={feedPlaybackActive}
          isScreenFocused={isFocused}
          muted={muted}
          minWatchSeconds={minWatch}
          onToggleMute={toggleMuted}
          onBrowse={openBrowse}
          onSearchQuestions={openBrowse}
          onFeedSettings={openFeedSettings}
          onMoreOptions={social.openMenu}
          onHeart={social.onHeartPress}
        />
      );
    },
    [
      activeIndex,
      feedPlaybackActive,
      isFocused,
      lookbackDays,
      minWatch,
      muted,
      openBrowse,
      openFeedSettings,
      pageHeight,
      playbackUrls,
      social.onHeartPress,
      social.openMenu,
      toggleMuted,
    ],
  );

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
          <PrimaryButton
            label="Try Again"
            onPress={() => loadInitialFeed(undefined, { force: true })}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      </Screen>
    );
  }

  if (!loadingFeed && items.length === 0) {
    if (feedDate && loadedBrowseDateRef.current !== feedDate) {
      return <CenteredSpinner dark />;
    }
    return (
      <Screen dark edges={['top']}>
        <FeedEndScreen
          lookbackDays={lookbackDays}
          onBrowse={openBrowse}
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
        acceptsFollowers={activeItem?.acceptsFollowers ?? true}
        firstName={activeItem?.firstName ?? ''}
        age={activeItem?.age}
        avatarUri={activeItem?.avatarUrl}
        onDismiss={social.closeMenu}
        onSelect={social.runMenuAction}
      />
      <FlatList
        ref={flatRef}
        data={listRows}
        extraData={{ activeIndex, muted, playbackUrls, items }}
        keyExtractor={(item) => item.answerId}
        pagingEnabled
        // iOS "fast" is a light flick. On Android the same prop sets fling friction
        // about 7x higher than normal, so a short swipe dies and the next video
        // does not load until the finger has been dragged past halfway. Leave
        // Android on the platform default. See docs/mobile-feed-scroll.md.
        {...(Platform.OS === 'ios' ? { decelerationRate: 'fast' as const } : {})}
        showsVerticalScrollIndicator={false}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onFeedScrollEnd}
        onScrollEndDrag={onFeedScrollEnd}
        bounces={activeIndex === 0}
        overScrollMode={activeIndex === 0 ? 'always' : 'never'}
        refreshControl={
          <RefreshControl
            refreshing={feedRefreshing}
            onRefresh={onPullRefresh}
            tintColor={colors.white}
            colors={[colors.accentDog]}
            progressBackgroundColor={colors.bgDark}
            progressViewOffset={FEED_REFRESH_SPINNER_OFFSET}
          />
        }
        onEndReached={() => {
          if (items.length < totalCount) loadMore();
        }}
        onEndReachedThreshold={0.6}
        getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews={Platform.OS === 'android'}
        style={StyleSheet.absoluteFill}
        renderItem={renderFeedRow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24, backgroundColor: colors.bgDark },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textDarkMuted, textAlign: 'center' },
});
