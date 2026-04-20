/**
 * Unified coordinate convention for every animated character.
 *
 * ── The rule ──────────────────────────────────────────────────────────────
 * Producers (directors, ceremony phase computations, grid layout)
 *   → emit CENTER coords for a character's target position.
 * Consumers (CharacterSprite)
 *   → offset by half-sprite so the sprite's DOM box lands with its center
 *     at the character's (x, y).
 *
 * One convention everywhere. No more mismatch between
 * "top-left" (old PM idle render) and "(x - 30, y - 35)" (old ceremony render)
 * which was the root of the PM teleport on ceremony start.
 */
import { PX } from './sprite';

// Both PM and the compositional cute player generator render on a
// 10 × 14 pixel-grid (see PmSprite.jsx and PlayerFigure.jsx). If a future
// sprite wants a different size, it can carry its own layout metadata —
// these constants are just the shared default.
export const SPRITE_COLS = 10;
export const SPRITE_ROWS = 14;
export const SPRITE_W = SPRITE_COLS * PX; // 50px
export const SPRITE_H = SPRITE_ROWS * PX; // 70px

export const MOBILE_BREAKPOINT = 560;

// Ground offset: distance from viewport bottom to the sprite's bottom edge.
// Matches the historical pm.css / responsive.css values so the PM lands
// where users have always seen it stand.
export const GROUND_OFFSET_DESKTOP = 105;
export const GROUND_OFFSET_MOBILE = 165;

export function isMobileViewport(vw) {
  const width = vw ?? (typeof window !== 'undefined' ? window.innerWidth : 1440);
  return width <= MOBILE_BREAKPOINT;
}

/**
 * Center-y of a character standing on the bottom ground row.
 *
 * Old code used "top-left y = vh - 105"; the new convention is
 * "center y = vh - 105 + SPRITE_H/2 = vh - 70" on desktop. Every
 * producer calls this and every consumer offsets by SPRITE_H/2 on paint.
 *
 * @param {number} [vh] viewport height (defaults to window.innerHeight)
 * @param {number} [vw] viewport width (defaults to window.innerWidth)
 * @returns {number} y coordinate (center of sprite)
 */
export function getGroundY(vh, vw) {
  const height = vh ?? (typeof window !== 'undefined' ? window.innerHeight : 900);
  const bottomPx = isMobileViewport(vw) ? GROUND_OFFSET_MOBILE : GROUND_OFFSET_DESKTOP;
  return height - bottomPx + SPRITE_H / 2;
}

/**
 * Horizontal edge bounds for ground-walking characters.
 *
 * Matches the old PM idle-walk range (x=10 on the left, vw-70 on the right).
 * Returned as center-x values under the new convention.
 */
export function getIdleWalkBounds(vw) {
  const width = vw ?? (typeof window !== 'undefined' ? window.innerWidth : 1440);
  const minTopLeftX = 10;
  const maxTopLeftX = width - 70;
  return {
    minX: minTopLeftX + SPRITE_W / 2,
    maxX: maxTopLeftX + SPRITE_W / 2,
  };
}
