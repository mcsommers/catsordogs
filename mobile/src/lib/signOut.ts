import { supabase } from './supabase';

/** Resolve once the app is idle (after the screen change), with a time cap so sign-out never hangs. */
function waitForIdle(maxWaitMs = 500): Promise<void> {
  return new Promise<void>((resolve) => {
    const idle = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => unknown })
      .requestIdleCallback;
    if (typeof idle === 'function') {
      idle(() => resolve(), { timeout: maxWaitMs });
    } else {
      setTimeout(resolve, 300);
    }
  });
}

/** Leave signed-in screens before clearing the session so feed video players unmount cleanly (Android). */
export async function signOutToWelcome(router: { replace: (href: string) => void }) {
  router.replace('/welcome');
  await waitForIdle();
  await supabase.auth.signOut();
}
