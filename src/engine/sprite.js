/**
 * Shared sprite rendering engine for pixel-art box-shadow sprites.
 *
 * Every sprite in the app (PlayerFigure, PmSprite, Crown, SlotFiller) uses
 * the same box-shadow technique: a 1x1px element with a long box-shadow
 * string where each shadow == one pixel. This module centralizes that
 * logic so it lives in exactly one place.
 */

/** Default pixel size for all sprites. */
export const PX = 5;

/**
 * Convert a 2D grid of hex color strings (or null for transparent) into
 * a CSS box-shadow string. Each non-null cell becomes one shadow entry.
 *
 * @param {(string|null)[][]} grid - 2D array, rows × cols
 * @param {number} [px=PX] - pixel size (spread radius = ceil(px/2))
 * @returns {string} CSS box-shadow value
 */
export function spriteToBoxShadow(grid, px = PX) {
  const shadows = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const c = grid[y][x];
      if (c) shadows.push(`${x * px}px ${y * px}px 0 ${Math.ceil(px / 2)}px ${c}`);
    }
  }
  return shadows.join(',');
}

/**
 * Inline style for the 1x1px element that carries the box-shadow sprite.
 * Reusable across all sprite components to avoid repeating the same object.
 */
export const SPRITE_PIXEL_STYLE = {
  width: 1,
  height: 1,
  position: 'absolute',
  top: 0,
  left: 0,
};
