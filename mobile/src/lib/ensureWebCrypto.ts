import { getRandomBytes } from 'expo-crypto';

let installed = false;

/** PKCE sign-up needs crypto.getRandomValues; Expo Go on Android SDK 58 lacks ExpoRandom for react-native-get-random-values. */
function installGetRandomValues() {
  const cryptoRef = globalThis.crypto ?? ({} as Crypto);
  if (typeof globalThis.crypto !== 'object') {
    (globalThis as { crypto: Crypto }).crypto = cryptoRef;
  }
  if (typeof cryptoRef.getRandomValues === 'function') return;

  cryptoRef.getRandomValues = <T extends ArrayBufferView>(array: T): T => {
    const bytes = getRandomBytes(array.byteLength);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(bytes);
    return array;
  };
}

/**
 * Supabase PKCE prefers crypto.subtle (SHA-256). Works in a development build
 * via react-native-quick-crypto. Expo Go skips install(); auth may use plain PKCE with a console warning.
 */
export function ensureWebCrypto() {
  if (installed) return;
  installGetRandomValues();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { install } = require('react-native-quick-crypto') as { install: () => void };
    install();
  } catch {
    // Expo Go and Jest: no native quick-crypto.
  }
  installed = true;
}

ensureWebCrypto();
