/**
 * useSlotMachine — the phase machine for the PM Crowning Machine ceremony.
 *
 * Consumes a frozen ceremony payload (from Firebase `meta/pmRoulette`) and
 * exposes a single derived `phaseState` object that the visual components
 * (`SlotMachine`, `SlotReel`, `SlotMachineStage`, etc.) render from.
 *
 * --- ITERATION 4 ---
 * 3-act ceremony: crownRemoval (Act 1) -> cabinet phases (Act 2) -> crownDelivery (Act 3).
 * Ghost figure eliminated. PM walks vertically into grid during Acts 1 and 3.
 * Phase table v4: crownRemoval replaces preSpin, crownDelivery replaces postCabinet.
 * New cabinetDrop phase (300ms) between crownRemoval and spinning.
 * All reel timing constants shifted +1250ms from v3.
 * computeCrownRemoval and computeCrownDelivery replace computePostCabinetState.
 * Wizard vertical movement via computeWizardWalkPosition.
 * leaderWalkOffTriggered flag for PlayerList coordination.
 *
 * See `.claude/pipeline-tech-design-v4.md` for the canonical spec.
 */

import { useEffect, useRef, useState } from 'react';
import {
  PHASE_TABLE_STANDARD,
  PHASE_TABLE_COMPRESSED,
  PHASE_TABLE_REDUCED,
  REEL0_STOP_AT,
  REEL1_STOP_AT,
  REEL2_SLOWDOWN_INTERVALS,
  REEL2_SLOWDOWN_START,
  currentPhaseRow,
  phaseTableFor,
  totalDurationFor,
  buildReelOrder,
  placeEntryAt,
  FAREWELL_PHRASES,
  CROWNING_BUBBLES,
} from '../events/slotMachine';
import { easeInOutCubic, CEREMONY_WALK_FRAME_MS } from '../engine/animation';
import { shallowEqual } from '../engine/shallowEqual';

const TICK_MS = 16;
const SKIP_AFTER_MS = 2000;
const DRIFT_TOLERANCE_MS = 500;

// Cumulative offsets for the 6 slowdown click moments on reel 2.
export const REEL2_CLICK_MOMENTS = (() => {
  const out = [];
  let t = REEL2_SLOWDOWN_START;
  for (let i = 0; i < REEL2_SLOWDOWN_INTERVALS.length; i++) {
    t += REEL2_SLOWDOWN_INTERVALS[i];
    out.push(t);
  }
  return out;
})();

// ---------------------------------------------------------------------------
// Vertical walk path computation (tech design v4 §3.3)
// ---------------------------------------------------------------------------

/**
 * Compute a blended vertical-first walk position.
 * Phase 1 (0-70% progress): pure vertical movement.
 * Phase 2 (70-100%): blend in horizontal correction for a gentle curve.
 *
 * @param {number} progress 0-1 clamped
 * @param {number} startX
 * @param {number} startY
 * @param {number} targetX
 * @param {number} targetY
 * @returns {{ x: number, y: number }}
 */
export function computeWizardWalkPosition(progress, startX, startY, targetX, targetY) {
  // Eased interpolation on both axes simultaneously for smooth movement.
  const p = Math.max(0, Math.min(1, progress));
  const t = easeInOutCubic(p);
  const x = startX + (targetX - startX) * t;
  const y = startY + (targetY - startY) * t;
  return { x, y };
}

// ---------------------------------------------------------------------------
// Math-based grid position (replaces DOM query — tech design v5)
// ---------------------------------------------------------------------------

/**
 * Compute a player's center position in the flex-wrap grid without touching
 * the DOM. Mirrors the actual CSS grid layout in PlayerList.jsx:
 *   - gap: 16px 28px (row-gap x col-gap)
 *   - item width: 80px (fixed player slot width)
 *   - container padding: 16px on each side
 *   - grid top: 174px from viewport top (header + task bar + phase bar)
 *   - item height: 180px (card + figure + name tag)
 *
 * @param {number} index  0-based index in the sorted player list
 * @param {number} playerCount  total players in the grid
 * @param {number} viewportWidth  window.innerWidth
 * @returns {{ x: number, y: number }}
 */
export function computePlayerGridPosition(index, playerCount, viewportWidth) {
  const ITEM_WIDTH = 80;
  const COL_GAP = 28;
  const ROW_GAP = 16;
  const ITEM_HEIGHT = 180;
  const GRID_TOP = 174;
  const CONTAINER_PAD_X = 16;

  const availableWidth = viewportWidth - 2 * CONTAINER_PAD_X;
  const slotPitch = ITEM_WIDTH + COL_GAP;
  const columnsPerRow = Math.max(1, Math.floor((availableWidth + COL_GAP) / slotPitch));

  const col = index % columnsPerRow;
  const row = Math.floor(index / columnsPerRow);

  const totalRows = Math.ceil(playerCount / columnsPerRow);
  const isLastRow = row === totalRows - 1;
  const colsThisRow = isLastRow ? playerCount - row * columnsPerRow : columnsPerRow;

  const rowWidth = colsThisRow * ITEM_WIDTH + (colsThisRow - 1) * COL_GAP;
  const rowLeft = (viewportWidth - rowWidth) / 2;

  const x = rowLeft + col * slotPitch + ITEM_WIDTH / 2;
  // The wizard should walk to the figure, not the item center.
  // Figure is typically 84px from item top (after card slot) or 0px (no card).
  // Use a compromise: aim at 70px from item top (works for both cases within ~15px).
  const FIGURE_OFFSET_FROM_TOP = 70;
  const y = GRID_TOP + row * (ITEM_HEIGHT + ROW_GAP) + FIGURE_OFFSET_FROM_TOP;

  return { x, y };
}

