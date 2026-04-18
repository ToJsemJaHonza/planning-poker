/**
 * usePlayerDirector — owns every grid-player character on the stage.
 *
 * Each connected non-PM player gets exactly one long-lived Character,
 * `id = player-${playerId}`. Join / leave / grid reshuffle all become
 * imperative actions on the same character — join is a walkTo from
 * offscreen, leave is a walkTo to offscreen, and a reshuffle (when a new
 * player widens the grid and everyone shifts a column) is a walkTo to the
 * new slot. Because the character persists across all of those, there's
 * no unmount/remount handoff for a pop to hide inside.
 *
 * Outgoing leader handoff: while a ceremony is active, the outgoing
 * leader is kept in `sortedPlayers` (via `buildVisibleRoster`) so their
 * figure stays rooted to its grid slot through the entire ceremony — the
 * PM walks up to a standing character and lifts the crown from someone
 * who's actually there, rather than miming it over empty air. Only after
 * the ceremony ends (pmRoulette → null) does the outgoing leader walk
 * offscreen. The shared roster helper also guarantees the grid renderer
 * and the stage agree on every index, so name tags don't slide off their
 * figures.
 *
 * The director writes slow-changing state (crown, tremble class, fukEyes,
 * stress stage, doNod) into the character on every render via a
 * useLayoutEffect that mirrors the current view-model.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { computePlayerGridPosition } from '../engine/gridPosition';
import { SPRITE_W } from '../engine/characterLayout';
import { hashDir } from '../components/playerList.utils';
import { buildVisibleRoster } from '../engine/visibleRoster';

// Player-motion durations — deliberately slow so arrivals / departures
// read as a proper entrance rather than a pop. 5× the old CSS-keyframe
// pace (user feedback: "moc rychlé, zpomal je tak na 20 %").
const JOIN_WALK_MS = 14000;
const LEAVE_WALK_MS = 11000;
const RESHUFFLE_MS = 500;           // short shift when the grid widens — stays snappy
const LEADER_WALK_OFF_MS = 12500;   // outgoing leader walking off after coronation ends

// If a player's `joinedAt` is older than this when we first see them on the
// stage, we treat them as a reconnecting / already-present player and
// teleport them straight into their grid slot instead of replaying the
// walk-in-from-offscreen animation. Keeps a page refresh from looking like
// the user arrived twice (once for real, once walking in over the static
// figure left by the server). Wide enough to absorb slow Firebase cold
// boots; narrower than any realistic "just joined" case.
const JOIN_WINDOW_MS = 5000;

// sessionStorage key — marks a character as "already walked in during this
// tab session". Survives a hard refresh (same tab, same sessionStorage) but
// not a new tab. Critical for the mid-walk-in refresh case: the player's
// `joinedAt` age is still within JOIN_WINDOW_MS when they press Ctrl+R
// two seconds into their own walk-in, so the age check alone would
// classify them as a fresh join and replay the walk — visually reading
// like the character was duplicated. The flag is set the moment we
// schedule the walkTo, so any remount in the same tab sees it and
// teleports instead. Scoped by room so moving between rooms in one tab
// still shows a fresh walk-in for the new room.
function walkInStorageKey(roomCode, charId) {
  return `poker-walkedin:${roomCode || 'default'}:${charId}`;
}

function hasWalkedInThisSession(roomCode, charId) {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(walkInStorageKey(roomCode, charId)) === '1';
  } catch {
    return false;
  }
}

function markWalkedInThisSession(roomCode, charId) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(walkInStorageKey(roomCode, charId), '1');
  } catch {
    // Private-mode / quota errors: best-effort. Worst case the age check
    // still catches the common "refresh after settle" flavour.
  }
}

function safeHashDir(name) {
  try {
    return hashDir(name || '');
  } catch {
    return { dir: 'left', duration: 2.8 };
  }
}

function getViewportWidth() {
  return typeof window !== 'undefined' ? window.innerWidth : 1440;
}

/**
 * Derive an offscreen x coordinate for a player whose name hashes to the
 * given direction. Matches the old CSS keyframes: entering from left
 * means starting at x = -110vw (off left edge) and walking right into
 * the grid.
 */
function offscreenX(dir, vw) {
  return dir === 'left' ? -(SPRITE_W + 40) : vw + SPRITE_W + 40;
}

