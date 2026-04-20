import { describe, it, expect } from 'vitest';
import {
  SPRITE_W,
  SPRITE_H,
  GROUND_OFFSET_DESKTOP,
  GROUND_OFFSET_MOBILE,
  MOBILE_BREAKPOINT,
  isMobileViewport,
  getGroundY,
  getIdleWalkBounds,
} from './characterLayout';

describe('SPRITE dimensions', () => {
  it('is 50 × 70 px (10×14 pixel-grid × 5px)', () => {
    expect(SPRITE_W).toBe(50);
    expect(SPRITE_H).toBe(70);
  });
});

describe('isMobileViewport', () => {
  it('true at and below the breakpoint', () => {
    expect(isMobileViewport(MOBILE_BREAKPOINT)).toBe(true);
    expect(isMobileViewport(MOBILE_BREAKPOINT - 1)).toBe(true);
  });
  it('false above the breakpoint', () => {
    expect(isMobileViewport(MOBILE_BREAKPOINT + 1)).toBe(false);
    expect(isMobileViewport(1440)).toBe(false);
  });
});

describe('getGroundY', () => {
  it('returns sprite center on desktop (matches old top-left + half-sprite)', () => {
    // Old PM code rendered with top-left y = vh - 105. New center-y
    // convention adds half the sprite height so paint ends at the same
    // pixel: a character placed at center y=vh-70 draws top-left at
    // vh-70 - 35 = vh-105.
    const vh = 900;
    const vw = 1440;
    const y = getGroundY(vh, vw);
    expect(y).toBe(vh - GROUND_OFFSET_DESKTOP + SPRITE_H / 2);
    expect(y).toBe(900 - 105 + 35); // 830
  });

  it('returns sprite center on mobile with the taller offset', () => {
    const vh = 812;
    const vw = 375;
    const y = getGroundY(vh, vw);
    expect(y).toBe(vh - GROUND_OFFSET_MOBILE + SPRITE_H / 2);
    expect(y).toBe(812 - 165 + 35); // 682
  });
});

describe('getIdleWalkBounds', () => {
  it('returns center-x bounds for the PM idle ping-pong range', () => {
    const vw = 1440;
    const { minX, maxX } = getIdleWalkBounds(vw);
    // Old code used top-left range [10, vw - 70]; center-x is top-left + W/2
    expect(minX).toBe(10 + SPRITE_W / 2);
    expect(maxX).toBe(vw - 70 + SPRITE_W / 2);
    expect(maxX).toBeGreaterThan(minX);
  });
});
