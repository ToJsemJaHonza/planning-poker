/** Shared pixel-font constant for all room components. */
export const pixel = "'Press Start 2P', monospace";

/**
 * Compute the bottom padding the Room container needs based on what is
 * currently mounted at the bottom of the screen. The picker(s) and the
 * leader status bar are absolutely positioned, so the scrollable content
 * above them needs explicit padding to avoid being hidden underneath.
 *
 * Padding sources:
 *   - Active entrance cinematic (Train / DBB pipeline) — generous 380px
 *     reserve so the cinematic doesn't visually overlap the player grid.
 *   - PM role — only the PM sprite at the bottom, no picker. ~80px.
 *   - Leader player — picker + leader status bar.
 *   - Plain player — picker only.
 *
 * Split mode adds a second row to the picker, so the variants get a
 * larger reserve.
 *
 * Returned as a CSS string (px) so the caller can drop it straight
 * into a style object.
 *
 * @param {object} ctx
 * @param {boolean} ctx.hasEntrance  - a Train/DBB cinematic is currently mounted
 * @param {boolean} ctx.isPM         - the local user is the PM (no picker)
 * @param {boolean} ctx.canControl   - the local user is the leader (status bar visible)
 * @param {boolean} ctx.splitMode    - FE/BE split picker is mounted
 */
export function computeRoomPaddingBottom({ hasEntrance, isPM, canControl, splitMode }) {
  if (hasEntrance) return '380px';
  if (isPM) return '80px';
  if (canControl) return splitMode ? '280px' : '240px';
  return splitMode ? '220px' : '190px';
}
