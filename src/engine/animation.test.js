import { describe, it, expect } from 'vitest';
import { easeInOutCubic, lerpPosition, WALK_FRAME_MS, CEREMONY_WALK_FRAME_MS, EASING } from './animation';

describe('easeInOutCubic', () => {
  it('returns 0 at t=0', () => {
    expect(easeInOutCubic(0)).toBe(0);
  });

  it('returns 0.5 at t=0.5', () => {
    expect(easeInOutCubic(0.5)).toBe(0.5);
  });

  it('returns 1 at t=1', () => {
    expect(easeInOutCubic(1)).toBe(1);
  });

  it('accelerates in first half (value < t)', () => {
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
  });

  it('decelerates in second half (value > t)', () => {
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75);
  });

  it('is monotonically increasing', () => {
    let prev = 0;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = easeInOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('lerpPosition', () => {
  const from = { x: 0, y: 0 };
  const to = { x: 100, y: 200 };

  it('returns from at progress=0', () => {
    const pos = lerpPosition(0, from, to);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });

  it('returns to at progress=1', () => {
    const pos = lerpPosition(1, from, to);
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(200);
  });

  it('clamps progress below 0', () => {
    const pos = lerpPosition(-0.5, from, to);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });

  it('clamps progress above 1', () => {
    const pos = lerpPosition(1.5, from, to);
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(200);
  });

  it('applies easing at midpoint', () => {
    const pos = lerpPosition(0.5, from, to);
    expect(pos.x).toBe(50); // easeInOutCubic(0.5) = 0.5
    expect(pos.y).toBe(100);
  });

  it('handles from === to (no movement)', () => {
    const same = { x: 50, y: 50 };
    const pos = lerpPosition(0.5, same, same);
    expect(pos.x).toBe(50);
    expect(pos.y).toBe(50);
  });
});

describe('constants', () => {
  it('WALK_FRAME_MS is 500', () => {
    expect(WALK_FRAME_MS).toBe(500);
  });

  it('CEREMONY_WALK_FRAME_MS is 400', () => {
    expect(CEREMONY_WALK_FRAME_MS).toBe(400);
  });

  it('EASING has expected keys', () => {
    expect(EASING).toHaveProperty('walk');
    expect(EASING).toHaveProperty('walkOut');
    expect(EASING).toHaveProperty('smooth');
    expect(EASING).toHaveProperty('settle');
  });
});
