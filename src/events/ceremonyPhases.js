/**
 * Pure ceremony phase computation functions for the PM Crowning Machine.
 *
 * Zero React imports. No DOM access, Firebase, or timers. Every function
 * is a pure computation that the tick loop in useSlotMachine calls.
 *
 * Extracted from useSlotMachine.js to keep the hook file focused on React
 * lifecycle (rAF loop, state, callbacks) while this module owns the math.
 */

import { currentPhaseRow } from '../events/slotMachine';
import { computeReelStates, REEL2_CLICK_MOMENTS } from './ceremonyReelComputation';
import { computeCrownRemoval, computeCrownDelivery } from './ceremonyPmWalk';

// Re-export for consumers that import from this module.
export { REEL2_CLICK_MOMENTS, computeReelStates };

export const IDLE_STATE = {
  phase: 'idle',
  elapsed: 0,
  phaseStartedAt: 0,
  reelStates: [
    { stopped: false, currentIndex: 0, flareActive: false, rumble: false, transitionMode: 'none', pulseActive: false, dimmed: false },
    { stopped: false, currentIndex: 0, flareActive: false, rumble: false, transitionMode: 'none', pulseActive: false, dimmed: false },
    { stopped: false, currentIndex: 0, flareActive: false, rumble: false, transitionMode: 'none', pulseActive: false, dimmed: false },
  ],
  cabinetTransform: 'offscreen',
  winnerEmphasis: 'none',
  marqueeText: 'choosing',
  bulbPattern: 'chase',
  crownPosition: null,
  flourish: null,
  skippable: false,
  pmMode: 'gone',
  dimLevel: 0,
  // v2 additions
  matchedHoldActive: false,
  matchedHoldPhaseStart: 0,
  reel3StillSpinning: false,
  nudgeActive: false,
  matchConfirmed: null,
  matchingReelIndices: [],
  nonMatchReelIndex: null,
  isTripleJackpot: false,
  // Crown ceremony state
  crownRemovalState: null,
  crownDeliveryState: null,
  pmCeremonyPosition: null,
  pmCeremonyPose: null,
  pmCeremonyBubble: null,
  pmCeremonyFacing: null,
  crownCeremonyState: null,
  leaderWalkOffTriggered: false,
  showProcessionAnnouncement: false,
  processionSpotlightPosition: null,
  processionDimLevel: 0,
  isPmCreatorCase: false,
};

// ---------------------------------------------------------------------------
// Pure phase-state computation
// ---------------------------------------------------------------------------

const SKIP_AFTER_MS = 2000;

/**
 * Pure helper: compute the client-visible phase state for a given elapsed
 * time. This is the whole brain — everything time-driven comes out of here.
 *
 * @param {number} elapsed  ms from ceremony.startedAt
 * @param {object} ceremony frozen payload
 * @param {object} context  { reelOrders, table, reducedMotion, ... }
 * @returns {object} phaseState
 */
