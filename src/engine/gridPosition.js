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
  // Total card height: voting-card (72) + gap (4) + figure spacer (120) +
  // gap (4) + name tag (20) ≈ 220 px. Spacer grew to give the stage
  // sprite vertical clearance from both the voting card above and the
  // name tag below.
  const ITEM_HEIGHT = 220;
  const GRID_TOP = 174;
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
  // Figure-center y — center of the invisible 120-px spacer inside the
  // PlayerCard flex column:
  //   voting-card (72) + gap (4) + spacer_half (60) = 136 px from card top.
  // Sprite spans 136 ± 35 = 101–171. Name tag follows at offset 200 →
  // 29 px clearance below, 29 px clearance above. Good visual breathing
  // room either side.
  const FIGURE_OFFSET_FROM_TOP = 136;
  const y = GRID_TOP + row * (ITEM_HEIGHT + ROW_GAP) + FIGURE_OFFSET_FROM_TOP;

  return { x, y };
}