// ---------------------------------------------------------------------------
// Pure phase-state computation
// ---------------------------------------------------------------------------

const IDLE_STATE = {
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
  wizardMode: 'gone',
  dimLevel: 0,
  // v2 additions
  matchedHoldActive: false,
  matchedHoldPhaseStart: 0,
  reel3StillSpinning: false,
  nudgeActive: false,
  // v3 additions
  matchConfirmed: null,
  matchingReelIndices: [],
  nonMatchReelIndex: null,
  isTripleJackpot: false,
  // v4: crown ceremony state (replaces ghost + procession)
  crownRemovalState: null,
  crownDeliveryState: null,
  wizardCeremonyPosition: null,
  wizardCeremonyPose: null,
  wizardCeremonyBubble: null,
  wizardCeremonyFacing: null,
  crownCeremonyState: null,
  leaderWalkOffTriggered: false,
  showProcessionAnnouncement: false,
  processionSpotlightPosition: null,
  processionDimLevel: 0,
  isPmCreatorCase: false,
};

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

  // === Wizard mode ==========================================================
  let wizardMode = 'gone';

  // === Crown removal state (Act 1) ==========================================
  let crownRemovalState = null;
  let crownDeliveryState = null;
  let wizardCeremonyPosition = null;
  let wizardCeremonyPose = null;
  let wizardCeremonyBubble = null;
  let wizardCeremonyFacing = null;
  let crownCeremonyState = null;
  let leaderWalkOffTriggered = false;

  if (phase === 'crownRemoval') {
    const cr = computeCrownRemoval(phaseElapsed, ceremony, context);
    crownRemovalState = cr.crownRemovalState;
    wizardCeremonyPosition = cr.wizardCeremonyPosition;
    wizardCeremonyPose = cr.wizardCeremonyPose;
    wizardCeremonyBubble = cr.wizardCeremonyBubble;
    wizardCeremonyFacing = cr.wizardCeremonyFacing;
    crownCeremonyState = cr.crownCeremonyState;
    leaderWalkOffTriggered = cr.leaderWalkOffTriggered;
    wizardMode = 'ceremony';
  }

  if (phase === 'crownDelivery') {
    const cd = computeCrownDelivery(phaseElapsed, ceremony, context);
    crownDeliveryState = cd.crownDeliveryState;
    wizardCeremonyPosition = cd.wizardCeremonyPosition;
    wizardCeremonyPose = cd.wizardCeremonyPose;
    wizardCeremonyBubble = cd.wizardCeremonyBubble;
    wizardCeremonyFacing = cd.wizardCeremonyFacing;
    crownCeremonyState = cd.crownCeremonyState;
    wizardMode = 'ceremony';
  }

  // PM stays visible during Act 2 (cabinet), standing at bottom-center holding the crown.
  // Uses ceremonyStartPos when available so the PM's waiting position is consistent
  // with where it paused the idle walk (no teleport to viewport center).
  if (wizardMode === 'gone' && phase !== 'done' && phase !== 'cabinetOut') {
    // Cabinet phases: PM stands at bottom watching the slot machine
    if (['cabinetDrop', 'spinning', 'decelerating', 'matchedHold', 'reel3Decel', 'winnerFreeze', 'winnerEmphasis'].includes(phase)) {
      wizardMode = 'ceremony';
      wizardCeremonyPose = 'walk1';
      const fallbackX = (context.viewportWidth || 1440) / 2;
      const fallbackY = (context.viewportHeight || 900) - 100;
      wizardCeremonyPosition = context.ceremonyStartPos
        ? { x: context.ceremonyStartPos.x, y: fallbackY }
        : { x: fallbackX, y: fallbackY };
      wizardCeremonyFacing = 'right';
      crownCeremonyState = ceremony.outgoingLeaderHadCrown
        ? { parent: 'wizard-hand', progress: 1 }
        : null;
    }
  }

  // v4: PM begins walking during last 200ms of cabinetOut (overlap to prevent gap)
  if (phase === 'cabinetOut' && phaseElapsed >= 200) {
    wizardMode = 'ceremony';
    wizardCeremonyPose = 'walk1';
    const vw = context.viewportWidth || 1440;
    const vh = context.viewportHeight || 900;
    wizardCeremonyPosition = context.ceremonyStartPos || { x: vw / 2, y: vh - 140 };
    crownCeremonyState = ceremony.outgoingLeaderHadCrown
      ? { parent: 'wizard-hand', progress: 1 }
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
    processionSpotlightPosition = wizardCeremonyPosition;
    processionDimLevel = 0.35;
  }

  // === Reel states ==========================================================
  const reelStates = computeReelStates(elapsed, phase, phaseElapsed, context);

  // === Winner emphasis ======================================================
  let winnerEmphasis = 'none';
  if (phase === 'winnerFreeze') winnerEmphasis = 'none';
  else if (phase === 'winnerEmphasis') winnerEmphasis = 'beat2';
  // Reel crown only for the first 200ms of cabinetOut — at 200ms the Wizard
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
    wizardMode,
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
    wizardCeremonyPosition,
    wizardCeremonyPose,
    wizardCeremonyBubble,
    wizardCeremonyFacing,
    crownCeremonyState,
    leaderWalkOffTriggered,
    isPmCreatorCase,
    showProcessionAnnouncement,
    processionSpotlightPosition,
    processionDimLevel,
  };
}

// ---------------------------------------------------------------------------
// Crown Removal computation (Act 1) — tech design v4 §7.1
// ---------------------------------------------------------------------------

