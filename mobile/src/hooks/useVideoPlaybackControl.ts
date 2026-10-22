import { useCallback, useEffect, useState } from 'react';
import type { VideoPlayer } from 'expo-video';
import {
  safePause,
  safePlay,
  safePlayerPlaying,
  safeRemoveListener,
} from '../lib/videoPlayer';

/**
 * User play/pause on feed (06) and answer detail (06k). Resets pause when the active clip changes so the next video autoplays.
 */
export function useVideoPlaybackControl(
  player: VideoPlayer,
  activeClipKey: string | undefined | null,
  shouldPlay: boolean,
) {
  const [userPaused, setUserPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setUserPaused(false);
  }, [activeClipKey]);

  useEffect(() => {
    const sync = () => setIsPlaying(safePlayerPlaying(player));
    sync();
    const sub = player.addListener('playingChange', ({ isPlaying: playing }) => {
      setIsPlaying(playing);
    });
    return () => safeRemoveListener(sub);
  }, [player]);

  useEffect(() => {
    if (shouldPlay && !userPaused) safePlay(player);
    else safePause(player);
  }, [shouldPlay, userPaused, activeClipKey, player]);

  const togglePlayPause = useCallback(() => {
    if (safePlayerPlaying(player)) {
      setUserPaused(true);
      safePause(player);
    } else {
      setUserPaused(false);
      safePlay(player);
    }
  }, [player]);

  const pauseForNavigation = useCallback(() => {
    safePause(player);
  }, [player]);

  return { isPlaying, togglePlayPause, pauseForNavigation };
}
