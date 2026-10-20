/**
 * Writes Apple / Android app-link files into public/.well-known for static deploy.
 * Cloudflare Pages: set PUBLIC_IOS_TEAM_ID (and optional Android fingerprints) on the marketing project.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'public', '.well-known');
fs.mkdirSync(dir, { recursive: true });

const teamId = (process.env.PUBLIC_IOS_TEAM_ID ?? 'TEAMID').trim();
const aasa = {
  applinks: {
    apps: [],
    details: [
      {
        appID: `${teamId}.net.catsordogs.app`,
        paths: ['/question', '/matches', '/notifications', '/chat/*', '/user/*'],
      },
    ],
  },
};
fs.writeFileSync(path.join(dir, 'apple-app-site-association'), JSON.stringify(aasa));

const fingerprints = (process.env.PUBLIC_ANDROID_SHA256_CERT_FINGERPRINTS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const assetlinks =
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
fs.writeFileSync(path.join(dir, 'assetlinks.json'), JSON.stringify(assetlinks));

if (teamId === 'TEAMID') {
  console.warn(
    'generate-well-known: PUBLIC_IOS_TEAM_ID is not set; apple-app-site-association uses TEAMID placeholder.',
  );
}
