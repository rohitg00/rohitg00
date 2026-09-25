import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { renderPublicBuilderSvg } from './svg.mjs';
import { renderPublicWorkSvg } from './work-svg.mjs';

export async function writeProfileAssets(root, snapshot, history) {
  await mkdir(resolve(root, 'assets'), { recursive: true });
  for (const compact of [false, true]) {
    const sections = [
      ['public-builder-rank', renderPublicBuilderSvg(snapshot, history, { compact })],
      ['public-builder-work', renderPublicWorkSvg(snapshot, { compact })],
    ];
    for (const [base, svg] of sections) {
      const name = `${base}${compact ? '-mobile' : ''}`;
      const svgPath = resolve(root, 'assets', `${name}.svg`);
      await writeFile(svgPath, `${svg}\n`);
      execFileSync('rsvg-convert', [svgPath, '-o', resolve(root, 'assets', `${name}.png`)], { stdio: 'inherit' });
    }
  }
}
