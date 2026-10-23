import { pauseFeedPlaybackBeforeNavigation } from './feedPlaybackCoordinator';

/** Pause feed video and wait for the UI thread before router.push (reduces expo-video crash on cold start from push). */
export function runNavigationAction(action: () => void): void {
  pauseFeedPlaybackBeforeNavigation();
  const run = () => {
    requestAnimationFrame(() => {
      action();
    });
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => run());
  } else {
    setTimeout(run, 0);
  }
}
