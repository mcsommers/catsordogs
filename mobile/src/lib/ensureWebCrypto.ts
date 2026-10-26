import {
  CryptoDigestAlgorithm,
  digest as expoDigest,
  getRandomValues as expoGetRandomValues,
} from 'expo-crypto';

let installed = false;

function algorithmToExpo(algorithm: AlgorithmIdentifier): CryptoDigestAlgorithm {
  const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
  switch (name) {
    case 'SHA-256':
      return CryptoDigestAlgorithm.SHA256;
    case 'SHA-384':
      return CryptoDigestAlgorithm.SHA384;
    case 'SHA-512':
      return CryptoDigestAlgorithm.SHA512;
    default:
      throw new Error(`Unsupported digest algorithm: ${name}`);
  }
}

function bufferSourceToUint8Array(data: BufferSource): Uint8Array {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

/** Supabase PKCE needs crypto.getRandomValues and crypto.subtle.digest (SHA-256). */
function installWebCryptoPolyfill() {
  const cryptoRef = globalThis.crypto ?? ({} as Crypto);
  if (typeof globalThis.crypto !== 'object') {
    (globalThis as { crypto: Crypto }).crypto = cryptoRef;
  }

  if (typeof cryptoRef.getRandomValues !== 'function') {
    cryptoRef.getRandomValues = expoGetRandomValues;
  }

  const subtle = cryptoRef.subtle ?? ({} as SubtleCrypto);
  if (typeof cryptoRef.subtle !== 'object') {
    (cryptoRef as Crypto).subtle = subtle;
  }

  if (typeof subtle.digest !== 'function') {
    subtle.digest = async (algorithm, data) => {
      const algo = algorithmToExpo(algorithm);
      const bytes = bufferSourceToUint8Array(data);
      return expoDigest(algo, bytes);
    };
  }
}

export function ensureWebCrypto() {
  if (installed) return;
  installWebCryptoPolyfill();
  installed = true;
}

ensureWebCrypto();
