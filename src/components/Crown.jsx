import { useMemo } from 'react';

/**
 * Pixel-art crown sprite — iter 2: 6 columns x 5 rows grid (30 x 25 px
 * rendered at PX=5). 3-point silhouette (center tall, two flanking short).
 *
 * Anchor modes: 'head' | 'hand' | 'reel' | 'materializing'
 *   - head: positioned above a PlayerFigure at design doc v2 §2 offsets
 *   - hand: positioned at Wizard's CAST pose hand pixel
 *   - reel: floats inside a reel slot (winner emphasis)
 *   - materializing: same as hand but with fade-in animation class
 *
 * Colors from design doc v2 §2: gold-bright top teeth, gold-primary body,
 * gold-shadow jewel band, near-miss red jewels, cabinet-outline base.
 */

const _ = null;
const BRIGHT = '#f5c542';  // --cm-gold-bright
const PRIMARY = '#d4a853'; // --cm-gold-primary
const SHADOW = '#b8922e';  // --cm-gold-shadow
const OUTLINE = '#0a0b11'; // --cm-cabinet-outline
const JEWEL = '#c0392b';   // --cm-nearmiss-red

// iter 2: 6 columns x 5 rows grid. Column 5 is intentionally blank
// (breathing room so center tooth reads as tallest). Visible footprint
// is effectively 5x5 grid units = 25x25 px at PX=5.
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

const PX = 5;
const COLS = 6;
const ROWS = 5;
const CROWN_W = COLS * PX; // 30
const CROWN_H = ROWS * PX; // 25

function spriteToBoxShadow(grid, px) {
  const shadows = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const c = grid[y][x];
      if (c) shadows.push(`${x * px}px ${y * px}px 0 ${Math.ceil(px / 2)}px ${c}`);
    }
  }
  return shadows.join(',');
}

// Anchor offset constants from design doc v2 §2
const ANCHOR_OFFSETS = {
  // head: relative to PlayerFigure wrapper top-left
  // (60-25)/2 = 17.5 -> 17px left, -22px top
  head: { left: 17, top: -22 },
  // hand: relative to Wizard sprite top-left (CAST pose hand pixel)
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
    // v3: gold glow during crown transport (deliberate exception to no-blur rule)
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
      <div
        style={{
          width: 1,
          height: 1,
          boxShadow: shadow,
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
    </div>
  );
}

export { CROWN_W, CROWN_H };
