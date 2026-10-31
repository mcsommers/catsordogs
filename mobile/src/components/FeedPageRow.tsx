import { memo, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { VideoView, type VideoPlayer } from 'expo-video';
import { router } from 'expo-router';
import type { FeedItem } from '../lib/feed';
import { reportAnswerView } from '../lib/feed';
import { FEED_PLAYER_KEEP_RADIUS, getFeedPlayer } from '../lib/feedPlayerPool';
import { registerFeedPlaybackPause } from '../lib/feedPlaybackCoordinator';
import {
  safePause,
  safePlayerDuration,
  safePlayerTime,
  safeRemoveListener,
  safeSetMuted,
  safeTimeUpdateInterval,
} from '../lib/videoPlayer';
import { useVideoPlaybackControl } from '../hooks/useVideoPlaybackControl';
import { useVideoChromeVisibility } from '../hooks/useVideoChromeVisibility';
import { FeedOverlay } from './FeedOverlay';

export type FeedPageRowProps = {
  item: FeedItem;
  index: number;
  activeIndex: number;
  pageHeight: number;
  playbackUrl: string | null;
  feedActive: boolean;
  isScreenFocused: boolean;
  muted: boolean;
  minWatchSeconds: number;
  onToggleMute: () => void;
  onBrowse: () => void;
  onSearchQuestions: () => void;
  onFeedSettings: () => void;
  onMoreOptions: () => void;
  onHeart: () => void;
};

type OverlayProps = Pick<
  FeedPageRowProps,
  | 'item'
  | 'muted'
  | 'onBrowse'
  | 'onSearchQuestions'
  | 'onFeedSettings'
  | 'onMoreOptions'
  | 'onHeart'
> & {
  videoProgress: number;
  isPlaying: boolean;
  onToggleMute: () => void;
  onTogglePlayPause: () => void;
  chromeVisible: boolean;
};

function RowOverlay({
  item,
  muted,
  videoProgress,
  isPlaying,
  onToggleMute,
  onTogglePlayPause,
  onBrowse,
  onSearchQuestions,
  onFeedSettings,
  onMoreOptions,
  onHeart,
  chromeVisible,
}: OverlayProps) {
  return (
    <FeedOverlay
      item={item}
      muted={muted}
      onToggleMute={onToggleMute}
      onOpenProfile={() => router.push({ pathname: '/user/[id]', params: { id: item.userId } })}
      onBrowse={onBrowse}
      onSearchQuestions={onSearchQuestions}
      onFeedSettings={onFeedSettings}
      onMoreOptions={onMoreOptions}
      onHeart={onHeart}
      videoProgress={videoProgress}
      isPlaying={isPlaying}
      onTogglePlayPause={onTogglePlayPause}
      chromeVisible={chromeVisible}
    />
  );
}

function FeedVideoLayer({ player }: { player: VideoPlayer }) {
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      surfaceType={Platform.OS === 'android' ? 'textureView' : undefined}
      pointerEvents="none"
    />
  );
}

