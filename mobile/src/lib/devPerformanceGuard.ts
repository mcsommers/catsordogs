/**
 * Development only. In dev mode, React records a "performance measure" for components as they
 * render. On a busy screen (for example Review while captions are generating) that buffer can run
 * the JavaScript engine out of memory ("std::bad_alloc"), which then shows up as
 * "Should not already be working" and the app restarts in Expo Go. Those measures are only for
 * React's own developer tooling, so skip them. Production builds never run this code.
 */
if (__DEV__) {
  const perf = (globalThis as { performance?: { measure?: (...args: unknown[]) => unknown } }).performance;
  if (perf && typeof perf.measure === 'function') {
    perf.measure = () => undefined;
  }
}

export {};
