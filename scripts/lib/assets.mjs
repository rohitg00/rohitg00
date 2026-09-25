import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { renderPublicBuilderSvg } from './svg.mjs';
import { renderPublicWorkSvg } from './work-svg.mjs';

export async function writeProfileAssets(root, snapshot, history) {
  await mkdir(resolve(root, 'assets'), { recursive: true });
  for (const theme of ['light', 'dark']) {
    for (const compact of [false, true]) {
      const sections = [
        ['public-builder-rank', renderPublicBuilderSvg(snapshot, history, { compact, theme })],
        ['public-builder-work', renderPublicWorkSvg(snapshot, { compact, theme })],
      ];
      for (const [base, svg] of sections) {
        const name = `${base}${compact ? '-mobile' : ''}${theme === 'dark' ? '-dark' : ''}`;
        const svgPath = resolve(root, 'assets', `${name}.svg`);
        await writeFile(svgPath, `${svg}\n`);
        execFileSync('rsvg-convert', [svgPath, '-o', resolve(root, 'assets', `${name}.png`)], { stdio: 'inherit' });
      }
    }
  }
}
