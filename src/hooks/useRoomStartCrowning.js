/**
 * useRoomStartCrowning — mini-ceremony phase machine for the room-start
 * crown delivery to a player-role first joiner.
 *
 * Separate from useSlotMachine because the mini-ceremony has NO cabinet,
 * NO reels, NO matched-hold, NO near-miss. It is a completely different
 * phase table (PM walk + crown materialize + crown place + PM exit).
 *
 *
 * Payload shape (rooms/{code}/meta/roomStartCrowning):
 *   { ceremonyId, startedAt, winnerId, schemaVersion: 1 }
 *
 * Phase table (~1.7s core + ~500ms entry walk = ~2.2s total):
 *   pmEntry (0-500ms), castAndMaterialize (500-1000ms),
 *   crownPlace (1000-1250ms), pmExit (1250-1700ms), done.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { db, ref, set, get, runTransaction } from '../firebase';
import { computePlayerGridPosition } from '../engine/gridPosition';
import { easeInOutCubic, CEREMONY_WALK_FRAME_MS } from '../engine/animation';
import { useAnimationLoop } from '../engine/useAnimationLoop';
import { currentPhaseRow } from '../events/slotMachine';

// Slowed to ~3.5s so each phase is visually appreciable (was 1.7s — too fast
// to distinguish walk-in, cast, crown-place, walk-out as separate steps).
// Matches the "2x slower" design intent applied to the full crown ceremony.
const PHASE_TABLE_ROOM_START = [
  { phase: 'pmEntry',        startAt:    0, duration: 1200 },
  { phase: 'castAndMaterialize', startAt: 1200, duration:  800 },
  { phase: 'crownPlace',         startAt: 2000, duration:  500 },
  { phase: 'pmExit',         startAt: 2500, duration: 1000 },
  { phase: 'done',               startAt: 3500, duration:    0 },
];

const IDLE_STATE = {
  active: false,
  phase: 'idle',
  elapsed: 0,
  winnerId: null,
  pmPosition: null,
  pmPose: null,
};

/**
 * Hook: fires the room-start mini-ceremony when conditions are met.
 *
 * @param {object} opts
 * @param {string} opts.roomCode
 * @param {string} opts.playerId
 * @param {string} opts.role
 * @param {boolean} opts.connected
 * @param {boolean} opts.isLeader
 * @param {Record<string, any>} opts.players
 * @param {object|null} opts.roomStartCrowning  live payload from Firebase
 * @param {object|null} opts.pmRoulette  active ceremony (blocks mini-ceremony)
 * @returns {object} { active, phase, elapsed, winnerId }
 */
