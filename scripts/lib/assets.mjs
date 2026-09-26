import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { renderProfileSvg } from './profile-svg.mjs';

export async function writeProfileAssets(root, snapshot, history) {
  await mkdir(resolve(root, 'assets'), { recursive: true });
  for (const theme of ['light', 'dark']) {
    for (const compact of [false, true]) {
      const svg = renderProfileSvg(snapshot, history, { compact, theme });
      const name = `public-builder-profile${compact ? '-mobile' : ''}${theme === 'dark' ? '-dark' : ''}`;
      const svgPath = resolve(root, 'assets', `${name}.svg`);
      await writeFile(svgPath, `${svg}\n`);
      execFileSync('rsvg-convert', [svgPath, '-o', resolve(root, 'assets', `${name}.png`)], { stdio: 'inherit' });
    }
  }
}
