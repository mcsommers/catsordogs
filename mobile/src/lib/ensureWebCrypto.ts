import 'react-native-get-random-values';

let installed = false;

/**
 * Supabase PKCE prefers crypto.subtle (SHA-256). Works in a development build
 * via react-native-quick-crypto. Expo Go has no that native module; install()
 * is skipped and Supabase logs a one-time warning but sign-up still works.
 */
export function ensureWebCrypto() {
  if (installed) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { install } = require('react-native-quick-crypto') as { install: () => void };
    install();
    installed = true;
  } catch {
    // Expo Go and Jest: no native quick-crypto.
  }
}

ensureWebCrypto();
