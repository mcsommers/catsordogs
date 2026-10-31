import { createVideoPlayer, type VideoPlayer } from 'expo-video';
import { hlsSource, safePause, safeRelease } from './videoPlayer';

type PoolEntry = { player: VideoPlayer; url: string };

const pool = new Map<string, PoolEntry>();

/**
 * Keep native players only for the active clip and one neighbor.
 * Fast swipe would otherwise accumulate createVideoPlayer instances until Android
 * OOMs (~256MB Java heap) and iOS grows until jetsam.
 */
export const FEED_PLAYER_KEEP_RADIUS = 1;

export function keepFeedPlayerIdsForIndex(
  items: { answerId: string }[],
  activeIndex: number,
  radius: number = FEED_PLAYER_KEEP_RADIUS,
): string[] {
  if (items.length === 0) return [];
  const videoIndex = Math.min(Math.max(0, activeIndex), items.length - 1);
  const start = Math.max(0, videoIndex - radius);
  const end = Math.min(items.length - 1, videoIndex + radius);
  const ids: string[] = [];
  for (let i = start; i <= end; i++) {
    ids.push(items[i].answerId);
  }
  return ids;
}

function disposeEntry(entry: PoolEntry) {
  safePause(entry.player);
  safeRelease(entry.player);
}

/** Reuse native players across row remounts and brief navigation away from the feed. */
export function getFeedPlayer(answerId: string, playbackUrl: string): VideoPlayer {
  const existing = pool.get(answerId);
  if (existing && existing.url === playbackUrl) return existing.player;

  if (existing) {
    disposeEntry(existing);
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

/**
 * Release every cached player that is not in `keepIds`.
 * Call on each active-index change so the pool stays at most three players.
 * When leaving the feed for a profile, keep the current window so back is instant.
 */
export function retainFeedPlayers(keepIds: Iterable<string>): void {
  const keep = keepIds instanceof Set ? keepIds : new Set(keepIds);
  const stale: string[] = [];
  for (const id of pool.keys()) {
    if (!keep.has(id)) stale.push(id);
  }
  for (const id of stale) {
    const entry = pool.get(id);
    if (!entry) continue;
    disposeEntry(entry);
    pool.delete(id);
  }
}

/** Drop cached players after a full feed reload or sign-out. */
export function clearFeedPlayerPool(): void {
  for (const entry of pool.values()) {
    disposeEntry(entry);
  }
  pool.clear();
}
