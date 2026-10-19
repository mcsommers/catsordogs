// Vite emits index.html and assets at dist/ root while URLs use base /admin/.
// Cloudflare Pages needs files at dist/admin/ to match those URLs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const adminDir = path.join(dist, 'admin');

fs.mkdirSync(adminDir, { recursive: true });

const index = path.join(dist, 'index.html');
const assets = path.join(dist, 'assets');
if (!fs.existsSync(index)) throw new Error('dist/index.html missing; run vite build first.');
if (!fs.existsSync(assets)) throw new Error('dist/assets missing; run vite build first.');

fs.renameSync(index, path.join(adminDir, 'index.html'));
fs.renameSync(assets, path.join(adminDir, 'assets'));
