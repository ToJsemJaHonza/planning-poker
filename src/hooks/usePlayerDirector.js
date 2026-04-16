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
 * Outgoing leader handoff (Phase 4 concerns, handled here too): when
 * `pmRoulette.outgoingLeaderId` is set, the character for that id is kept
 * alive even if the player already left the `players` map — the ceremony
 * needs to animate them walking off. `outgoingLeaderLastData` is the fall-
 * back for the sprite's name. On `leaderWalkOff` the character walks
 * offscreen and is removed once the walk completes.
 *
 * The director writes slow-changing state (crown, tremble class, fukEyes,
 * stress stage, doNod) into the character on every render via a
 * useLayoutEffect that mirrors the current view-model.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { computePlayerGridPosition } from '../engine/gridPosition';
import { SPRITE_W } from '../engine/characterLayout';
import { hashDir } from '../components/playerList.utils';

// Player-motion durations — deliberately slow so arrivals / departures
// read as a proper entrance rather than a pop. 5× the old CSS-keyframe
// pace (user feedback: "moc rychlé, zpomal je tak na 20 %").
const JOIN_WALK_MS = 14000;
const LEAVE_WALK_MS = 11000;
const RESHUFFLE_MS = 500;           // short shift when the grid widens — stays snappy
const LEADER_WALK_OFF_MS = 12500;   // outgoing leader walking off after crown transfer

const CROWN_REMOVAL_WALKOFF_MS = 3000;
const CROWN_REMOVAL_TOTAL_MS = 5000;

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
 * @param {object|null} opts.crownOwnership
 * @param {object|null} opts.shameTimer
 * @param {number} [opts.shameStage=0]
 * @param {boolean} [opts.allVoted=false]
 * @param {object|null} [opts.phaseState=null]
 * @param {Set<string>} [opts.fukEyesSet=new Set()]
 * @param {Set<string>} [opts.hiddenPlayers=new Set()]  ids hidden for
 *   cinematic entrances (their character exists but stays hidden until
 *   the cinematic hands off — see useEntranceDirector in Phase 5).
 */
