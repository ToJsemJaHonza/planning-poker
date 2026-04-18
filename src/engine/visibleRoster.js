/**
 * Canonical visible-player roster used by BOTH the grid renderer
 * (`usePlayerModels`) and the stage director (`usePlayerDirector`).
 *
 * Keeping these two in lockstep is load-bearing: the grid positions name
 * tags using the index in this list (via `computePlayerGridPosition`),
 * and the stage positions the matching character at the same index.
 * If the two derivations disagree — even on edge cases like the outgoing
 * leader mid-ceremony — name tags slide to the wrong figure and, when
 * card heights differ, the name tag collides with the sprite itself.
 *
 * Rules:
 *   1. Non-PM players that are not disconnected are always included.
 *   2. A disconnected player that still has `isLeader=true` is kept —
 *      the ceremony trigger has a grace window before writing pmRoulette,
 *      and we don't want the figure to walk off before the PM has started
 *      walking over to remove the crown.
 *   3. While a ceremony is active, the outgoing leader is always present
 *      (even after the promotion flip clears their `isLeader` bit on the
 *      DB side). We inject them from `pmRoulette.outgoingLeaderLastData`
 *      at their `joinedAt` slot, falling back to end-of-list if that
 *      data is unavailable. This guarantees the name tag stays anchored
 *      to the figure until `pmRoulette` clears and the figure walks off.
 *
 * The returned entries are shaped exactly like `Object.entries(players)`
 * — i.e. `[id, data]` tuples — so callers can slot this in wherever the
 * old `Object.entries(players).filter(...).sort(...)` lived.
 */
export function buildVisibleRoster(players, pmRoulette) {
  const entries = Object.entries(players || {})
    .filter(([, data]) => !!data
      && data.role !== 'pm'
      && (!data.disconnected || data.isLeader))
    .sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));

  const outgoingId = pmRoulette?.outgoingLeaderId;
  const outgoingData = pmRoulette?.outgoingLeaderLastData;
  if (!outgoingId || !outgoingData) return entries;
  if (entries.some(([id]) => id === outgoingId)) return entries;

  const rawPlayer = players?.[outgoingId];
  const joinedAt = rawPlayer?.joinedAt || 0;
  const injected = {
    name: outgoingData.name,
    role: outgoingData.role || 'player',
    // Keep `isLeader: true` on the injected card so the nameplate still
    // shows the 👑 while the ceremony is visibly transferring it. The
    // stage's crown sprite is driven by crownOwnership independently,
    // so the two halves stay consistent.
    isLeader: true,
    disconnected: true,
    joinedAt,
  };

  let idx = entries.length;
  if (joinedAt > 0) {
    const found = entries.findIndex(([, d]) => (d.joinedAt || 0) > joinedAt);
    if (found !== -1) idx = found;
  }
  entries.splice(idx, 0, [outgoingId, injected]);
  return entries;
}
