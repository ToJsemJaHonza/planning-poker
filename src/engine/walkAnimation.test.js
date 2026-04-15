import { describe, it, expect } from 'vitest';
import {
  walkTransformAt,
  shouldDriveWalkInJs,
  walkRestingState,
} from './walkAnimation';

describe('walkTransformAt — walk-in', () => {
  it('starts off-screen on the left and ends at 0 (dir=left)', () => {
    const start = walkTransformAt({
      elapsedMs: 0,
      durationMs: 1000,
      dir: 'left',
      kind: 'in',
    });
    expect(start.transform).toBe('translateX(-110vw)');
    expect(start.opacity).toBe(1);
    expect(start.done).toBe(false);

    const end = walkTransformAt({
      elapsedMs: 1000,
      durationMs: 1000,
      dir: 'left',
      kind: 'in',
    });
    expect(end.transform).toBe('translateX(0vw)');
    expect(end.done).toBe(true);
  });

  it('starts off-screen on the right and ends at 0 (dir=right)', () => {
    const start = walkTransformAt({
      elapsedMs: 0,
      durationMs: 1000,
      dir: 'right',
      kind: 'in',
    });
    expect(start.transform).toBe('translateX(110vw)');
  });

  it('clamps elapsed past duration to the final state', () => {
    const past = walkTransformAt({
      elapsedMs: 10000,
      durationMs: 1000,
      dir: 'left',
      kind: 'in',
    });
    expect(past.transform).toBe('translateX(0vw)');
    expect(past.done).toBe(true);
  });
});

describe('walkTransformAt — walk-out', () => {
  it('starts at 0 and ends off-screen, opacity fades after 85%', () => {
    const start = walkTransformAt({
      elapsedMs: 0,
      durationMs: 1000,
      dir: 'right',
      kind: 'out',
    });
    expect(start.transform).toBe('translateX(0vw)');
    expect(start.opacity).toBe(1);

    const mid = walkTransformAt({
      elapsedMs: 500,
      durationMs: 1000,
      dir: 'right',
      kind: 'out',
    });
    // Mid-walk opacity still 1 (we're below 85%).
    expect(mid.opacity).toBe(1);

    const fading = walkTransformAt({
      elapsedMs: 950,
      durationMs: 1000,
      dir: 'right',
      kind: 'out',
    });
    expect(fading.opacity).toBeLessThan(1);
    expect(fading.opacity).toBeGreaterThanOrEqual(0);

    const done = walkTransformAt({
      elapsedMs: 1000,
      durationMs: 1000,
      dir: 'right',
      kind: 'out',
    });
    expect(done.opacity).toBe(0);
    expect(done.done).toBe(true);
  });
});

describe('walkTransformAt — degenerate input', () => {
  it('returns the resting state for a zero-duration walk', () => {
    const r = walkTransformAt({
      elapsedMs: 0,
      durationMs: 0,
      dir: 'left',
      kind: 'in',
    });
    expect(r.transform).toBe('translateX(0)');
    expect(r.done).toBe(true);
  });
});

describe('shouldDriveWalkInJs', () => {
  it('lets CSS drive in full motion mode', () => {
    expect(shouldDriveWalkInJs('full')).toBe(false);
  });
  it('drives via JS when CSS animations are disabled', () => {
    expect(shouldDriveWalkInJs('none')).toBe(true);
  });
  it('drives via JS for reduced motion (so we can snap)', () => {
    expect(shouldDriveWalkInJs('reduced')).toBe(true);
  });
});

describe('walkRestingState', () => {
  it('walk-in resting state is fully visible at origin', () => {
    expect(walkRestingState({ kind: 'in' })).toEqual({
      transform: 'translateX(0)',
      opacity: 1,
    });
  });
  it('walk-out resting state is invisible at origin', () => {
    expect(walkRestingState({ kind: 'out' })).toEqual({
      transform: 'translateX(0)',
      opacity: 0,
    });
  });
});
