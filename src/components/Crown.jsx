import { useMemo } from 'react';
import { spriteToBoxShadow, PX, SPRITE_PIXEL_STYLE } from '../engine/sprite';

const _ = null;
const BRIGHT = '#f5c542';  // --cm-gold-bright
const PRIMARY = '#d4a853'; // --cm-gold-primary
const SHADOW = '#b8922e';  // --cm-gold-shadow
const OUTLINE = '#0a0b11'; // --cm-cabinet-outline
const JEWEL = '#c0392b';   // --cm-nearmiss-red

// 6 columns x 5 rows grid. Column 5 is intentionally blank (breathing room
// so center tooth reads as tallest). Visible footprint is 5x5 grid units.
const GRID = [
  // Row 0 — three teeth tips: left short, center tall (col 2), right short
  [BRIGHT,  _,       PRIMARY,  _,       BRIGHT,  _],
  // Row 1 — filled body upper
  [BRIGHT,  PRIMARY, PRIMARY,  PRIMARY, BRIGHT,  _],
  // Row 2 — body with outline accents
  [OUTLINE, PRIMARY, PRIMARY,  PRIMARY, OUTLINE, _],
  // Row 3 — jewel band
  [SHADOW,  JEWEL,   SHADOW,   JEWEL,   SHADOW,  _],
  // Row 4 — base band
  [OUTLINE, OUTLINE, OUTLINE,  OUTLINE, OUTLINE, _],
];

const COLS = 6;
const ROWS = 5;
const CROWN_W = COLS * PX; // 30
const CROWN_H = ROWS * PX; // 25

// Anchor offset constants for different placement modes
const ANCHOR_OFFSETS = {
  // head: relative to PlayerFigure wrapper top-left
  // (60-25)/2 = 17.5 -> 17px left, -22px top
  head: { left: 17, top: -22 },
  // hand: relative to PM sprite top-left (CAST pose hand pixel)
  hand: { left: 43, top: 18 },
  // reel: centered in 140x120 slot, slightly below top
  reel: { left: 58, top: 6 },
  // materializing: same as hand
  materializing: { left: 43, top: 18 },
};

export default function Crown({
  anchorMode = 'reel',
  style = {},
  className = '',
  glowing = false,
}) {
  const shadow = useMemo(() => spriteToBoxShadow(GRID, PX), []);
  const anchor = ANCHOR_OFFSETS[anchorMode] || ANCHOR_OFFSETS.reel;

  const positionStyle = {
    position: 'absolute',
    width: CROWN_W,
    height: CROWN_H,
    pointerEvents: 'none',
    left: anchor.left,
    top: anchor.top,
    // Crown always renders below voting card (z-index 1 vs card z-index 2)
    zIndex: anchorMode === 'head' ? 1 : undefined,
    // Gold glow during crown transport
    boxShadow: glowing ? '0 0 8px 2px #f5c542' : undefined,
    ...style,
  };

  return (
    <div
      className={`${className} ${anchorMode === 'materializing' ? 'cm-crown-materialize' : ''}`}
      style={positionStyle}
      data-cm-crown
      data-cm-crown-anchor={anchorMode}
    >
      <div style={{ ...SPRITE_PIXEL_STYLE, boxShadow: shadow }} />
    </div>
  );
}

export { CROWN_W, CROWN_H };
