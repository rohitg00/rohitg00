import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeProfileAssets } from './lib/assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = JSON.parse(await readFile(resolve(root, 'data/public-profile.json'), 'utf8'));
const history = JSON.parse(await readFile(resolve(root, 'data/public-profile-history.json'), 'utf8'));
await writeProfileAssets(root, snapshot, history);
console.log('Rendered desktop/mobile profile PNGs and local SVG intermediates');