function ActiveFeedPageRowWithPlayer(props: FeedPageRowProps & { playbackUrl: string }) {
  const {
    item,
    pageHeight,
    playbackUrl,
    feedActive,
    isScreenFocused,
    muted,
    minWatchSeconds,
    onToggleMute,
    onBrowse,
    onSearchQuestions,
    onFeedSettings,
    onMoreOptions,
    onHeart,
  } = props;

  const player = getFeedPlayer(item.answerId, playbackUrl);
  const shouldPlay = feedActive && isScreenFocused;
  const playback = useVideoPlaybackControl(player, item.answerId, shouldPlay);
  const { chromeVisible, toggleChromeVisibility } = useVideoChromeVisibility(item.answerId);

  const [videoProgress, setVideoProgress] = useState(0);
  const viewReportedRef = useRef<string | null>(null);

  useEffect(() => {
    safeSetMuted(player, muted);
  }, [muted, player]);

  useEffect(() => {
    return registerFeedPlaybackPause(playback.pauseForNavigation);
  }, [playback.pauseForNavigation]);

  useEffect(() => {
    viewReportedRef.current = null;

    const sync = () => {
      if (!feedActive) return;
      const t = safePlayerTime(player);
      const dur = safePlayerDuration(player, item.durationSeconds);
      setVideoProgress(dur > 0 ? Math.min(1, t / dur) : 0);
      if (t >= minWatchSeconds && viewReportedRef.current !== item.answerId) {
        viewReportedRef.current = item.answerId;
        reportAnswerView(item.answerId);
      }
    };

    safeTimeUpdateInterval(player, 0.1);
    sync();
    const onTime = player.addListener('timeUpdate', sync);
    const onStatus = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') sync();
    });
    const tick = setInterval(sync, 250);

    return () => {
      safeRemoveListener(onTime);
      safeRemoveListener(onStatus);
      clearInterval(tick);
      safeTimeUpdateInterval(player, 0);
    };
  }, [player, playbackUrl, item.answerId, item.durationSeconds, minWatchSeconds, feedActive]);

  return (
    <View style={{ height: pageHeight }} pointerEvents="box-none">
      <FeedVideoLayer player={player} />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={toggleChromeVisibility}
        accessibilityLabel={chromeVisible ? 'Hide video controls' : 'Show video controls'}
        accessibilityRole="button"
      />
      <RowOverlay
        item={item}
        muted={muted}
        videoProgress={videoProgress}
        isPlaying={playback.isPlaying}
        onToggleMute={onToggleMute}
        onTogglePlayPause={playback.togglePlayPause}
        chromeVisible={chromeVisible}
        onBrowse={onBrowse}
        onSearchQuestions={onSearchQuestions}
        onFeedSettings={onFeedSettings}
        onMoreOptions={onMoreOptions}
        onHeart={onHeart}
      />
    </View>
  );
}

function ActiveFeedPageRow(props: FeedPageRowProps) {
  if (!props.playbackUrl) {
    return <ChromeFeedPageRow {...props} />;
  }
  return <ActiveFeedPageRowWithPlayer {...props} playbackUrl={props.playbackUrl} />;
}

function PreloadFeedPageRow(props: FeedPageRowProps) {
  const {
    item,
    pageHeight,
    playbackUrl,
    muted,
    onBrowse,
    onSearchQuestions,
    onFeedSettings,
    onToggleMute,
    onMoreOptions,
    onHeart,
  } = props;

  const player = playbackUrl ? getFeedPlayer(item.answerId, playbackUrl) : null;

  useEffect(() => {
    if (!player) return;
    safeSetMuted(player, true);
    safePause(player);
  }, [player]);

  return (
    <View style={{ height: pageHeight }} pointerEvents="box-none">
      {player ? <FeedVideoLayer player={player} /> : <View style={[StyleSheet.absoluteFill, styles.placeholder]} />}
      <RowOverlay
        item={item}
        muted={muted}
        videoProgress={0}
        isPlaying={false}
        onToggleMute={onToggleMute}
        onTogglePlayPause={() => {}}
        chromeVisible
        onBrowse={onBrowse}
        onSearchQuestions={onSearchQuestions}
        onFeedSettings={onFeedSettings}
        onMoreOptions={onMoreOptions}
        onHeart={onHeart}
      />
    </View>
  );
}

function ChromeFeedPageRow(props: FeedPageRowProps) {
  const {
    item,
    pageHeight,
    muted,
    onToggleMute,
    onBrowse,
    onSearchQuestions,
    onFeedSettings,
    onMoreOptions,
    onHeart,
  } = props;

  return (
    <View style={{ height: pageHeight }} pointerEvents="box-none">
      <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
      <RowOverlay
        item={item}
        muted={muted}
        videoProgress={0}
        isPlaying={false}
        onToggleMute={onToggleMute}
        onTogglePlayPause={() => {}}
        chromeVisible
        onBrowse={onBrowse}
        onSearchQuestions={onSearchQuestions}
        onFeedSettings={onFeedSettings}
        onMoreOptions={onMoreOptions}
        onHeart={onHeart}
      />
    </View>
  );
}

function FeedPageRowInner(props: FeedPageRowProps) {
  // VideoViews only for the active clip ± 1; the pool releases anything outside this window.
  const inRadius = Math.abs(props.index - props.activeIndex) <= FEED_PLAYER_KEEP_RADIUS;
  if (props.index === props.activeIndex) {
    return <ActiveFeedPageRow {...props} />;
  }
  if (inRadius && props.playbackUrl) {
    return <PreloadFeedPageRow {...props} />;
  }
  return <ChromeFeedPageRow {...props} />;
}

export const FeedPageRow = memo(FeedPageRowInner);

const styles = StyleSheet.create({
  placeholder: { backgroundColor: '#000' },
});
