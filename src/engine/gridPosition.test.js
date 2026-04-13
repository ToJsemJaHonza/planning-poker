import { describe, it, expect } from 'vitest';
import { computePlayerGridPosition, computePmWalkPosition } from './gridPosition';

describe('computePlayerGridPosition', () => {
  it('single player is centered', () => {
    const pos = computePlayerGridPosition(0, 1, 1440);
    expect(pos.x).toBeCloseTo(720, 0); // centered at half viewport
    expect(pos.y).toBeGreaterThan(0);
  });

  it('two players are side by side', () => {
    const p1 = computePlayerGridPosition(0, 2, 1440);
    const p2 = computePlayerGridPosition(1, 2, 1440);
    expect(p2.x).toBeGreaterThan(p1.x);
    expect(p1.y).toBe(p2.y); // same row
  });

  it('wraps to second row when viewport is narrow', () => {
    // 300px viewport can fit ~2 columns (80px item + 28px gap)
    const p1 = computePlayerGridPosition(0, 3, 300);
    const p3 = computePlayerGridPosition(2, 3, 300);
    expect(p3.y).toBeGreaterThan(p1.y); // different row
  });

  it('returns positive coordinates', () => {
    for (let i = 0; i < 10; i++) {
      const pos = computePlayerGridPosition(i, 10, 1440);
      expect(pos.x).toBeGreaterThan(0);
      expect(pos.y).toBeGreaterThan(0);
    }
  });
});

describe('computePmWalkPosition', () => {
  it('returns start at progress=0', () => {
    const pos = computePmWalkPosition(0, 100, 200, 500, 600);
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(200);
  });

  it('returns target at progress=1', () => {
    const pos = computePmWalkPosition(1, 100, 200, 500, 600);
    expect(pos.x).toBe(500);
    expect(pos.y).toBe(600);
  });

  it('clamps negative progress', () => {
    const pos = computePmWalkPosition(-1, 100, 200, 500, 600);
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(200);
  });

  it('clamps progress above 1', () => {
    const pos = computePmWalkPosition(2, 100, 200, 500, 600);
    expect(pos.x).toBe(500);
    expect(pos.y).toBe(600);
  });

  it('applies easing (midpoint is at 0.5 due to cubic)', () => {
    const pos = computePmWalkPosition(0.5, 0, 0, 400, 400);
    // easeInOutCubic(0.5) = 0.5 -> x=200, y=200
    expect(pos.x).toBeCloseTo(200, 0);
    expect(pos.y).toBeCloseTo(200, 0);
  });
});
