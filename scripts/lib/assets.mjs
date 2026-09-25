import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { renderPublicBuilderSvg } from './svg.mjs';

export async function writeProfileAssets(root, snapshot, history) {
  await mkdir(resolve(root, 'assets'), { recursive: true });
  for (const compact of [false, true]) {
    const name = `public-builder-rank${compact ? '-mobile' : ''}`;
    const svgPath = resolve(root, 'assets', `${name}.svg`);
    const pngPath = resolve(root, 'assets', `${name}.png`);
    await writeFile(svgPath, `${renderPublicBuilderSvg(snapshot, history, { compact })}\n`);
    execFileSync('rsvg-convert', [svgPath, '-o', pngPath], { stdio: 'inherit' });
  }
}
