/**
 * Pure math helpers for computing positions in the player grid and
 * PM walk paths during crown ceremonies.
 *
 * Zero React imports. No DOM access. All functions are pure.
 */

import { easeInOutCubic } from '../engine/animation';

// ---------------------------------------------------------------------------
// Vertical walk path computation for ceremony PM movement
// ---------------------------------------------------------------------------

/**
 * Compute a blended vertical-first walk position.
 * Phase 1 (0-70% progress): pure vertical movement.
 * Phase 2 (70-100%): blend in horizontal correction for a gentle curve.
 *
 * @param {number} progress 0-1 clamped
 * @param {number} startX
 * @param {number} startY
 * @param {number} targetX
 * @param {number} targetY
 * @returns {{ x: number, y: number }}
 */
export function computePmWalkPosition(progress, startX, startY, targetX, targetY) {
  // Eased interpolation on both axes simultaneously for smooth movement.
  const p = Math.max(0, Math.min(1, progress));
  const t = easeInOutCubic(p);
  const x = startX + (targetX - startX) * t;
  const y = startY + (targetY - startY) * t;
  return { x, y };
}

// ---------------------------------------------------------------------------
// Math-based grid position (no DOM queries needed)
// ---------------------------------------------------------------------------

/**
 * Compute a player's center position in the flex-wrap grid without touching
 * the DOM. Mirrors the actual CSS grid layout in PlayerList.jsx:
 *   - gap: 16px 28px (row-gap x col-gap)
 *   - item width: 80px (fixed player slot width)
 *   - container padding: 16px on each side
 *   - grid top: 174px from viewport top (header + task bar + phase bar)
 *   - item height: 180px (card + figure + name tag)
 *
 * @param {number} index  0-based index in the sorted player list
 * @param {number} playerCount  total players in the grid
 * @param {number} viewportWidth  window.innerWidth
 * @returns {{ x: number, y: number }}
 */
export function computePlayerGridPosition(index, playerCount, viewportWidth) {
  const ITEM_WIDTH = 80;
  const COL_GAP = 28;
  const ROW_GAP = 16;
  // Total card height: voting-card (80) + margin+gap (8) + figure spacer
  // (100) + gap (4) + name tag (≈20) ≈ 212 px. Spacer was 120 px but
  // that gave 25 px of dead space below the 70-px sprite, pushing the
  // name tag visibly below the figure; 100 px keeps 15 px of clearance
  // on each side so the sprite still breathes.
  const ITEM_HEIGHT = 212;
  // GRID_TOP = header (≈40) + TaskBar list-mode strip (≈105) + PhaseBar
  // (≈76) worst-case. The TaskBar grew when the horizontal chip strip
  // replaced the old one-line "Now grooming" display; before this bump
  // the figures stayed at y=310 while the grid flow shifted down with
  // the taller bar, which dropped the name tags visibly below their
  // sprites.
  const GRID_TOP = 220;
  const CONTAINER_PAD_X = 16;

  const availableWidth = viewportWidth - 2 * CONTAINER_PAD_X;
  const slotPitch = ITEM_WIDTH + COL_GAP;
  const columnsPerRow = Math.max(1, Math.floor((availableWidth + COL_GAP) / slotPitch));

  const col = index % columnsPerRow;
  const row = Math.floor(index / columnsPerRow);

  const totalRows = Math.ceil(playerCount / columnsPerRow);
  const isLastRow = row === totalRows - 1;
  const colsThisRow = isLastRow ? playerCount - row * columnsPerRow : columnsPerRow;

  const rowWidth = colsThisRow * ITEM_WIDTH + (colsThisRow - 1) * COL_GAP;
  const rowLeft = (viewportWidth - rowWidth) / 2;

  const x = rowLeft + col * slotPitch + ITEM_WIDTH / 2;
  // Figure-center y — center of the invisible 100-px spacer inside the
  // PlayerCard flex column:
  //   voting-card (80) + margin+gap (8) + spacer_half (50) = 138 px
  //   from card top.
  // Sprite spans 138 ± 35 = 103–173. Name tag follows at offset 192 →
  // 19 px clearance below sprite bottom (down from the old 29 px, which
  // visually stranded the name). The DevBubble in PlayerCard anchors to
  // slot top (88) and is lifted another 14 px so it always floats
  // above the sprite's top edge regardless of DOM-flow vs. math
  // alignment drift.
  const FIGURE_OFFSET_FROM_TOP = 138;
  const y = GRID_TOP + row * (ITEM_HEIGHT + ROW_GAP) + FIGURE_OFFSET_FROM_TOP;

  return { x, y };
}