export function computePhaseState(elapsed, ceremony, context) {
  if (!ceremony) return IDLE_STATE;

  const { table, reducedMotion } = context;
  const row = currentPhaseRow(table, elapsed);
  const phase = row.phase;
  const phaseElapsed = elapsed - row.startAt;
  const skippable = elapsed >= SKIP_AFTER_MS;
  const winnerIndexInReel2 = context.winnerIndexInReel2;
  const nearMissIndexInReel2 = context.nearMissIndexInReel2;
  const isPmCreatorCase = ceremony.outgoingLeaderHadCrown === false;

  // === Cabinet transform (v4: cabinetDrop is separate phase) ================
  let cabinetTransform = 'offscreen';
  if (phase === 'crownRemoval') {
    cabinetTransform = 'offscreen';
  } else if (phase === 'cabinetDrop') {
    if (phaseElapsed < 250) cabinetTransform = 'entering';
    else if (phaseElapsed < 300) cabinetTransform = 'bounced';
    else cabinetTransform = 'landed';
  } else if (phase === 'done') {
    cabinetTransform = 'gone';
  } else if (phase === 'cabinetOut') {
    cabinetTransform = 'exiting';
  } else if (phase === 'crownDelivery') {
    cabinetTransform = 'gone';
  } else {
    // spinning, decelerating, matchedHold, reel3Decel, winnerFreeze, winnerEmphasis
    cabinetTransform = 'landed';
  }

  // === Dim level (v4: 35% during Acts 1+3, 100% during cabinet) ============
  let dimLevel = 0;
  if (phase === 'crownRemoval') {
    // Ramp from 0% to 35% during first 400ms
    if (phaseElapsed < 400) dimLevel = (phaseElapsed / 400) * 0.35;
    else dimLevel = 0.35;
  } else if (phase === 'cabinetDrop') {
    // Ramp from 35% to 100% over 200ms
    const rampProgress = Math.min(1, phaseElapsed / 200);
    dimLevel = 0.35 + rampProgress * 0.65;
  } else if (phase === 'cabinetOut') {
    // Fade from 1.0 to 0.35 over cabinetOut duration
    dimLevel = Math.max(0.35, 1 - (phaseElapsed / row.duration) * 0.65);
  } else if (phase === 'crownDelivery') {
    // Sustain 35% until crown placed (t=3000ms within phase), then ramp to 0
    if (phaseElapsed < 3000) {
      dimLevel = 0.35;
    } else {
      dimLevel = Math.max(0, 0.35 * (1 - (phaseElapsed - 3000) / 800));
    }
  } else if (phase === 'done') {
    dimLevel = 0;
  } else {
    // All cabinet-internal phases
    dimLevel = 1;
  }

  // === PM mode ==========================================================
  let pmMode = 'gone';

  // === Crown removal state (Act 1) ==========================================
  let crownRemovalState = null;
  let crownDeliveryState = null;
  let pmCeremonyPosition = null;
  let pmCeremonyPose = null;
  let pmCeremonyBubble = null;
  let pmCeremonyFacing = null;
  let crownCeremonyState = null;
  let leaderWalkOffTriggered = false;

  if (phase === 'crownRemoval') {
    const cr = computeCrownRemoval(phaseElapsed, ceremony, context);
    crownRemovalState = cr.crownRemovalState;
    pmCeremonyPosition = cr.pmCeremonyPosition;
    pmCeremonyPose = cr.pmCeremonyPose;
    pmCeremonyBubble = cr.pmCeremonyBubble;
    pmCeremonyFacing = cr.pmCeremonyFacing;
    crownCeremonyState = cr.crownCeremonyState;
    leaderWalkOffTriggered = cr.leaderWalkOffTriggered;
    pmMode = 'ceremony';
  }

  if (phase === 'crownDelivery') {
    const cd = computeCrownDelivery(phaseElapsed, ceremony, context);
    crownDeliveryState = cd.crownDeliveryState;
    pmCeremonyPosition = cd.pmCeremonyPosition;
    pmCeremonyPose = cd.pmCeremonyPose;
    pmCeremonyBubble = cd.pmCeremonyBubble;
    pmCeremonyFacing = cd.pmCeremonyFacing;
    crownCeremonyState = cd.crownCeremonyState;
    pmMode = 'ceremony';
  }

  // PM stays visible during Act 2 (cabinet), standing at bottom-center holding the crown.
  // Uses ceremonyStartPos when available so the PM's waiting position is consistent
  // with where it paused the idle walk (no teleport to viewport center).
  if (pmMode === 'gone' && phase !== 'done' && phase !== 'cabinetOut') {
    // Cabinet phases: PM stands at bottom watching the slot machine
    if (['cabinetDrop', 'spinning', 'decelerating', 'matchedHold', 'reel3Decel', 'winnerFreeze', 'winnerEmphasis'].includes(phase)) {
      pmMode = 'ceremony';
      pmCeremonyPose = 'walk1';
      const fallbackX = (context.viewportWidth || 1440) / 2;
      const fallbackY = (context.viewportHeight || 900) - 100;
      pmCeremonyPosition = context.ceremonyStartPos
        ? { x: context.ceremonyStartPos.x, y: fallbackY }
        : { x: fallbackX, y: fallbackY };
      pmCeremonyFacing = 'right';
      crownCeremonyState = ceremony.outgoingLeaderHadCrown
        ? { location: 'pm-hand', playerId: null, progress: 1, glowing: true }
        : null;
    }
  }

  // v4: PM begins walking during last 200ms of cabinetOut (overlap to prevent gap)
  if (phase === 'cabinetOut' && phaseElapsed >= 200) {
    pmMode = 'ceremony';
    pmCeremonyPose = 'walk1';
    const vw = context.viewportWidth || 1440;
    const vh = context.viewportHeight || 900;
    pmCeremonyPosition = context.ceremonyStartPos || { x: vw / 2, y: vh - 140 };
    crownCeremonyState = ceremony.outgoingLeaderHadCrown
      ? { location: 'pm-hand', playerId: null, progress: 1, glowing: true }
      : null;
  }

  // === Procession state (Act 3 specific) ====================================
  let showProcessionAnnouncement = false;
  let processionSpotlightPosition = null;
  let processionDimLevel = 0;

  if (phase === 'crownDelivery') {
    // "THE CROWN PASSES" text visible for first 1080ms
    // UX Researcher: 3500ms min for comfortable reading of 3-word
    // pixel-font announcement. Was 1080ms — too fast to read.
    showProcessionAnnouncement = phaseElapsed < 3500;
    processionSpotlightPosition = pmCeremonyPosition;
    processionDimLevel = 0.35;
  }

  // === Reel states ==========================================================
  const reelStates = computeReelStates(elapsed, phase, phaseElapsed, context);

  // === Winner emphasis ======================================================
  let winnerEmphasis = 'none';
  if (phase === 'winnerFreeze') winnerEmphasis = 'none';
  else if (phase === 'winnerEmphasis') winnerEmphasis = 'beat2';
  // Reel crown only for the first 200ms of cabinetOut — at 200ms the PM
  // picks up its own crown (line 346), so the reel crown must stop to avoid
  // two crowns on screen simultaneously (double crown bug).
  else if (phase === 'cabinetOut') winnerEmphasis = phaseElapsed < 200 ? 'crowned' : 'beat2';

  // === Marquee text (v3: triple jackpot swap) ================================
  let marqueeText = 'choosing';
  if (ceremony.wasCompressed && (phase === 'winnerFreeze' || phase === 'winnerEmphasis' || phase === 'crownRemoval')) {
    marqueeText = 'compressed';
  } else if (phase === 'crownRemoval' || phase === 'cabinetDrop' || phase === 'spinning' || phase === 'decelerating' || phase === 'matchedHold' || phase === 'reel3Decel') {
    marqueeText = 'choosing';
  } else if (phase === 'winnerFreeze') {
    marqueeText = 'rising';
  } else if (phase === 'winnerEmphasis') {
    if (ceremony.isTripleJackpot && phaseElapsed < 400) {
      marqueeText = 'tripleJackpot';
    } else {
      marqueeText = 'rising';
    }
  } else {
    marqueeText = 'hailing';
  }

  // === Bulb pattern =========================================================
  let bulbPattern = 'chase';
  if (phase === 'spinning' || phase === 'decelerating' || phase === 'matchedHold') {
    bulbPattern = 'chase';
  } else if (phase === 'reel3Decel') {
    const lastClick = REEL2_CLICK_MOMENTS[REEL2_CLICK_MOMENTS.length - 1];
    const nearMissHoldStart = lastClick;
    const nudgeStart = nearMissHoldStart + 200;
    if (elapsed >= nearMissHoldStart && elapsed < nudgeStart) {
      bulbPattern = 'dark';
    } else {
      bulbPattern = 'chase';
    }
  } else if (phase === 'winnerFreeze' || phase === 'winnerEmphasis') {
    bulbPattern = 'allLit';
  } else if (phase === 'cabinetOut' || phase === 'done' || phase === 'crownDelivery') {
    bulbPattern = 'slowPulse';
  } else {
    bulbPattern = 'chase';
  }

  // === Matched-hold state (v4: 5050ms abs start) ============================
  let matchedHoldActive = false;
  let matchedHoldPhaseStart = 0;
  let reel3StillSpinning = false;
  if (phase === 'matchedHold') {
    matchedHoldActive = true;
    matchedHoldPhaseStart = context.matchedHoldAbsoluteStart || row.startAt;
    reel3StillSpinning = true;
  }

  // === v3 match confirmation state ==========================================
  const nonMatchReelIndex = ceremony.wasCompressed ? null
    : (ceremony.winnerReelPair
      ? [0, 1, 2].find(i => !ceremony.winnerReelPair.includes(i))
      : null);
  const matchingReelIndices = ceremony.wasCompressed ? []
    : (ceremony.winnerReelPair
      ? [...ceremony.winnerReelPair, ...(ceremony.isTripleJackpot ? [2] : [])]
      : []);
  let matchConfirmed = null;
  if ((phase === 'winnerEmphasis' || phase === 'cabinetOut') && ceremony.winnerReelPair) {
    matchConfirmed = {
      reels: ceremony.winnerReelPair,
      isTriple: ceremony.isTripleJackpot,
    };
  }

  // === Nudge state ==========================================================
  let nudgeActive = false;
  let nonMatchRelief = false;
  let nonMatchReliefPlayerId = null;
  if (phase === 'reel3Decel') {
    const lastClick = REEL2_CLICK_MOMENTS[REEL2_CLICK_MOMENTS.length - 1];
    const nearMissHoldStart = lastClick;
    const nudgeStart = nearMissHoldStart + 200;
    if (elapsed >= nudgeStart) {
      nudgeActive = true;
    }
    if (elapsed >= nearMissHoldStart && elapsed < nudgeStart) {
      nonMatchRelief = true;
      nonMatchReliefPlayerId = ceremony.nonMatchReelPlayerId || null;
    }
  }

  // === Crown position (reel-only during cabinet) ============================
  let crownPosition = null;
  if (phase === 'winnerEmphasis' || phase === 'cabinetOut') {
    crownPosition = { mode: 'settled', progress: 1 };
  }

  // === Flourish ============================================================
  const flourish = (phase === 'winnerEmphasis' || phase === 'cabinetOut')
    ? (ceremony.flourishVariant || null)
    : null;

  return {
    phase,
    elapsed,
    phaseStartedAt: row.startAt,
    reelStates,
    cabinetTransform,
    winnerEmphasis,
    marqueeText,
    bulbPattern,
    crownPosition,
    flourish,
    skippable,
    pmMode,
    dimLevel,
    reducedMotion,
    winnerIndexInReel2,
    nearMissIndexInReel2,
    // v2 additions
    matchedHoldActive,
    matchedHoldPhaseStart,
    reel3StillSpinning,
    nudgeActive,
    nonMatchRelief,
    nonMatchReliefPlayerId,
    // v3 additions
    matchConfirmed,
    matchingReelIndices,
    nonMatchReelIndex,
    isTripleJackpot: ceremony.isTripleJackpot || false,
    // v4: crown ceremony state
    crownRemovalState,
    crownDeliveryState,
    pmCeremonyPosition,
    pmCeremonyPose,
    pmCeremonyBubble,
    pmCeremonyFacing,
    crownCeremonyState,
    leaderWalkOffTriggered,
    isPmCreatorCase,
    showProcessionAnnouncement,
    processionSpotlightPosition,
    processionDimLevel,
  };
}

