/**
 * ceremonyReelComputation — reel factory and spin index tests.
 *
 * Tests the exported pure helpers: reel(), spinIndex(), stoppedReel(),
 * and REEL2_CLICK_MOMENTS.
 */

import { describe, it, expect } from 'vitest';
import {
  reel,
  spinIndex,
  stoppedReel,
  REEL2_CLICK_MOMENTS,
} from './ceremonyReelComputation';

describe('reel() factory', () => {
  it('returns default values with no overrides', () => {
    const r = reel();
    expect(r).toEqual({
      stopped: false,
      currentIndex: 0,
      flareActive: false,
      rumble: false,
      transitionMode: 'none',
      pulseActive: false,
      dimmed: false,
    });
  });

  it('spreads overrides onto defaults', () => {
    const r = reel({ stopped: true, currentIndex: 5, flareActive: true });
    expect(r.stopped).toBe(true);
    expect(r.currentIndex).toBe(5);
    expect(r.flareActive).toBe(true);
    // Defaults preserved for non-overridden fields
    expect(r.rumble).toBe(false);
    expect(r.transitionMode).toBe('none');
  });

  it('accepts undefined (no overrides)', () => {
    const r = reel(undefined);
    expect(r.stopped).toBe(false);
  });
});

describe('spinIndex() wrapping', () => {
  it('wraps around reel length', () => {
    // At elapsed=spinStart, offset=0, the index is 0.
    expect(spinIndex(1000, 1000, 0, 10)).toBe(0);
  });

  it('advances by 1 every 40ms', () => {
    expect(spinIndex(1040, 1000, 0, 10)).toBe(1);
    expect(spinIndex(1080, 1000, 0, 10)).toBe(2);
  });

  it('wraps past reel length', () => {
    // 400ms / 40ms = 10 ticks, reelLen=3, 10 % 3 = 1
    expect(spinIndex(1400, 1000, 0, 3)).toBe(1);
  });

  it('applies reel offset', () => {
    // 0 ticks + offset=5, reelLen=10 -> 5 % 10 = 5
    expect(spinIndex(1000, 1000, 5, 10)).toBe(5);
  });

  it('offset wraps past reel length', () => {
    // 0 ticks + offset=12, reelLen=10 -> 12 % 10 = 2
    expect(spinIndex(1000, 1000, 12, 10)).toBe(2);
  });
});

describe('stoppedReel()', () => {
  it('returns stopped reel at given landing index', () => {
    const r = stoppedReel(4);
    expect(r.stopped).toBe(true);
    expect(r.currentIndex).toBe(4);
    expect(r.flareActive).toBe(false);
  });

  it('spreads additional overrides', () => {
    const r = stoppedReel(2, { flareActive: true, transitionMode: 'click' });
    expect(r.stopped).toBe(true);
    expect(r.currentIndex).toBe(2);
    expect(r.flareActive).toBe(true);
    expect(r.transitionMode).toBe('click');
  });

  it('handles null landing index (defaults to 0)', () => {
    const r = stoppedReel(null);
    expect(r.currentIndex).toBe(0);
    expect(r.stopped).toBe(true);
  });
});

describe('REEL2_CLICK_MOMENTS', () => {
  it('has 6 entries (one per slowdown click)', () => {
    expect(REEL2_CLICK_MOMENTS).toHaveLength(6);
  });

  it('entries are monotonically increasing', () => {
    for (let i = 1; i < REEL2_CLICK_MOMENTS.length; i++) {
      expect(REEL2_CLICK_MOMENTS[i]).toBeGreaterThan(REEL2_CLICK_MOMENTS[i - 1]);
    }
  });

  it('all entries are after REEL2_SLOWDOWN_START (11100)', () => {
    expect(REEL2_CLICK_MOMENTS[0]).toBeGreaterThan(11100);
  });
});