function computeCrownRemoval(phaseElapsed, ceremony, context) {
  const hadCrown = ceremony.outgoingLeaderHadCrown;
  const vw = context.viewportWidth || 1440;
  const vh = context.viewportHeight || 900;
  const startPos = context.ceremonyStartPos || { x: vw / 2, y: vh - 140 };
  // v6: resolve outgoing leader position from LIVE players instead of frozen
  // ceremony index — if players disconnect during the ceremony the grid shifts
  // and the frozen index points at the wrong slot.
  // v7: inject the outgoing leader if they've already disconnected — their
  // synthetic figure is still rendered by PlayerList from ceremony data, so the
  // PM must walk to that grid position, not to the center fallback.
  const livePlayers = { ...(context.players || {}) };
  if (ceremony.outgoingLeaderId && !livePlayers[ceremony.outgoingLeaderId] && ceremony.outgoingLeaderLastData) {
    livePlayers[ceremony.outgoingLeaderId] = {
      ...ceremony.outgoingLeaderLastData,
      role: ceremony.outgoingLeaderLastData.role || 'player',
    };
  }
  const liveSorted = Object.entries(livePlayers)
    .filter(([, d]) => d.role !== 'pm')
    .sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
  const liveIndex = liveSorted.findIndex(([id]) => id === ceremony.outgoingLeaderId);
  const playerCount = liveSorted.length;
  const targetPos = liveIndex >= 0
    ? computePlayerGridPosition(liveIndex, playerCount, vw)
    : { x: vw * 0.5, y: vh * 0.4 }; // fallback if player already disconnected

  // Reduced-motion path: instant crown transfer, no walk animation.
  // The standard breakpoints (2000/2500/3000/4600ms) are unreachable within
  // the 400ms reduced-motion crownRemoval phase. Use a two-beat instant swap:
  //   0-200ms: wizard at target, crown lifts instantly
  //   200-400ms: crown in wizard-hand, leader walk-off triggered
  if (context.reducedMotion) {
    return {
      crownRemovalState: phaseElapsed < 200 ? 'crownLift' : 'wizardWalkBack',
      wizardCeremonyPosition: targetPos,
      wizardCeremonyPose: 'cast',
      wizardCeremonyFacing: targetPos.x < startPos.x ? 'left' : 'right',
      wizardCeremonyBubble: null,
      crownCeremonyState: hadCrown
        ? { parent: phaseElapsed < 200 ? 'leader-head' : 'wizard-hand', progress: phaseElapsed < 200 ? 0 : 1 }
        : null,
      leaderWalkOffTriggered: phaseElapsed >= 200,
    };
  }

  let wizardCeremonyPosition = startPos;
  let wizardCeremonyPose = 'walk1';
  let wizardCeremonyBubble = null;
  let wizardCeremonyFacing = targetPos.x < startPos.x ? 'left' : 'right';
  let crownCeremonyState = hadCrown
    ? { parent: 'leader-head', progress: 0 }
    : null;
  let leaderWalkOffTriggered = false;
  let crownRemovalState = 'wizardWalkToLeader';

  if (phaseElapsed < 2000) {
    // Walking up to leader
    crownRemovalState = 'wizardWalkToLeader';
    const progress = phaseElapsed / 2000;
    wizardCeremonyPosition = computeWizardWalkPosition(progress, startPos.x, startPos.y, targetPos.x, targetPos.y);
    wizardCeremonyPose = Math.floor(phaseElapsed / CEREMONY_WALK_FRAME_MS) % 2 === 0 ? 'walk1' : 'walk2';
    const bubbleText = FAREWELL_PHRASES[ceremony.farewellPhraseIndex % FAREWELL_PHRASES.length];
    wizardCeremonyBubble = { text: bubbleText, opacity: 1 };
    wizardCeremonyFacing = targetPos.x < startPos.x ? 'left' : 'right';
  } else if (phaseElapsed < 2500) {
    // Receive-gravity pause at leader
    crownRemovalState = 'gravityPause';
    wizardCeremonyPosition = targetPos;
    wizardCeremonyPose = 'walk1';
    const bubbleText = FAREWELL_PHRASES[ceremony.farewellPhraseIndex % FAREWELL_PHRASES.length];
    // UX Researcher: keep bubble at full opacity during pause, fade during lift.
    // Was fading at 2000ms. Now stays visible through crown lift for ~3.5s total.
    wizardCeremonyBubble = { text: bubbleText, opacity: 1 };
  } else if (phaseElapsed < 3000) {
    // CAST pose, crown lifts
    crownRemovalState = 'crownLift';
    wizardCeremonyPosition = targetPos;
    wizardCeremonyPose = 'cast';
    // Bubble fades during crown lift (2500-3500ms = 1000ms fade)
    const bubbleText = FAREWELL_PHRASES[ceremony.farewellPhraseIndex % FAREWELL_PHRASES.length];
    wizardCeremonyBubble = { text: bubbleText, opacity: Math.max(0, 1 - (phaseElapsed - 2500) / 1000) };
    if (hadCrown) {
      const liftProgress = Math.min(1, (phaseElapsed - 2500) / 500);
      crownCeremonyState = { parent: liftProgress >= 1 ? 'wizard-hand' : 'leader-head', progress: liftProgress };
    }
    leaderWalkOffTriggered = true;
  } else if (phaseElapsed < 4600) {
    // Walking back down (concurrent with leader walk-off)
    crownRemovalState = 'wizardWalkBack';
    const returnProgress = Math.min(1, (phaseElapsed - 3000) / 1600);
    wizardCeremonyPosition = computeWizardWalkPosition(returnProgress, targetPos.x, targetPos.y, startPos.x, startPos.y);
    wizardCeremonyPose = Math.floor(phaseElapsed / CEREMONY_WALK_FRAME_MS) % 2 === 0 ? 'walk1' : 'walk2';
    wizardCeremonyBubble = null;
    crownCeremonyState = hadCrown ? { parent: 'wizard-hand', progress: 1 } : null;
    leaderWalkOffTriggered = true;
    // Facing center on the way back
    wizardCeremonyFacing = startPos.x < targetPos.x ? 'left' : 'right';
  } else {
    // Buffer: PM at start position, crown in hand (fills to 5000)
    crownRemovalState = 'silenceGap';
    wizardCeremonyPosition = startPos;
    wizardCeremonyPose = 'walk1';
    crownCeremonyState = hadCrown ? { parent: 'wizard-hand', progress: 1 } : null;
    leaderWalkOffTriggered = true;
  }

  return {
    crownRemovalState,
    wizardCeremonyPosition,
    wizardCeremonyPose,
    wizardCeremonyBubble,
    wizardCeremonyFacing,
    crownCeremonyState,
    leaderWalkOffTriggered,
  };
}

