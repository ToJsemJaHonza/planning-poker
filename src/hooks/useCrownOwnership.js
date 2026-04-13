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
 * @param {object|null} opts.pmRoulette               raw ceremony payload (for outgoingLeaderId / winnerId)
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
    const ccs = slotMachinePhaseState?.crownCeremonyState;
    if (ccs) {
      return mapSlotMachineCrown(ccs, pmRoulette);
    }

    // If the slot machine is in a non-idle, non-done phase but has no
    // crownCeremonyState (e.g. spinning), the crown is 'none' — the
    // ceremony is active but the crown hasn't been introduced yet.
    const smPhase = slotMachinePhaseState?.phase;
    if (smPhase && smPhase !== 'idle' && smPhase !== 'done') {
      // PM-creator case: outgoing leader had no crown, so during
      // crownRemoval there's nothing to show.
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
    // isLeader is already true in Firebase but the PM hasn't delivered
    // the crown yet. Show NO crown — it will appear when the ceremony
    // fires and the PM materializes it.
    // ------------------------------------------------------------------
    if (roomStartState && !roomStartState.walkInReady && !roomStartState.active) {
      // Check: is this player the sole leader in a fresh room?
      const leaderEntry = Object.entries(players || {}).find(
        ([, d]) => d.isLeader && d.role !== 'pm'
      );
      const playerCount = Object.keys(players || {}).filter(
        k => (players[k]?.role || 'player') !== 'pm'
      ).length;
      if (leaderEntry && playerCount <= 1) {
        return NONE; // suppress crown until ceremony delivers it
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
// Rule 1 mapper: slot machine crownCeremonyState -> crownOwnership
// ---------------------------------------------------------------------------

function mapSlotMachineCrown(ccs, pmRoulette) {
  const { parent, progress } = ccs;

  if (parent === 'leader-head' && progress === 0) {
    // Crown still on outgoing leader's head (not yet lifted)
    return {
      location: 'player-head',
      playerId: pmRoulette?.outgoingLeaderId || null,
      progress: 1,
      glowing: false,
    };
  }

  if (parent === 'leader-head' && progress > 0) {
    // Lifting from leader head toward wizard hand
    return {
      location: 'lifting',
      playerId: pmRoulette?.outgoingLeaderId || null,
      progress,
      glowing: true,
    };
  }

  if (parent === 'wizard-hand') {
    // Crown held at wizard's raised-hand anchor
    return {
      location: 'wizard-hand',
      playerId: null,
      progress: 1,
      glowing: true,
    };
  }

  if (parent === 'materializing') {
    // PM-creator case: crown fading in at wizard hand
    return {
      location: 'materializing',
      playerId: null,
      progress,
      glowing: true,
    };
  }

  if (parent === 'new-leader-head' && progress < 1) {
    // Arcing from wizard hand down to new leader's head
    return {
      location: 'arcing-to-player',
      playerId: pmRoulette?.winnerId || null,
      progress,
      glowing: true,
    };
  }

  if (parent === 'new-leader-head' && progress >= 1) {
    // Settled on the new leader's head — immediate handoff to PlayerFigure
    return {
      location: 'player-head',
      playerId: pmRoulette?.winnerId || null,
      progress: 1,
      glowing: false,
    };
  }

  // Fallback
  return NONE;
}

// ---------------------------------------------------------------------------
// Rule 2 mapper: room-start ceremony -> crownOwnership
// ---------------------------------------------------------------------------

function mapRoomStartCrown(roomStartState) {
  const { phase, elapsed, winnerId } = roomStartState;

  if (phase === 'wizardEntry') {
    // Crown not yet created
    return NONE;
  }

  if (phase === 'castAndMaterialize') {
    // Crown materializing at wizard hand (500-1000ms in original, 1200-2000ms slowed)
    const matDuration = 800; // castAndMaterialize phase duration
    const matProgress = Math.min(1, (elapsed - 1200) / matDuration);
    return {
      location: 'materializing',
      playerId: null,
      progress: Math.max(0, matProgress),
      glowing: true,
    };
  }

  if (phase === 'crownPlace') {
    // Crown arcing from wizard hand to player head
    const placeProgress = Math.min(1, (elapsed - 2000) / 500);
    return {
      location: 'arcing-to-player',
      playerId: winnerId,
      progress: Math.max(0, placeProgress),
      glowing: true,
    };
  }

  if (phase === 'wizardExit' || phase === 'done') {
    // Crown resting on the winner's head
    return {
      location: 'player-head',
      playerId: winnerId,
      progress: 1,
      glowing: false,
    };
  }

  return NONE;
}
