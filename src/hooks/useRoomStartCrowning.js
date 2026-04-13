/**
 * useRoomStartCrowning — mini-ceremony phase machine for the room-start
 * crown delivery to a player-role first joiner.
 *
 * Separate from useSlotMachine because the mini-ceremony has NO cabinet,
 * NO reels, NO matched-hold, NO near-miss. It is a completely different
 * phase table (Wizard walk + crown materialize + crown place + Wizard exit).
 *
 * Tech design v2 §7.
 *
 * Payload shape (rooms/{code}/meta/roomStartCrowning):
 *   { ceremonyId, startedAt, winnerId, schemaVersion: 1 }
 *
 * Phase table (~1.7s core + ~500ms entry walk = ~2.2s total):
 *   wizardEntry (0-500ms), castAndMaterialize (500-1000ms),
 *   crownPlace (1000-1250ms), wizardExit (1250-1700ms), done.
 */

import { useEffect, useRef, useState } from 'react';
import { db, ref, set, get, runTransaction } from '../firebase';
import { computePlayerGridPosition } from './useSlotMachine';

const TICK_MS = 16;
const CEREMONY_WALK_FRAME_MS = 400;

// Slowed to ~3.5s so each phase is visually appreciable (was 1.7s — too fast
// to distinguish walk-in, cast, crown-place, walk-out as separate steps).
// Matches the "2x slower" design intent applied to the full crown ceremony.
const PHASE_TABLE_ROOM_START = [
  { phase: 'wizardEntry',        startAt:    0, duration: 1200 },
  { phase: 'castAndMaterialize', startAt: 1200, duration:  800 },
  { phase: 'crownPlace',         startAt: 2000, duration:  500 },
  { phase: 'wizardExit',         startAt: 2500, duration: 1000 },
  { phase: 'done',               startAt: 3500, duration:    0 },
];

function currentPhaseRow(table, elapsed) {
  if (elapsed < 0) return table[0];
  for (let i = 0; i < table.length - 1; i++) {
    const row = table[i];
    const next = table[i + 1];
    if (elapsed >= row.startAt && elapsed < next.startAt) return row;
  }
  return table[table.length - 1];
}

const IDLE_STATE = {
  active: false,
  phase: 'idle',
  elapsed: 0,
  winnerId: null,
  // iter 4: vertical movement position for PM during room-start crowning
  wizardPosition: null,
  wizardPose: null,
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
  const intervalRef = useRef(null);
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

  // Phase machine: animate the mini-ceremony when payload exists
  useEffect(() => {
    if (!roomStartCrowning) {
      setPhaseState(IDLE_STATE);
      return;
    }

    const observedAt = Date.now();
    const startingElapsed = Math.max(0, observedAt - (roomStartCrowning.startedAt || observedAt));

    // Too late — ceremony already done
    if (startingElapsed > 3500 + 500) {
      setPhaseState(IDLE_STATE);
      // Cleanup stale payload
      cleanupPayload(roomCode, roomStartCrowning.ceremonyId);
      return;
    }

    const phaseClockOriginRef = { current: observedAt - startingElapsed };

    // Compute player grid position with pure math (no DOM query)
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    const startPos = ceremonyStartPos || { x: vw / 2, y: vh - 140 };
    const targetPos = computePlayerGridPosition(0, 1, vw);

    const tick = () => {
      const now = Date.now();
      const elapsed = now - phaseClockOriginRef.current;
      const row = currentPhaseRow(PHASE_TABLE_ROOM_START, elapsed);

      // iter 4: compute vertical walk position
      let wizardPosition = null;
      let wizardPose = 'walk1';
      if (row.phase === 'wizardEntry') {
        const p = Math.min(1, elapsed / 1200); // 1200ms entry walk (was 500)
        const x = startPos.x + (targetPos.x - startPos.x) * p;
        const y = startPos.y + (targetPos.y - startPos.y) * p;
        wizardPosition = { x, y };
        wizardPose = Math.floor(elapsed / CEREMONY_WALK_FRAME_MS) % 2 === 0 ? 'walk1' : 'walk2';
      } else if (row.phase === 'castAndMaterialize' || row.phase === 'crownPlace') {
        wizardPosition = targetPos;
        wizardPose = 'cast';
      } else if (row.phase === 'wizardExit') {
        const p = Math.min(1, (elapsed - 2500) / 1000); // starts at 2500ms, 1000ms exit walk (was 1250/450)
        const x = targetPos.x + (startPos.x - targetPos.x) * p;
        const y = targetPos.y + (startPos.y - targetPos.y) * p;
        wizardPosition = { x, y };
        wizardPose = Math.floor(elapsed / CEREMONY_WALK_FRAME_MS) % 2 === 0 ? 'walk1' : 'walk2';
      }

      setPhaseState({
        active: row.phase !== 'done',
        phase: row.phase,
        elapsed,
        winnerId: roomStartCrowning.winnerId,
        wizardPosition,
        wizardPose,
      });

      if (row.phase === 'done') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        // Cleanup the Firebase payload
        cleanupPayload(roomCode, roomStartCrowning.ceremonyId);
      }
    };

    tick();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, TICK_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [roomStartCrowning?.ceremonyId, roomCode]);

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