// ---------------------------------------------------------------------------
// Crown Delivery computation (Act 3) — tech design v4 §7.2
// ---------------------------------------------------------------------------

function computeCrownDelivery(phaseElapsed, ceremony, context) {
  const hadCrown = ceremony.outgoingLeaderHadCrown;
  const vw = context.viewportWidth || 1440;
  const vh = context.viewportHeight || 900;

  // v6: resolve winner & outgoing leader positions from LIVE players instead
  // of frozen ceremony indexes — if players disconnect during the ceremony
  // the grid shifts and the frozen index points at the wrong slot.
  // v7: defensively inject outgoing leader + winner if they've disconnected —
  // same rationale as computeCrownRemoval: synthetic figures are rendered by
  // PlayerList from ceremony data and the PM must walk to those grid slots.
  const livePlayers = { ...(context.players || {}) };
  if (ceremony.outgoingLeaderId && !livePlayers[ceremony.outgoingLeaderId] && ceremony.outgoingLeaderLastData) {
    livePlayers[ceremony.outgoingLeaderId] = {
      ...ceremony.outgoingLeaderLastData,
      role: ceremony.outgoingLeaderLastData.role || 'player',
    };
  }
  if (ceremony.winnerId && !livePlayers[ceremony.winnerId] && ceremony.candidateNames?.[ceremony.winnerId]) {
    livePlayers[ceremony.winnerId] = {
      name: ceremony.candidateNames[ceremony.winnerId],
      role: 'player',
      joinedAt: 0,
    };
  }
  const liveSorted = Object.entries(livePlayers)
    .filter(([, d]) => d.role !== 'pm')
    .sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
  const playerCount = liveSorted.length;
  const winnerLiveIndex = liveSorted.findIndex(([id]) => id === ceremony.winnerId);
  const winnerGridPos = winnerLiveIndex >= 0
    ? computePlayerGridPosition(winnerLiveIndex, playerCount, vw)
    : { x: vw * 0.5, y: vh * 0.4 };
  // Outgoing leader grid position (needed for compressed direct walk)
  const outgoingLiveIndex = liveSorted.findIndex(([id]) => id === ceremony.outgoingLeaderId);
  const outgoingGridPos = outgoingLiveIndex >= 0
    ? computePlayerGridPosition(outgoingLiveIndex, playerCount, vw)
    : { x: vw / 2, y: vh - 140 };

  // For compressed ceremonies, PM walks directly from old leader position
  // to new leader position without returning to bottom first (G37).
  const defaultStart = context.ceremonyStartPos || { x: vw / 2, y: vh - 140 };
  const startPos = ceremony.wasCompressed
    ? outgoingGridPos
    : defaultStart;
  const targetPos = winnerGridPos;

  // Reduced-motion path: instant crown placement, no walk animation.
  // The standard breakpoints (2000/2500/3000/4600ms) are unreachable within
  // the 400ms reduced-motion crownDelivery phase. Use a two-beat instant swap:
  //   0-200ms: wizard at winner, crown places instantly
  //   200-400ms: crown settled on new leader
  if (context.reducedMotion) {
    return {
      crownDeliveryState: phaseElapsed < 200 ? 'crownPlace' : 'complete',
      wizardCeremonyPosition: targetPos,
      wizardCeremonyPose: 'cast',
      wizardCeremonyFacing: targetPos.x < startPos.x ? 'left' : 'right',
      wizardCeremonyBubble: null,
      crownCeremonyState: hadCrown
        ? { parent: 'new-leader-head', progress: phaseElapsed < 200 ? 0 : 1 }
        : { parent: phaseElapsed < 200 ? 'materializing' : 'new-leader-head', progress: phaseElapsed < 200 ? 0 : 1 },
    };
  }

  let wizardCeremonyPosition = startPos;
  let wizardCeremonyPose = 'walk1';
  let wizardCeremonyBubble = null;
  let wizardCeremonyFacing = targetPos.x < startPos.x ? 'left' : 'right';
  let crownCeremonyState = hadCrown
    ? { parent: 'wizard-hand', progress: 1 }
    : null;
  let crownDeliveryState = 'wizardWalkToWinner';

  if (phaseElapsed < 2000) {
    // Walking up to winner
    crownDeliveryState = 'wizardWalkToWinner';
    const progress = phaseElapsed / 2000;
    wizardCeremonyPosition = computeWizardWalkPosition(progress, startPos.x, startPos.y, targetPos.x, targetPos.y);
    wizardCeremonyPose = Math.floor(phaseElapsed / CEREMONY_WALK_FRAME_MS) % 2 === 0 ? 'walk1' : 'walk2';
    wizardCeremonyFacing = targetPos.x < startPos.x ? 'left' : 'right';
  } else if (phaseElapsed < 2500) {
    // Deliver-gravity pause
    crownDeliveryState = 'gravityPause';
    wizardCeremonyPosition = targetPos;
    wizardCeremonyPose = 'walk1';
    const bubbleText = CROWNING_BUBBLES[ceremony.crowningBubbleIndex % CROWNING_BUBBLES.length];
    wizardCeremonyBubble = { text: bubbleText, opacity: 1 };
  } else if (phaseElapsed < 3000) {
    // CAST pose, crown places
    crownDeliveryState = 'crownPlace';
    wizardCeremonyPosition = targetPos;
    wizardCeremonyPose = 'cast';
    const bubbleText = CROWNING_BUBBLES[ceremony.crowningBubbleIndex % CROWNING_BUBBLES.length];
    // UX Researcher: keep bubble at full opacity through crown placement,
    // fade during walk-back. Was fading at 2500ms (only 500ms visible).
    wizardCeremonyBubble = { text: bubbleText, opacity: 1 };
    if (hadCrown) {
      // Use 'new-leader-head' as parent with fractional progress so the
      // SlotMachineStage mode mapper produces 'arcing' (progress < 1) and
      // then 'settled' (progress >= 1). Using 'wizard-hand' here would map
      // to 'inHand' and skip the arc animation entirely.
      const placeProgress = Math.min(1, (phaseElapsed - 2500) / 500);
      crownCeremonyState = { parent: 'new-leader-head', progress: placeProgress };
    } else {
      // PM-creator case: materialize crown during delivery
      const matProgress = Math.min(1, (phaseElapsed - 2500) / 500);
      crownCeremonyState = { parent: matProgress >= 1 ? 'new-leader-head' : 'materializing', progress: matProgress };
    }
  } else if (phaseElapsed < 4600) {
    // Walking back down
    crownDeliveryState = 'wizardWalkBack';
    const returnProgress = Math.min(1, (phaseElapsed - 3000) / 1600);
    wizardCeremonyPosition = computeWizardWalkPosition(returnProgress, targetPos.x, targetPos.y, defaultStart.x, defaultStart.y);
    wizardCeremonyPose = Math.floor(phaseElapsed / CEREMONY_WALK_FRAME_MS) % 2 === 0 ? 'walk1' : 'walk2';
    // UX Researcher: keep bubble visible during walk-back with slow fade.
    // Gives ~3.5s total visibility (2000ms gravity+place at full + 1500ms fade).
    const bubbleText = CROWNING_BUBBLES[ceremony.crowningBubbleIndex % CROWNING_BUBBLES.length];
    wizardCeremonyBubble = phaseElapsed < 4500
      ? { text: bubbleText, opacity: Math.max(0, 1 - (phaseElapsed - 3000) / 1500) }
      : null;
    crownCeremonyState = { parent: 'new-leader-head', progress: 1 };
    wizardCeremonyFacing = defaultStart.x < targetPos.x ? 'left' : 'right';
  } else {
    // Buffer: PM at bottom, ceremony winding down
    crownDeliveryState = 'complete';
    wizardCeremonyPosition = defaultStart;
    wizardCeremonyPose = 'walk1';
    wizardCeremonyBubble = null;
    crownCeremonyState = { parent: 'new-leader-head', progress: 1 };
  }

  return {
    crownDeliveryState,
    wizardCeremonyPosition,
    wizardCeremonyPose,
    wizardCeremonyBubble,
    wizardCeremonyFacing,
    crownCeremonyState,
  };
}