export function useRoomStartCrowning({
  roomCode,
  playerId,
  role,
  connected,
  isLeader,
  players,
  roomStartCrowning,
  pmRoulette,
  ceremonyStartPos,
}) {
  const [phaseState, setPhaseState] = useState(IDLE_STATE);
  const firedRef = useRef(false);
  // Walk-in delay: wait 3s after connection so the player figure's walk-in
  // animation finishes before the PM ceremony starts.
  const [walkInReady, setWalkInReady] = useState(false);

  // Reset guards when roomCode changes
  useEffect(() => {
    firedRef.current = false;
    setWalkInReady(false);
  }, [roomCode]);

  // Timer: set walkInReady=true 3s after first connection
  useEffect(() => {
    if (!connected) return;
    const t = setTimeout(() => setWalkInReady(true), 3000);
    return () => clearTimeout(t);
  }, [connected]);

  // Trigger detection: fire the mini-ceremony when conditions are met
  useEffect(() => {
    if (!roomCode || !playerId || !connected) return;
    if (firedRef.current) return;
    if (!walkInReady) return; // wait for walk-in animation to finish
    if (role !== 'player') return;
    if (!isLeader) return;
    if (pmRoulette) return;
    if (roomStartCrowning) return;

    // Check if we're the first (and only) player in the room
    const playerIds = Object.keys(players);
    if (playerIds.length > 1) return;
    if (playerIds.length === 1 && playerIds[0] !== playerId) return;

    firedRef.current = true;

    const now = Date.now();
    const payload = {
      ceremonyId: `rsc-${now}-${((Math.random() * 0xffff) | 0).toString(16)}`,
      startedAt: now,
      winnerId: playerId,
      schemaVersion: 1,
    };

    // Transaction to avoid double-fire from StrictMode
    runTransaction(
      ref(db, `rooms/${roomCode}/meta/roomStartCrowning`),
      (current) => {
        if (current) return; // abort — someone else already wrote
        return payload;
      }
    ).catch(() => {
      // Reset guard if write fails so we can retry
      firedRef.current = false;
    });
  }, [roomCode, playerId, role, connected, isLeader, players, roomStartCrowning, pmRoulette, walkInReady]);

  // Precompute positions once when payload arrives (stable across ticks)
  const positionsRef = useRef(null);
  useEffect(() => {
    if (!roomStartCrowning) { positionsRef.current = null; return; }
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    positionsRef.current = {
      start: ceremonyStartPos || { x: vw / 2, y: vh - 140 },
      target: computePlayerGridPosition(0, 1, vw),
    };
  }, [roomStartCrowning?.ceremonyId]);

  // Phase machine tick — computes visual state from elapsed time
  const ceremonyTick = useCallback((elapsed) => {
    if (!roomStartCrowning || !positionsRef.current) return;
    const { start: startPos, target: targetPos } = positionsRef.current;
    const row = currentPhaseRow(PHASE_TABLE_ROOM_START, elapsed);

    let pmPosition = null;
    let pmPose = 'walk1';
    if (row.phase === 'pmEntry') {
      const t = easeInOutCubic(Math.min(1, elapsed / 1200));
      pmPosition = {
        x: startPos.x + (targetPos.x - startPos.x) * t,
        y: startPos.y + (targetPos.y - startPos.y) * t,
      };
      pmPose = Math.floor(elapsed / CEREMONY_WALK_FRAME_MS) % 2 === 0 ? 'walk1' : 'walk2';
    } else if (row.phase === 'castAndMaterialize' || row.phase === 'crownPlace') {
      pmPosition = targetPos;
      pmPose = 'cast';
    } else if (row.phase === 'pmExit') {
      const t = easeInOutCubic(Math.min(1, (elapsed - 2500) / 1000));
      pmPosition = {
        x: targetPos.x + (startPos.x - targetPos.x) * t,
        y: targetPos.y + (startPos.y - targetPos.y) * t,
      };
      pmPose = Math.floor(elapsed / CEREMONY_WALK_FRAME_MS) % 2 === 0 ? 'walk1' : 'walk2';
    }

    setPhaseState({
      active: row.phase !== 'done',
      phase: row.phase,
      elapsed,
      winnerId: roomStartCrowning.winnerId,
      pmPosition,
      pmPose,
    });

    if (row.phase === 'done') {
      cleanupPayload(roomCode, roomStartCrowning.ceremonyId);
    }
  }, [roomStartCrowning?.ceremonyId, roomCode]);

  // Stale payload check — must run before the animation loop
  useEffect(() => {
    if (!roomStartCrowning) { setPhaseState(IDLE_STATE); return; }
    const startingElapsed = Math.max(0, Date.now() - (roomStartCrowning.startedAt || Date.now()));
    if (startingElapsed > 3500 + 500) {
      setPhaseState(IDLE_STATE);
      cleanupPayload(roomCode, roomStartCrowning.ceremonyId);
    }
  }, [roomStartCrowning?.ceremonyId, roomCode]);

  // Drive the ceremony with requestAnimationFrame
  useAnimationLoop(
    roomStartCrowning ? ceremonyTick : null,
    roomStartCrowning?.startedAt,
  );

  // Expose walkInReady so useCrownOwnership can suppress the crown
  // during the 3s walk-in delay (before ceremony fires, isLeader is
  // already true but the PM hasn't delivered the crown yet).
  return { ...phaseState, walkInReady };
}

async function cleanupPayload(roomCode, ceremonyId) {
  if (!roomCode) return;
  try {
    const snap = await get(ref(db, `rooms/${roomCode}/meta/roomStartCrowning`));
    const current = snap.val();
    if (current && current.ceremonyId === ceremonyId) {
      await set(ref(db, `rooms/${roomCode}/meta/roomStartCrowning`), null);
    }
  } catch {
    // Best-effort cleanup
  }
}

export { PHASE_TABLE_ROOM_START };
