/** Lets push/deep-link navigation pause feed video before changing screens (avoids expo-video teardown races). */

let pauseFeed: (() => void) | null = null;

export function registerFeedPlaybackPause(handler: () => void): () => void {
  pauseFeed = handler;
  return () => {
    if (pauseFeed === handler) pauseFeed = null;
  };
}

export function pauseFeedPlaybackBeforeNavigation(): void {
  try {
    pauseFeed?.();
  } catch {
    // Player may already be released.
  }
}
