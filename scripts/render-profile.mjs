import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderReadme } from './lib/readme.mjs';
import { writeProfileAssets } from './lib/assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = JSON.parse(await readFile(resolve(root, 'data/public-profile.json'), 'utf8'));
const history = JSON.parse(await readFile(resolve(root, 'data/public-profile-history.json'), 'utf8'));
const readmePath = resolve(root, 'README.md');
const readme = await readFile(readmePath, 'utf8');
await writeFile(readmePath, renderReadme(readme, snapshot));
await writeProfileAssets(root, snapshot, history);
console.log('Rendered README.md and desktop/mobile profile SVG/PNG assets');
