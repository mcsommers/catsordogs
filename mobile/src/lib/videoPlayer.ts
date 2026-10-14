import type { VideoPlayer } from 'expo-video';
import type { VideoSource } from 'expo-video';

/** Mux signed URLs are HLS (.m3u8). */
export function hlsSource(url: string | null): VideoSource | null {
  if (!url) return null;
  return { uri: url, contentType: 'hls' };
}

export function safePause(player: VideoPlayer) {
  try {
    player.pause();
  } catch {
    // Native player may already be released (e.g. effect cleanup vs hook teardown).
  }
}

export function safePlay(player: VideoPlayer) {
  try {
    player.play();
  } catch {
    // Source may not be ready yet; statusChange handler will retry.
  }
}

export function safeSetMuted(player: VideoPlayer, muted: boolean) {
  try {
    player.muted = muted;
  } catch {
    // Native player may already be released.
  }
}

export function safeTimeUpdateInterval(player: VideoPlayer, seconds: number) {
  try {
    player.timeUpdateEventInterval = seconds;
  } catch {
    // Native player may already be released (e.g. screen pop during cleanup).
  }
}

export function safeRemoveListener(subscription: { remove: () => void }) {
  try {
    subscription.remove();
  } catch {
    // Listener may already be detached with the native player.
  }
}

export function safePlayerTime(player: VideoPlayer): number {
  try {
    return player.currentTime ?? 0;
  } catch {
    return 0;
  }
}

export function safePlayerDuration(player: VideoPlayer, fallbackSeconds: number): number {
  try {
    if (player.duration > 0) return player.duration;
  } catch {
    // Native player may already be released.
  }
  return fallbackSeconds > 0 ? fallbackSeconds : 0;
}
