import { describe, it, expect } from 'vitest';
import { spriteToBoxShadow, PX, SPRITE_PIXEL_STYLE } from './sprite';

describe('spriteToBoxShadow', () => {
  it('returns empty string for empty grid', () => {
    expect(spriteToBoxShadow([[null, null]], 5)).toBe('');
  });

  it('returns single shadow for single pixel', () => {
    const result = spriteToBoxShadow([[null, '#f00']], 5);
    expect(result).toBe('5px 0px 0 3px #f00');
  });

  it('produces correct shadow count', () => {
    const grid = [
      ['#f00', null, '#0f0'],
      [null, '#00f', null],
    ];
    const result = spriteToBoxShadow(grid, 5);
    const shadows = result.split(',');
    expect(shadows).toHaveLength(3); // 3 non-null pixels
  });

  it('uses default PX when no px argument', () => {
    const result = spriteToBoxShadow([['#f00']]);
    expect(result).toContain(`0px 0px 0 ${Math.ceil(PX / 2)}px #f00`);
  });
});

describe('constants', () => {
  it('PX is 5', () => {
    expect(PX).toBe(5);
  });

  it('SPRITE_PIXEL_STYLE has required properties', () => {
    expect(SPRITE_PIXEL_STYLE.width).toBe(1);
    expect(SPRITE_PIXEL_STYLE.height).toBe(1);
    expect(SPRITE_PIXEL_STYLE.position).toBe('absolute');
  });
});
