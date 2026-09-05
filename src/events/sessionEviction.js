export const EVICTION_DURATION = 6200;
export const EVICTION_HIT = 3200;
export const EVICTION_QUOTES = [
  'Two stand-ups? Nice try. Your clone is fired!',
  'One person. One chair. The hammer handles the rest!',
  'Duplicate sprint capacity? Not on my watch. OUT!',
];

export function pendingEvictions(events, now = Date.now()) {
  return Object.values(events || {}).filter(e => e.expiresAt > now)
    .sort((a, b) => a.startedAt - b.startedAt);
}

// Firebase transaction callback: transfer votes, role and leadership together.
// Retired connection records are tombstones: reloads cannot resurrect them and
// delayed disconnects/writes cannot affect the replacement's separate slot.
export function claimSession(room, { playerId, playerName, role, deviceId, previousPlayerId, now, quote }) {
  if (!room) return room; // RTDB can initially invoke transactions with null.
  const players = { ...room.players };
  if (players[playerId]?.replacedBy) return;
  const existing = players[playerId];
  if (existing?.name) {
    players[playerId] = { ...existing, disconnected: false };
    return { ...room, players };
  }
  if (previousPlayerId && players[previousPlayerId]?.replacedBy) return;
  const prior = Object.entries(players).find(([id, p]) => !p.replacedBy && (
    (deviceId && p.deviceId === deviceId) || id === previousPlayerId
  ));
  const active = Object.values(players).filter(p => p.name && !p.replacedBy);
  const meta = { ...room.meta };
  if (prior) {
    const [oldId, old] = prior;
    players[playerId] = { ...old, name: playerName, disconnected: false, deviceId };
    players[oldId] = { ...old, disconnected: true, isLeader: false, replacedBy: playerId };
    if (meta.shameTimer?.holdoutId === oldId) meta.shameTimer = { ...meta.shameTimer, holdoutId: playerId };
    if (meta.roomStartCrowning?.winnerId === oldId) meta.roomStartCrowning = { ...meta.roomStartCrowning, winnerId: playerId };
    if (meta.pmRoulette?.winnerId === oldId) meta.pmRoulette = { ...meta.pmRoulette, winnerId: playerId };
    // Reload is a continuation; an additional tab is a takeover, even if the
    // old connection is temporarily offline. Both preserve all vote columns.
    if (oldId !== previousPlayerId) {
      const pending = pendingEvictions(meta.sessionEvictions, now);
      const startedAt = Math.max(now + 400, meta.syncedEvent?.expiresAt || 0,
        meta.pmRoulette?.expiresAt || 0,
        meta.roomStartCrowning ? meta.roomStartCrowning.startedAt + 3500 : 0,
        ...pending.map(e => e.expiresAt));
      const event = {
        oldId, newId: playerId, playerName: old.name, role: old.role,
        joinedAt: old.joinedAt, startedAt, expiresAt: startedAt + EVICTION_DURATION, quote,
      };
      meta.sessionEvictions = Object.fromEntries(pending.map(e => [e.oldId, e]));
      meta.sessionEvictions[oldId] = event;
      players[oldId].evictedAt = event.expiresAt;
    } else {
      players[oldId].evictedAt = now;
    }
  } else {
    players[playerId] = {
      name: playerName, joinedAt: now, vote: null, voteFe: null, voteBe: null,
      isLeader: active.length === 0 || (!active.some(p => p.isLeader) && role === 'pm'),
      role, disconnected: false, ...(deviceId ? { deviceId } : {}),
    };
  }
  return { ...room, meta, players };
}
