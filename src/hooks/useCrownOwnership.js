/**
 * useCrownOwnership — single source of truth for where the crown is.
 *
 * Returns one `crownOwnership` object with a mutually exclusive `location`
 * enum so that exactly ONE renderer can show the crown at any time.
 *
 * Priority rules (first match wins):
 *   Rule 1: Slot machine ceremony active (crownCeremonyState exists)
 *   Rule 2: Room-start ceremony active (roomStartState.active)
 *   Rule 3: Idle — crown on whoever has isLeader && role !== 'pm'
 *
 * Pure derivation — no useEffect, no timers, no side effects.
 */

import { useMemo } from 'react';

const NONE = { location: 'none', playerId: null, progress: 0, glowing: false };

/**
 * @param {object} opts
 * @param {Record<string, { isLeader?: boolean, role?: string }>} opts.players
 * @param {object|null} opts.slotMachinePhaseState   phaseState from useSlotMachine
 * @param {object|null} opts.roomStartState           phaseState from useRoomStartCrowning
 * @param {object|null} opts.pmRoulette               raw ceremony payload (kept for API compat)
 * @returns {{ location: string, playerId: string|null, progress: number, glowing: boolean }}
 */
export function useCrownOwnership({
  players,
  slotMachinePhaseState,
  roomStartState,
  pmRoulette,
}) {
  return useMemo(() => {
    // ------------------------------------------------------------------
    // Rule 1: Slot machine ceremony active
    // ------------------------------------------------------------------
    // crownCeremonyState is now in the final { location, playerId,
    // progress, glowing } format — no mapping needed.
    const ccs = slotMachinePhaseState?.crownCeremonyState;
    if (ccs) return ccs;

    // If the slot machine is in a non-idle, non-done phase but has no
    // crownCeremonyState (e.g. spinning), the crown is 'none' — the
    // ceremony is active but the crown hasn't been introduced yet.
    const smPhase = slotMachinePhaseState?.phase;
    if (smPhase && smPhase !== 'idle' && smPhase !== 'done') {
      return NONE;
    }

    // ------------------------------------------------------------------
    // Rule 2: Room-start ceremony active
    // ------------------------------------------------------------------
    if (roomStartState?.active) {
      return mapRoomStartCrown(roomStartState);
    }

    // ------------------------------------------------------------------
    // Rule 2.5: Room-start ceremony PENDING (walk-in delay, 3s)
    // ------------------------------------------------------------------
    if (roomStartState && !roomStartState.walkInReady && !roomStartState.active) {
      const leaderEntry = Object.entries(players || {}).find(
        ([, d]) => d.isLeader && d.role !== 'pm'
      );
      const playerCount = Object.keys(players || {}).filter(
        k => (players[k]?.role || 'player') !== 'pm'
      ).length;
      if (leaderEntry && playerCount <= 1) {
        return NONE;
      }
    }

    // ------------------------------------------------------------------
    // Rule 3: Idle — crown on leader
    // ------------------------------------------------------------------
    const leaderEntry = Object.entries(players || {}).find(
      ([, d]) => d.isLeader && d.role !== 'pm'
    );
    if (leaderEntry) {
      return {
        location: 'player-head',
        playerId: leaderEntry[0],
        progress: 1,
        glowing: false,
      };
    }

    return NONE;
  }, [players, slotMachinePhaseState, roomStartState, pmRoulette]);
}

// ---------------------------------------------------------------------------
// Rule 2 mapper: room-start ceremony -> crownOwnership
// ---------------------------------------------------------------------------

function mapRoomStartCrown(roomStartState) {
  const { phase, elapsed, winnerId } = roomStartState;

  if (phase === 'pmEntry') {
    return NONE;
  }

  if (phase === 'castAndMaterialize') {
    const matDuration = 800;
    const matProgress = Math.min(1, (elapsed - 1200) / matDuration);
    return {
      location: 'materializing',
      playerId: null,
      progress: Math.max(0, matProgress),
      glowing: true,
    };
  }

  if (phase === 'crownPlace') {
    const placeProgress = Math.min(1, (elapsed - 2000) / 500);
    return {
      location: 'arcing-to-player',
      playerId: winnerId,
      progress: Math.max(0, placeProgress),
      glowing: true,
    };
  }

  if (phase === 'pmExit' || phase === 'done') {
    return {
      location: 'player-head',
      playerId: winnerId,
      progress: 1,
      glowing: false,
    };
  }

  return NONE;
}
