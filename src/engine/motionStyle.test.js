import { describe, expect, it } from 'vitest';
import { clamp01, easeOut, envelope } from './motionStyle';

describe('pixel motion timing', () => {
  it('clamps easing before and after its timeline', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(easeOut(-1)).toBe(0);
    expect(easeOut(2)).toBe(1);
    expect(easeOut(0.5)).toBe(0.875);
  });
  it('fades in, holds, fades out, and stays hidden after a delayed frame', () => {
    expect(envelope(-10, 4000)).toBe(0);
    expect(envelope(90, 4000)).toBe(0.5);
    expect(envelope(2000, 4000)).toBe(1);
    expect(envelope(3860, 4000)).toBe(0.5);
    expect(envelope(9000, 4000)).toBe(0);
  });
});