// ---------------------------------------------------------------------------
// Reel state computation
// ---------------------------------------------------------------------------

/**
 * Compute per-reel state. Internal helper. v4 changes:
 *   - spinPhaseStart moved to 2800ms (was 1550ms)
 *   - All reel stop times shifted by +1250ms
 *   - Phase 'crownRemoval' and 'cabinetDrop' added as idle/entry states
 */
function computeReelStates(elapsed, phase, phaseElapsed, context) {
  const { reelOrders, ceremony } = context;
  const winnerIdx = context.winnerIndexInReel2;
  const nearMissIdx = context.nearMissIndexInReel2;
  const reel0LandingIdx = context.reel0LandingIdx;
  const reel1LandingIdx = context.reel1LandingIdx;
  const nonMatchReelIndex = context.nonMatchReelIndex;
  const winnerReelPair = ceremony.winnerReelPair;
  const states = [
    { stopped: false, currentIndex: 0, flareActive: false, rumble: false, transitionMode: 'none', pulseActive: false, dimmed: false },
    { stopped: false, currentIndex: 0, flareActive: false, rumble: false, transitionMode: 'none', pulseActive: false, dimmed: false },
    { stopped: false, currentIndex: 0, flareActive: false, rumble: false, transitionMode: 'none', pulseActive: false, dimmed: false },
  ];

  // Compressed: all three reels frozen on the winner slot from the start.
  if (ceremony.wasCompressed) {
    for (let i = 0; i < 3; i++) {
      states[i] = {
        stopped: true,
        currentIndex: 0,
        flareActive: false,
        rumble: false,
        transitionMode: 'none',
        pulseActive: false,
        dimmed: false,
      };
    }
    return states;
  }

  // Before cabinet / after cabinet: reels idle.
  if (phase === 'idle' || phase === 'crownRemoval' || phase === 'cabinetDrop' || phase === 'done' || phase === 'crownDelivery') {
    return states;
  }

  // v4+: spinning phase start at 5400ms (2x longer ceremony)
  const spinPhaseStart = 5400;

  // Full-speed spin
  if (phase === 'spinning') {
    for (let i = 0; i < 3; i++) {
      const spinFrames = Math.floor((elapsed - spinPhaseStart) / 40);
      states[i] = {
        stopped: false,
        currentIndex: (spinFrames + i * 3) % reelOrders[i].length,
        flareActive: false,
        rumble: false,
        transitionMode: 'none',
        pulseActive: false,
        dimmed: false,
      };
    }
    return states;
  }

  // Decelerating phase covers reel 0 stop, reel 1 stop.
  if (phase === 'decelerating') {
    if (elapsed < REEL0_STOP_AT) {
      const spinFrames = Math.floor((elapsed - spinPhaseStart) / 40);
      states[0] = {
        stopped: false,
        currentIndex: spinFrames % reelOrders[0].length,
        flareActive: false,
        rumble: false,
        transitionMode: 'none',
        pulseActive: false,
        dimmed: false,
      };
    } else {
      states[0] = {
        stopped: true,
        currentIndex: reel0LandingIdx != null ? reel0LandingIdx : 0,
        flareActive: elapsed < REEL0_STOP_AT + 80,
        rumble: false,
        transitionMode: elapsed === REEL0_STOP_AT ? 'click' : 'none',
        pulseActive: false,
        dimmed: false,
      };
    }
    if (elapsed < REEL1_STOP_AT) {
      const spinFrames = Math.floor((elapsed - spinPhaseStart) / 40);
      states[1] = {
        stopped: false,
        currentIndex: (spinFrames + 3) % reelOrders[1].length,
        flareActive: false,
        rumble: false,
        transitionMode: 'none',
        pulseActive: false,
        dimmed: false,
      };
    } else {
      states[1] = {
        stopped: true,
        currentIndex: reel1LandingIdx != null ? reel1LandingIdx : 0,
        flareActive: elapsed < REEL1_STOP_AT + 80,
        rumble: false,
        transitionMode: elapsed === REEL1_STOP_AT ? 'click' : 'none',
        pulseActive: false,
        dimmed: false,
      };
    }
    // Reel 2: still spinning at full speed during decelerating phase.
    const spinFrames = Math.floor((elapsed - spinPhaseStart) / 40);
    states[2] = {
      stopped: false,
      currentIndex: (spinFrames + 6) % reelOrders[2].length,
      flareActive: false,
      rumble: false,
      transitionMode: 'none',
      pulseActive: false,
      dimmed: false,
    };
    return states;
  }

  // matchedHold: winner-pair reels pulse, reel 2 still spinning.
  if (phase === 'matchedHold') {
    const matchedHoldStart = context.matchedHoldAbsoluteStart || 9900;
    const pulsePhase = (elapsed - matchedHoldStart) % 300;
    const pulseActiveCalc = pulsePhase >= 60 && pulsePhase < 240;

    states[0] = {
      stopped: true,
      currentIndex: reel0LandingIdx != null ? reel0LandingIdx : 0,
      flareActive: false,
      rumble: false,
      transitionMode: 'none',
      pulseActive: winnerReelPair && winnerReelPair.includes(0) ? pulseActiveCalc : false,
      dimmed: false,
    };
    states[1] = {
      stopped: true,
      currentIndex: reel1LandingIdx != null ? reel1LandingIdx : 0,
      flareActive: false,
      rumble: false,
      transitionMode: 'none',
      pulseActive: winnerReelPair && winnerReelPair.includes(1) ? pulseActiveCalc : false,
      dimmed: false,
    };
    // Reel 2: still spinning
    const spinFrames = Math.floor((elapsed - spinPhaseStart) / 40);
    states[2] = {
      stopped: false,
      currentIndex: (spinFrames + 6) % reelOrders[2].length,
      flareActive: false,
      rumble: false,
      transitionMode: 'none',
      pulseActive: false,
      dimmed: false,
    };
    return states;
  }

  // reel3Decel: reels 0/1 locked, reel 2 walks through slowdown clicks
  if (phase === 'reel3Decel') {
    states[0] = {
      stopped: true,
      currentIndex: reel0LandingIdx != null ? reel0LandingIdx : 0,
      flareActive: false,
      rumble: false,
      transitionMode: 'none',
      pulseActive: false,
      dimmed: false,
    };
    states[1] = {
      stopped: true,
      currentIndex: reel1LandingIdx != null ? reel1LandingIdx : 0,
      flareActive: false,
      rumble: false,
      transitionMode: 'none',
      pulseActive: false,
      dimmed: false,
    };

    const lastClickMoment = REEL2_CLICK_MOMENTS[REEL2_CLICK_MOMENTS.length - 1];
    const nearMissHoldEnd = lastClickMoment + 200;
    const nudgeEnd = nearMissHoldEnd + 440;

    if (elapsed < REEL2_SLOWDOWN_START) {
      const spinFrames = Math.floor((elapsed - spinPhaseStart) / 40);
      states[2] = {
        stopped: false,
        currentIndex: (spinFrames + 6) % reelOrders[2].length,
        flareActive: false,
        rumble: false,
        transitionMode: 'none',
        pulseActive: false,
        dimmed: false,
      };
    } else if (elapsed < lastClickMoment) {
      let clickIdx = -1;
      for (let i = 0; i < REEL2_CLICK_MOMENTS.length; i++) {
        if (elapsed >= REEL2_CLICK_MOMENTS[i]) clickIdx = i;
      }
      const nearMissAbsolute = nearMissIdx != null ? nearMissIdx : (winnerIdx != null ? winnerIdx : 0);
      const idx = clickIdx < 0
        ? (Math.floor((REEL2_SLOWDOWN_START - spinPhaseStart) / 40) + 6) % reelOrders[2].length
        : ((nearMissAbsolute - (REEL2_CLICK_MOMENTS.length - 1 - clickIdx) + reelOrders[2].length) % reelOrders[2].length);
      states[2] = {
        stopped: clickIdx === REEL2_CLICK_MOMENTS.length - 1,
        currentIndex: idx,
        flareActive: clickIdx >= 0 && elapsed < REEL2_CLICK_MOMENTS[clickIdx] + 40,
        rumble: false,
        transitionMode: 'click',
        pulseActive: false,
        dimmed: false,
      };
    } else if (elapsed < nearMissHoldEnd) {
      states[2] = {
        stopped: true,
        currentIndex: nearMissIdx != null ? nearMissIdx : (winnerIdx != null ? winnerIdx : 0),
        flareActive: false,
        rumble: elapsed >= lastClickMoment + 60 && elapsed < lastClickMoment + 200,
        nearMissHold: true,
        transitionMode: 'none',
        pulseActive: false,
        dimmed: false,
      };
    } else if (elapsed < nudgeEnd) {
      const p = Math.min(1, (elapsed - nearMissHoldEnd) / 440);
      states[2] = {
        stopped: p >= 1,
        currentIndex: winnerIdx != null ? winnerIdx : 0,
        nudgeProgress: p,
        flareActive: false,
        rumble: false,
        transitionMode: 'nudge',
        pulseActive: false,
        dimmed: false,
      };
    } else {
      states[2] = {
        stopped: true,
        currentIndex: winnerIdx != null ? winnerIdx : 0,
        flareActive: false,
        rumble: false,
        transitionMode: 'none',
        pulseActive: false,
        dimmed: false,
      };
    }
    return states;
  }

  // After reel3Decel (winnerFreeze, winnerEmphasis, cabinetOut):
  const dimNonMatch = phase === 'winnerEmphasis' || phase === 'cabinetOut';
  states[0] = {
    stopped: true,
    currentIndex: reel0LandingIdx != null ? reel0LandingIdx : 0,
    flareActive: false,
    rumble: false,
    transitionMode: 'none',
    pulseActive: false,
    dimmed: dimNonMatch && nonMatchReelIndex === 0,
  };
  states[1] = {
    stopped: true,
    currentIndex: reel1LandingIdx != null ? reel1LandingIdx : 0,
    flareActive: false,
    rumble: false,
    transitionMode: 'none',
    pulseActive: false,
    dimmed: dimNonMatch && nonMatchReelIndex === 1,
  };
  states[2] = {
    stopped: true,
    currentIndex: winnerIdx != null ? winnerIdx : 0,
    flareActive: false,
    rumble: false,
    transitionMode: 'none',
    pulseActive: false,
    dimmed: false,
  };
  return states;
}