export function usePlayerDirector({
  stage,
  players,
  pmRoulette = null,
  crownOwnership = null,
  shameTimer = null,
  shameStage = 0,
  allVoted = false,
  phaseState = null,
  fukEyesSet = null,
  hiddenPlayers = null,
}) {
  // Sorted non-PM roster. Must match the sort used by PlayerList /
  // ceremonyPmWalk so target positions agree.
  const sortedPlayers = useMemo(
    () => Object.entries(players || {})
      .filter(([, d]) => d.role !== 'pm' && !d.disconnected)
      .sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0)),
    [players],
  );

  // Remember last-known data so a player who disconnects during a ceremony
  // keeps the same name hash (walk direction) and sprite.
  const lastDataRef = useRef({});
  for (const [id, data] of sortedPlayers) {
    lastDataRef.current[id] = data;
  }
  if (pmRoulette?.outgoingLeaderId && pmRoulette.outgoingLeaderLastData) {
    lastDataRef.current[pmRoulette.outgoingLeaderId] = {
      ...(lastDataRef.current[pmRoulette.outgoingLeaderId] || {}),
      ...pmRoulette.outgoingLeaderLastData,
      role: pmRoulette.outgoingLeaderLastData.role || 'player',
    };
  }

  // "Alive ids": players the stage should carry characters for right now.
  // Normally just the sorted roster, but during crown removal we inject the
  // outgoing leader so their walk-off can play even if they disconnected.
  const liveIds = useMemo(() => {
    const ids = sortedPlayers.map(([id]) => id);
    if (pmRoulette?.outgoingLeaderId && !ids.includes(pmRoulette.outgoingLeaderId)) {
      ids.push(pmRoulette.outgoingLeaderId);
    }
    return ids;
  }, [sortedPlayers, pmRoulette?.outgoingLeaderId]);

  // Fast index lookup: where does each id sit in the visible grid? The
  // outgoing leader (injected) appends to the end if they've already left.
  const indexById = useMemo(() => {
    const m = new Map();
    sortedPlayers.forEach(([id], i) => m.set(id, i));
    if (pmRoulette?.outgoingLeaderId && !m.has(pmRoulette.outgoingLeaderId)) {
      m.set(pmRoulette.outgoingLeaderId, sortedPlayers.length);
    }
    return m;
  }, [sortedPlayers, pmRoulette?.outgoingLeaderId]);

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
        const startX = offscreenX(dir, vw);
        const startHidden = hiddenPlayers?.has(id) || false;
        stage.add({
          id: charId,
          sprite: 'player',
          name: displayName,
          position: { x: startX, y: target.y },
          facingLeft: false,
          hidden: startHidden,
          zIndex: 30,
        });
        // Walk-in. We schedule it even for hidden characters so that when
        // the cinematic entrance director unhides them, the motion picks up.
        stage.get(charId).walkTo({
          x: target.x, y: target.y, duration: JOIN_WALK_MS,
        });
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

  // ── Outgoing-leader walk-off (Phase 4) ───────────────────────────────────
  // Triggers once per ceremony when the walk-off timing hits.
  const walkOffFiredForRef = useRef(null);
  const startedAt = pmRoulette?.startedAt ?? null;

  useEffect(() => {
    if (!stage || !pmRoulette || !pmRoulette.outgoingLeaderId || !startedAt) {
      walkOffFiredForRef.current = null;
      return undefined;
    }
    const ceremonyKey = pmRoulette.ceremonyId || `t-${startedAt}`;
    if (walkOffFiredForRef.current === ceremonyKey) return undefined;

    const elapsed = Date.now() - startedAt;
    const remainingUntilWalkoff = CROWN_REMOVAL_WALKOFF_MS - elapsed;
    const fire = () => {
      walkOffFiredForRef.current = ceremonyKey;
      const id = pmRoulette.outgoingLeaderId;
      const charId = `player-${id}`;
      const char = stage.get(charId);
      if (!char) return;
      const data = lastDataRef.current[id] || { name: id };
      const enterDir = safeHashDir(data.name || id).dir;
      const exitDir = enterDir === 'left' ? 'right' : 'left';
      const exitX = offscreenX(exitDir, getViewportWidth());
      char.interrupt();
      char.walkTo({
        x: exitX, y: char.position.y, duration: LEADER_WALK_OFF_MS,
        onDone: () => stage.remove(charId),
      });
    };

    if (remainingUntilWalkoff <= 0) {
      fire();
      return undefined;
    }
    const t = setTimeout(fire, remainingUntilWalkoff);
    return () => clearTimeout(t);
  }, [startedAt, pmRoulette?.ceremonyId, pmRoulette?.outgoingLeaderId, stage]);

  // After a ceremony ends, the outgoing leader character may have
  // finished its walk-off already (via onDone), but a race where the
  // ceremony payload cleared before our walk-off resolved should still
  // clean up here. We only fire on the ceremony-end transition so the
  // regular leave handler above (which queues a walk-off walkTo) isn't
  // stomped by a same-tick removal.
  const hadCeremonyRef = useRef(false);
  useEffect(() => {
    const hasCeremony = !!pmRoulette;
    if (stage && hadCeremonyRef.current && !hasCeremony) {
      const currentSet = new Set(sortedPlayers.map(([id]) => id));
      for (const char of stage.all()) {
        if (char.sprite !== 'player') continue;
        const id = char.id.replace(/^player-/, '');
        if (!currentSet.has(id)) {
          stage.remove(char.id);
        }
      }
    }
    hadCeremonyRef.current = hasCeremony;
  }, [pmRoulette, sortedPlayers, stage]);

  // ── Slow-state mirror: shame tremble, nod, fukEyes, crown, stress ────────
  useLayoutEffect(() => {
    if (!stage) return;
    const outgoingId = pmRoulette?.outgoingLeaderId || null;
    const leaderWalkOffActive = !!(pmRoulette && startedAt && (Date.now() - startedAt) >= CROWN_REMOVAL_WALKOFF_MS);

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
      const onHead = crownOwnership?.location === 'player-head' && crownOwnership?.playerId === id;
      char.crown = onHead ? { mode: 'settled', glowing: !!crownOwnership?.glowing } : null;
      // Shame tremble + "all voted" nod — applied as CSS class on the
      // inner facing wrapper. The nod is suppressed for the synthetic
      // outgoing-leader walking off (existing semantics).
      const trembleClass = stressStage >= 1
        ? `shame-tremble-${Math.min(stressStage, 5)}`
        : '';
      const nodClass = allVoted && !leaderWalkOffActive && outgoingId !== id
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
        // Outgoing leader never shows a crown on the grid — the crown is
        // being transferred via the ceremony's PM arc.
        char.crown = null;
        char.className = '';
        char.hidden = false;
      }
    }
  });
}

export const __testing__ = {
  JOIN_WALK_MS,
  LEAVE_WALK_MS,
  RESHUFFLE_MS,
  LEADER_WALK_OFF_MS,
  CROWN_REMOVAL_WALKOFF_MS,
  CROWN_REMOVAL_TOTAL_MS,
  offscreenX,
  slotCenter,
};