/**
 * Y coordinate of the figure within a card slot. The flex-column card is
 * (VotingCards, [figure 70px], NameTag); `computePlayerGridPosition`
 * returns the figure's center y, so we can use it directly.
 */
function slotCenter(index, count, vw) {
  return computePlayerGridPosition(index, count, vw);
}

/**
 * @param {object} opts
 * @param {object} opts.stage          shared character stage
 * @param {Record<string, object>} opts.players  raw Firebase players map
 * @param {object|null} opts.pmRoulette
 * @param {object|null} opts.shameTimer
 * @param {number} [opts.shameStage=0]
 * @param {boolean} [opts.allVoted=false]
 * @param {object|null} [opts.phaseState=null]
 * @param {Set<string>} [opts.fukEyesSet=new Set()]
 * @param {Set<string>} [opts.hiddenPlayers=new Set()]  ids hidden for
 *   cinematic entrances (their character exists but stays hidden until
 *   the cinematic hands off — see useEntranceDirector in Phase 5).
 *
 * The crown is NOT this hook's concern. CrownStage renders the crown from
 * the canonical `crownOwnership` object; we don't mirror it into characters.
 */
export function usePlayerDirector({
  stage,
  players,
  pmRoulette = null,
  shameTimer = null,
  shameStage = 0,
  allVoted = false,
  phaseState = null,
  fukEyesSet = null,
  hiddenPlayers = null,
  roomCode = null,
}) {
  // Canonical roster shared with `usePlayerModels` — same helper, same
  // rules. That guarantees a character's index on the stage matches the
  // index of its card in the grid, so every name tag sits directly
  // below its figure. See `engine/visibleRoster.js` for the filter rules
  // (includes a still-isLeader disconnected player; injects the outgoing
  // leader post-flip for the rest of the ceremony).
  const sortedPlayers = useMemo(
    () => buildVisibleRoster(players, pmRoulette),
    [players, pmRoulette],
  );

  // Remember last-known data so a player who disconnects during a ceremony
  // keeps the same name hash (walk direction) and sprite.
  const lastDataRef = useRef({});
  for (const [id, data] of sortedPlayers) {
    lastDataRef.current[id] = data;
  }

  const liveIds = useMemo(() => sortedPlayers.map(([id]) => id), [sortedPlayers]);

  const indexById = useMemo(() => {
    const m = new Map();
    sortedPlayers.forEach(([id], i) => m.set(id, i));
    return m;
  }, [sortedPlayers]);

  // Window-resize triggers reshuffle: when the viewport width changes,
  // every player's computed grid-slot x shifts, and we want the
  // characters to WALK to the new slot (legs animating, pose = walk)
  // rather than teleport — same look as the PM's continuous motion.
  const [vw, setVw] = useState(getViewportWidth);
  useEffect(() => {
    const onResize = () => setVw(getViewportWidth());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Structural lifecycle: create / remove / reshuffle on id-set change ──
  const knownIdsRef = useRef(new Set());

  useEffect(() => {
    if (!stage) return;
    const currentSet = new Set(liveIds);
    const gridCount = sortedPlayers.length;

    // Joins — new ids that aren't in knownIdsRef yet.
    for (const id of liveIds) {
      const charId = `player-${id}`;
      if (!stage.has(charId)) {
        const data = lastDataRef.current[id] || { name: id };
        const displayName = data.name || id;
        const dir = safeHashDir(displayName).dir;
        const index = indexById.get(id) ?? 0;
        const target = slotCenter(index, gridCount || 1, vw);
        const startHidden = hiddenPlayers?.has(id) || false;
        // Genuine fresh join (walk in from offscreen) vs. reconnect /
        // refresh / already-present player (place directly at slot).
        // Two guards combined:
        //   1) sessionStorage flag — survives Ctrl+R in the same tab, so
        //      a user who is two seconds into their own walk-in and hits
        //      refresh does NOT see the walk-in replay from offscreen.
        //      The age window alone can't catch this because `joinedAt`
        //      is still < JOIN_WINDOW_MS on remount.
        //   2) `joinedAt` age — catches the case where sessionStorage
        //      is unavailable (private mode) or was cleared, and covers
        //      other players whose flag was never set in our tab.
        // `joinedAt` is preserved across refresh by useRoom.setupPlayer.
        const alreadyWalkedIn = hasWalkedInThisSession(roomCode, charId);
        const joinedAt = typeof data.joinedAt === 'number' ? data.joinedAt : 0;
        const age = Date.now() - joinedAt;
        const isFreshJoin = !alreadyWalkedIn && joinedAt > 0 && age <= JOIN_WINDOW_MS;
        const startX = isFreshJoin ? offscreenX(dir, vw) : target.x;
        stage.add({
          id: charId,
          sprite: 'player',
          name: displayName,
          position: { x: startX, y: target.y },
          facingLeft: false,
          hidden: startHidden,
          zIndex: 30,
        });
        if (isFreshJoin) {
          // Mark BEFORE scheduling so a synchronous remount during the
          // walk-in reliably sees the flag.
          markWalkedInThisSession(roomCode, charId);
          // Walk-in. We schedule it even for hidden characters so that when
          // the cinematic entrance director unhides them, the motion picks up.
          stage.get(charId).walkTo({
            x: target.x, y: target.y, duration: JOIN_WALK_MS,
          });
        }
      }
    }

    // Leaves — ids we had but that dropped out of the current set.
    for (const id of knownIdsRef.current) {
      if (!currentSet.has(id)) {
        const charId = `player-${id}`;
        const char = stage.get(charId);
        if (!char) continue;
        const data = lastDataRef.current[id] || { name: id };
        // Outgoing leader → their walk-off is driven by the ceremony
        // branch below, not by the normal leave handler.
        if (pmRoulette?.outgoingLeaderId === id) continue;
        const enterDir = safeHashDir(data.name || id).dir;
        const exitDir = enterDir === 'left' ? 'right' : 'left';
        const exitX = offscreenX(exitDir, vw);
        char.interrupt();
        char.walkTo({
          x: exitX, y: char.position.y, duration: LEAVE_WALK_MS,
          onDone: () => stage.remove(charId),
        });
      }
    }

    // Reshuffle — grid width changed (new player, resize), active player
    // slots moved. Walk at a constant ~100 px/s (same pace as the
    // JOIN_WALK 14 s / ~1400 px screen) so tiny shifts are still brief
    // but a wide resize reads as a real walk.
    const SPEED_MS_PER_PX = 10;
    for (let i = 0; i < sortedPlayers.length; i++) {
      const [id] = sortedPlayers[i];
      const charId = `player-${id}`;
      const char = stage.get(charId);
      if (!char) continue;
      // Skip characters still walking in from offscreen; they'll land on
      // their up-to-date slot via the join walkTo above.
      if (!knownIdsRef.current.has(id)) continue;
      const target = slotCenter(i, sortedPlayers.length, vw);
      const dx = target.x - char.position.x;
      const dy = target.y - char.position.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 2) {
        const action = char.action;
        const aiming = action?.type === 'walkTo' && Math.abs(action.x - target.x) < 1 && Math.abs(action.y - target.y) < 1;
        if (!aiming) {
          const duration = Math.max(RESHUFFLE_MS, Math.min(3000, Math.round(distance * SPEED_MS_PER_PX)));
          char.interrupt();
          char.walkTo({ x: target.x, y: target.y, duration });
        }
      }
    }

    knownIdsRef.current = currentSet;
  }, [liveIds, sortedPlayers, pmRoulette?.outgoingLeaderId, indexById, stage, hiddenPlayers, vw]);

  // ── Outgoing-leader walk-off (post-ceremony) ─────────────────────────────
  //
  // The figure stays rooted to its grid slot for the full ceremony.
  // Walk-off is triggered on the `pmRoulette` → null transition (i.e.
  // `clearPmRoulette` fired after crownDelivery completes) so the user
  // sees: crown lifted from standing figure → slot machine → new leader
  // crowned → THEN the old leader exits. Any non-outgoing straggler that
  // dropped out during the ceremony is walked off here too.
  //
  // We remember the most recent `outgoingLeaderId` across the ceremony
  // because by the time pmRoulette is null the payload itself is gone,
  // so we need a captured value to find which character to animate.
  const hadCeremonyRef = useRef(false);
  const lastOutgoingLeaderIdRef = useRef(null);
  if (pmRoulette?.outgoingLeaderId) {
    lastOutgoingLeaderIdRef.current = pmRoulette.outgoingLeaderId;
  }

  useEffect(() => {
    const hasCeremony = !!pmRoulette;
    if (stage && hadCeremonyRef.current && !hasCeremony) {
      const currentSet = new Set(sortedPlayers.map(([id]) => id));
      const outgoingId = lastOutgoingLeaderIdRef.current;
      for (const char of stage.all()) {
        if (char.sprite !== 'player') continue;
        const id = char.id.replace(/^player-/, '');
        if (currentSet.has(id)) continue;
        const charId = char.id;
        if (id === outgoingId) {
          // Outgoing leader: walk them off ceremoniously now that the
          // new leader has been crowned.
          const data = lastDataRef.current[id] || { name: id };
          const enterDir = safeHashDir(data.name || id).dir;
          const exitDir = enterDir === 'left' ? 'right' : 'left';
          const exitX = offscreenX(exitDir, getViewportWidth());
          char.interrupt();
          char.walkTo({
            x: exitX, y: char.position.y, duration: LEADER_WALK_OFF_MS,
            onDone: () => stage.remove(charId),
          });
        } else {
          // Straggler — character was kept alive by the liveIds injection
          // but isn't the outgoing leader (e.g. they disconnected during
          // the ceremony). Remove without ceremony.
          stage.remove(charId);
        }
      }
      lastOutgoingLeaderIdRef.current = null;
    }
    hadCeremonyRef.current = hasCeremony;
  }, [pmRoulette, sortedPlayers, stage]);

  // ── Slow-state mirror: shame tremble, nod, fukEyes, stress ─────────────
  // Crown state is intentionally NOT mirrored here. CrownStage is the sole
  // crown renderer and reads the authoritative crownOwnership directly —
  // writing `char.crown` from multiple directors was the exact bug that
  // made the crown vanish one frame before the PM visibly removed it.
  useLayoutEffect(() => {
    if (!stage) return;
    const outgoingId = pmRoulette?.outgoingLeaderId || null;
    // During an active ceremony we suppress the "all voted" nod
    // everywhere — the mood is ceremonial and the outgoing leader is
    // standing still for the crown removal, not bobbing.
    const ceremonyActive = !!pmRoulette;

    for (const [id, data] of sortedPlayers) {
      const char = stage.get(`player-${id}`);
      if (!char) continue;
      const displayName = data?.name || id;
      const isHoldout = shameTimer?.holdoutId === id;
      const stressStage = isHoldout ? shameStage : 0;
      char.name = displayName;
      char.fukEyes = !!(fukEyesSet?.has(displayName)
        || (phaseState?.nonMatchRelief && phaseState?.nonMatchReliefPlayerId === id));
      char.stressStage = stressStage;
      // Shame tremble + "all voted" nod — applied as CSS class on the
      // inner facing wrapper. The nod is suppressed during a ceremony
      // and on the outgoing leader specifically.
      const trembleClass = stressStage >= 1
        ? `shame-tremble-${Math.min(stressStage, 5)}`
        : '';
      const nodClass = allVoted && !ceremonyActive && outgoingId !== id
        ? 'player-nod'
        : '';
      char.className = [trembleClass, nodClass].filter(Boolean).join(' ');
      if (hiddenPlayers && hiddenPlayers.has(id)) char.hidden = true;
      else if (char.hidden && (!hiddenPlayers || !hiddenPlayers.has(id))) char.hidden = false;
    }

    // Outgoing leader (possibly disconnected) — mirror state too.
    if (outgoingId) {
      const char = stage.get(`player-${outgoingId}`);
      if (char) {
        const data = lastDataRef.current[outgoingId] || pmRoulette?.outgoingLeaderLastData || { name: outgoingId };
        char.name = data.name || outgoingId;
        char.fukEyes = false;
        char.stressStage = 0;
        char.className = '';
        char.hidden = false;
      }
    }
  });
}

export const __testing__ = {
  JOIN_WALK_MS,
  JOIN_WINDOW_MS,
  LEAVE_WALK_MS,
  RESHUFFLE_MS,
  LEADER_WALK_OFF_MS,
  offscreenX,
  slotCenter,
  walkInStorageKey,
  hasWalkedInThisSession,
  markWalkedInThisSession,
};