// ---------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------

/**
 * @param {object|null} ceremony  frozen Firebase payload (or null/idle)
 * @param {object} opts
 * @param {() => void} opts.onLeaderPromote  called once at crown delivery t=1500ms
 * @param {() => void} [opts.onCeremonyComplete] called when phase reaches done
 * @returns {object} phaseState
 */
export function useSlotMachine(ceremony, { onLeaderPromote, onCeremonyComplete, ceremonyStartPos, players } = {}) {
  const [phaseState, setPhaseState] = useState(IDLE_STATE);
  const intervalRef = useRef(null);
  const onLeaderPromoteRef = useRef(onLeaderPromote);
  const onCeremonyCompleteRef = useRef(onCeremonyComplete);
  const promotedRef = useRef(false);
  const completedRef = useRef(false);

  const playersRef = useRef(players);
  useEffect(() => { playersRef.current = players; }, [players]);

  useEffect(() => { onLeaderPromoteRef.current = onLeaderPromote; }, [onLeaderPromote]);
  useEffect(() => { onCeremonyCompleteRef.current = onCeremonyComplete; }, [onCeremonyComplete]);

  // Reset the "already fired" guards when a new ceremony starts.
  useEffect(() => {
    promotedRef.current = false;
    completedRef.current = false;
  }, [ceremony?.ceremonyId]);


  useEffect(() => {
    if (!ceremony) {
      setPhaseState(IDLE_STATE);
      return;
    }

    // Detect per-client reduced-motion.
    const reducedMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const table = phaseTableFor({
      wasCompressed: !!ceremony.wasCompressed,
      reducedMotion,
    });
    const totalDuration = totalDurationFor(table);

    // Clock-drift correction.
    const observedAt = Date.now();
    const clientElapsedAtObservation = observedAt - (ceremony.startedAt || observedAt);

    // Too late to play the ceremony — jump to done.
    if (clientElapsedAtObservation > totalDuration + DRIFT_TOLERANCE_MS) {
      setPhaseState({ ...IDLE_STATE, phase: 'done' });
      if (!completedRef.current) {
        completedRef.current = true;
        Promise.resolve().then(() => onCeremonyCompleteRef.current?.());
      }
      return;
    }

    const startingElapsed = Math.max(0, clientElapsedAtObservation);
    const phaseClockOriginRef = { current: observedAt - startingElapsed };

    // Capture viewport dimensions for position computation
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;

    // Pre-compute reel orders (seeded shuffle) for this ceremony.
    const reelPool = ceremony.wasCompressed
      ? [ceremony.winnerId]
      : [...ceremony.candidateIds, ...(ceremony.reelFillerIds || [])];
    const reelOrdersRaw = ceremony.reelSeeds.map((seed) => buildReelOrder(reelPool, seed));

    let reel0 = reelOrdersRaw[0];
    let reel1 = reelOrdersRaw[1];
    let reel2 = reelOrdersRaw[2];

    const nonMatchReelIndex = ceremony.wasCompressed ? null
      : (ceremony.winnerReelPair
        ? [0, 1, 2].find(i => !ceremony.winnerReelPair.includes(i))
        : null);

    if (!ceremony.wasCompressed && ceremony.winnerReelPair) {
      const midIdx0 = Math.max(1, Math.min(reel0.length - 1, 4));
      const midIdx1 = Math.max(1, Math.min(reel1.length - 1, 4));

      if (ceremony.winnerReelPair.includes(0)) {
        reel0 = placeEntryAt(reel0, ceremony.winnerId, midIdx0);
      } else if (ceremony.nonMatchReelPlayerId) {
        reel0 = placeEntryAt(reel0, ceremony.nonMatchReelPlayerId, midIdx0);
      }

      if (ceremony.winnerReelPair.includes(1)) {
        reel1 = placeEntryAt(reel1, ceremony.winnerId, midIdx1);
      } else if (ceremony.nonMatchReelPlayerId) {
        reel1 = placeEntryAt(reel1, ceremony.nonMatchReelPlayerId, midIdx1);
      }
    }

    if (!ceremony.wasCompressed) {
      const finalStopIndex = Math.max(1, Math.min(reel2.length - 1, 6));
      if (ceremony.winnerId) {
        reel2 = placeEntryAt(reel2, ceremony.winnerId, finalStopIndex);
      }
      if (ceremony.nearMissTargetId) {
        reel2 = placeEntryAt(reel2, ceremony.nearMissTargetId, Math.max(0, finalStopIndex - 1));
      }
    }
    const reelOrders = [reel0, reel1, reel2];
    const winnerIndexInReel2 = ceremony.wasCompressed
      ? 0
      : reel2.indexOf(ceremony.winnerId);
    const nearMissIndexInReel2 = ceremony.wasCompressed
      ? null
      : (ceremony.nearMissTargetId ? reel2.indexOf(ceremony.nearMissTargetId) : null);

    let reel0LandingIdx = 0;
    let reel1LandingIdx = 0;
    if (!ceremony.wasCompressed && ceremony.winnerReelPair) {
      if (ceremony.winnerReelPair.includes(0)) {
        reel0LandingIdx = reel0.indexOf(ceremony.winnerId);
      } else if (ceremony.nonMatchReelPlayerId) {
        reel0LandingIdx = reel0.indexOf(ceremony.nonMatchReelPlayerId);
      }
      if (ceremony.winnerReelPair.includes(1)) {
        reel1LandingIdx = reel1.indexOf(ceremony.winnerId);
      } else if (ceremony.nonMatchReelPlayerId) {
        reel1LandingIdx = reel1.indexOf(ceremony.nonMatchReelPlayerId);
      }
    }

    const matchedHoldRow = table.find((r) => r.phase === 'matchedHold');
    const matchedHoldAbsoluteStart = matchedHoldRow ? matchedHoldRow.startAt : 9900;

    const context = {
      ceremony,
      reelOrders,
      table,
      reducedMotion,
      winnerIndexInReel2,
      nearMissIndexInReel2,
      reel0LandingIdx,
      reel1LandingIdx,
      nonMatchReelIndex,
      matchedHoldAbsoluteStart,
      viewportWidth,
      viewportHeight,
      ceremonyStartPos,
    };

    const tick = () => {
      const now = Date.now();
      const elapsed = now - phaseClockOriginRef.current;

      // v4: Fire leader-promote at crownDelivery t=1500ms (not cabinetOut start).
      if (!promotedRef.current) {
        const row = currentPhaseRow(table, elapsed);
        if (row.phase === 'crownDelivery') {
          const phaseEl = elapsed - row.startAt;
          if (phaseEl >= 1500) {
            promotedRef.current = true;
            try { onLeaderPromoteRef.current?.(); } catch (err) {
              console.error('[useSlotMachine] leader promote failed', err);
            }
          }
        } else if (row.phase === 'done') {
          promotedRef.current = true;
          try { onLeaderPromoteRef.current?.(); } catch (err) {
            console.error('[useSlotMachine] leader promote failed', err);
          }
        }
      }

      // Inject live players on each tick so crown removal/delivery resolve
      // positions from the current grid, not the frozen ceremony snapshot.
      context.players = playersRef.current;

      const nextState = computePhaseState(elapsed, ceremony, context);

      setPhaseState((prev) => (shallowEqual(prev, nextState) ? prev : nextState));

      if (nextState.phase === 'done') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (!completedRef.current) {
          completedRef.current = true;
          try { onCeremonyCompleteRef.current?.(); } catch (err) {
            console.error('[useSlotMachine] ceremony complete callback failed', err);
          }
        }
      }
    };

    tick();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, TICK_MS);

    // Skip keybind (Escape) — gated on elapsed > 2000ms.
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      const now = Date.now();
      const elapsed = now - phaseClockOriginRef.current;
      if (elapsed < SKIP_AFTER_MS) return;
      const cabinetOutStart = table.find((r) => r.phase === 'cabinetOut')?.startAt ?? 0;
      const doneStart = table.find((r) => r.phase === 'done')?.startAt ?? totalDuration;
      if (elapsed >= cabinetOutStart) {
        phaseClockOriginRef.current = now - (doneStart - 50);
      } else {
        phaseClockOriginRef.current = now - cabinetOutStart;
      }
      if (!promotedRef.current) {
        promotedRef.current = true;
        try { onLeaderPromoteRef.current?.(); } catch (err) {
          console.error('[useSlotMachine] skip-promote failed', err);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ceremony?.ceremonyId]);

  return phaseState;
}

// Exported for tests
export { PHASE_TABLE_STANDARD, PHASE_TABLE_COMPRESSED, PHASE_TABLE_REDUCED };
