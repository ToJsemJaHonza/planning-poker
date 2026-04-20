/**
 * reducedMotion.test — guards the entrance-event coverage of the
 * `@media (prefers-reduced-motion: reduce)` block in responsive.css.
 *
 * The block neutralises every animation that would otherwise fire during
 * an entrance cinematic (chicken, sheep, Richard's train, Tomáš's DBB
 * pipeline) plus the reveal background. If a future refactor renames a
 * keyframe or adds a new entrance event without updating the block,
 * users with `prefers-reduced-motion: reduce` would silently see motion
 * they explicitly opted out of — these tests fail loudly when that
 * happens.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const cssPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'responsive.css',
);
// Strip CSS block comments so commenting-out a rule doesn't still satisfy
// the assertions — a /* ... */ wrapping is the same as deleting the line.
const css = readFileSync(cssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function reducedMotionBlock() {
  const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
  if (start < 0) throw new Error('reduced-motion media block missing');
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error('reduced-motion media block is unterminated');
}

describe('responsive.css — reduced-motion entrance events', () => {
  const body = reducedMotionBlock();

  it.each([
    'chickenRun',
    'sheepRun',
    'sheepTextRun',
    'trainArriveLeft',
    'trainArriveRight',
    'trainDepartLeft',
    'trainDepartRight',
    'revealBgFade',
    'revealNumberPop',
    // Enriched Richard / Tomáš keyframes
    'stationSignIn',
    'hornBubble',
    'doorsFlash',
    'richardWave',
    'steamCloud',
    'dbbRumble',
    'dbbPacketFlow',
    'dbbBoltFadeIn',
    'dbbGaugeSweep',
  ])('redefines @keyframes %s inside the reduced-motion block', (name) => {
    expect(body).toMatch(new RegExp(`@keyframes\\s+${name}\\b`));
  });

  it.each([
    '.dbb-tomas-emerge-right',
    '.dbb-tomas-emerge-left',
    '.dbb-tomas-emerge-up',
    '.dbb-tomas-emerge-down',
    '.dbb-steam-puff',
    '.dbb-mouth-flash',
    '.richard-exit-train',
    '.dust-puff',
    '.name-tag-arrived',
    // Enriched Richard selectors
    '.train-station-sign',
    '.horn-bubble',
    '.train-steam-cloud',
    '.door-flash',
    '.richard-wave',
    // Enriched DBB selectors
    '.dbb-rumble',
    '.dbb-packet',
    '.dbb-bolt-band',
    '.dbb-gauge-needle',
    '.dbb-hazard-stripe',
  ])('disables %s inside the reduced-motion block', (selector) => {
    expect(body).toContain(selector);
  });
});
