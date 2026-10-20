import type { APIRoute } from 'astro';

/**
 * Android App Links. Set PUBLIC_ANDROID_SHA256_CERT_FINGERPRINTS in Cloudflare Pages
 * (comma-separated SHA-256 cert fingerprints from Play Console or `eas credentials`).
 */
export const GET: APIRoute = () => {
  const raw = import.meta.env.PUBLIC_ANDROID_SHA256_CERT_FINGERPRINTS ?? '';
  const fingerprints = raw
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  const body =
    fingerprints.length === 0
      ? []
      : [
          {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
              namespace: 'android_app',
              package_name: 'net.catsordogs.app',
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ];
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
};
