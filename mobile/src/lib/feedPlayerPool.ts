import { createVideoPlayer, type VideoPlayer } from 'expo-video';
import { hlsSource, safePause } from './videoPlayer';

type PoolEntry = { player: VideoPlayer; url: string };

const pool = new Map<string, PoolEntry>();

/** Reuse native players across row remounts and brief navigation away from the feed tab. */
export function getFeedPlayer(answerId: string, playbackUrl: string): VideoPlayer {
  const existing = pool.get(answerId);
  if (existing && existing.url === playbackUrl) return existing.player;

  if (existing) {
    safePause(existing.player);
    pool.delete(answerId);
  }

  const player = createVideoPlayer(hlsSource(playbackUrl));
  player.loop = true;
  player.muted = true;
  pool.set(answerId, { player, url: playbackUrl });
  return player;
}

export function pauseAllFeedPlayers(): void {
  for (const entry of pool.values()) {
    safePause(entry.player);
  }
}

/** Drop cached players after a full feed reload or sign-out. */
export function clearFeedPlayerPool(): void {
  for (const entry of pool.values()) {
    safePause(entry.player);
  }
  pool.clear();
}
