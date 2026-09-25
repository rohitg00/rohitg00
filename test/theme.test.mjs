import assert from 'node:assert/strict';
import test from 'node:test';

import { THEMES } from '../scripts/lib/theme.mjs';

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

test('body, accent and diff text meet 4.5:1 contrast against each theme background', () => {
  for (const [name, theme] of Object.entries(THEMES)) {
    const background = luminance(theme.paper);
    for (const key of ['ink', 'blue', 'positive', 'negative']) {
      const foreground = luminance(theme[key]);
      const contrast = (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
      assert.ok(contrast >= 4.5, `${name} ${key}: ${contrast.toFixed(2)}:1`);
    }
  }
});
