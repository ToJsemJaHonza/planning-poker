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
 * Fallback `gridTop` used when the live measurement isn't available yet
 * (first paint, SSR, jsdom tests). Roughly matches the worst-case header
 * sum (header + list-mode TaskBar + leader PhaseBar) so figures still
 * land somewhere reasonable before `useGridTop` settles.
 */
export const DEFAULT_GRID_TOP = 220;

/**
 * Vertical offset of the figure center within a single card slot:
 *   voting-card (80) + margin+gap (8) + spacer_half (50) = 138 px
 * Sprite (70 px tall) spans 138 ± 35 = 103–173. Name tag follows at
 * card-row offset 192. Exported so consumers (tests, layout helpers) can
 * derive the card's true figure y from a measured grid top without
 * duplicating the constant.
 */
export const FIGURE_OFFSET_FROM_TOP = 138;

/**
 * Compute a player's center position in the flex-wrap grid without touching
 * the DOM. Mirrors the actual CSS grid layout in PlayerList.jsx:
 *   - gap: 16px 28px (row-gap x col-gap)
 *   - item width: 80px (fixed player slot width)
 *   - container padding: 16px on each side
 *   - item height: 180px (card + figure + name tag)
 *
 * `gridTop` is the live viewport-y of the `data-player-grid` container,
 * measured by `useGridTop` and threaded through Room.jsx. Pass it
 * whenever you have it (production code) — the figure then tracks the
 * card flow regardless of how tall the header / task bar / phase bar
 * grew. When omitted (tests, fallback), `DEFAULT_GRID_TOP` is used.
 *
 * @param {number} index  0-based index in the sorted player list
 * @param {number} playerCount  total players in the grid
 * @param {number} viewportWidth  window.innerWidth
 * @param {number} [gridTop] measured top of the player-grid container
 * @returns {{ x: number, y: number }}
 */
export function computePlayerGridPosition(index, playerCount, viewportWidth, gridTop) {
  const ITEM_WIDTH = 80;
  const COL_GAP = 28;
  const ROW_GAP = 16;
  // Total card height: voting-card (80) + margin+gap (8) + figure spacer
  // (100) + gap (4) + name tag (≈20) ≈ 212 px. Spacer was 120 px but
  // that gave 25 px of dead space below the 70-px sprite, pushing the
  // name tag visibly below the figure; 100 px keeps 15 px of clearance
  // on each side so the sprite still breathes.
  const ITEM_HEIGHT = 212;
  const GRID_TOP = gridTop == null ? DEFAULT_GRID_TOP : gridTop;
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
  // Figure-center y — `GRID_TOP` is the measured (or default) viewport y
  // of the player-grid container; `FIGURE_OFFSET_FROM_TOP` (138 px) lands
  // the sprite center inside the invisible 100-px figure slot of each
  // card. Name tag sits 19 px below sprite bottom; the DevBubble in
  // PlayerCard anchors to slot top + 14 px so it floats above the sprite
  // regardless of DOM-flow vs. math alignment drift.
  const y = GRID_TOP + row * (ITEM_HEIGHT + ROW_GAP) + FIGURE_OFFSET_FROM_TOP;

  return { x, y };
}
