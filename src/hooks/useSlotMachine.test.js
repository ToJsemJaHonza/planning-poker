/**
 * useSlotMachine — computePhaseState pure function tests.
 *
 * computePhaseState is the brain of the slot machine: (elapsed, ceremony, context) => phaseState.
 * Each test calls it directly with a known elapsed value and asserts the returned state.
 *
 * No fake timers needed for the pure function tests (the hook wrapper tests
 * are in useRoom.slotmachine.test.js).
 */

import { describe, it, expect } from 'vitest';
import { computePhaseState, computePlayerGridPosition, REEL2_CLICK_MOMENTS } from './useSlotMachine';
import {
  PHASE_TABLE_STANDARD,
  PHASE_TABLE_COMPRESSED,
  PHASE_TABLE_REDUCED,
  buildReelOrder,
  placeEntryAt,
  FAREWELL_PHRASES,
  CROWNING_BUBBLES,
} from '../events/slotMachine';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const mockCeremony = {
  ceremonyId: 'test-1',
  schemaVersion: 4,
  startedAt: 1000,
  expiresAt: 16000,
  wasCompressed: false,
  candidateIds: ['a', 'b', 'c', 'd'],
  candidateNames: { a: 'Alice', b: 'Bob', c: 'Carol', d: 'Dave' },
  winnerId: 'b',
  nearMissTargetId: 'c',
  winnerReelPair: [0, 2],
  nonMatchReelPlayerId: 'd',
  isTripleJackpot: false,
  reelFillerIds: ['crown', 'trophy', 'pizza', 'wizardHat'],
  reelSeeds: [42, 100, 200],
  farewellPhraseIndex: 0,
  crowningBubbleIndex: 0,
  flourishVariant: null,
  outgoingLeaderId: 'x',
  outgoingLeaderLastData: { name: 'OldPM', role: 'pm' },
  outgoingLeaderHadCrown: false,
  outgoingLeaderIndex: -1,
  winnerIndex: 1,
};

/**
 * Build a standard context object for computePhaseState.
 * Mirrors what the hook builds internally from a ceremony payload.
 */
function buildContext(ceremony = mockCeremony, overrides = {}) {
  const table = PHASE_TABLE_STANDARD;
  const pool = [...ceremony.candidateIds, ...ceremony.reelFillerIds];

  let reel0 = buildReelOrder(pool, ceremony.reelSeeds[0]);
  let reel1 = buildReelOrder(pool, ceremony.reelSeeds[1]);
  let reel2 = buildReelOrder(pool, ceremony.reelSeeds[2]);

  // Pin winner and near-miss in reel 2
  if (!ceremony.wasCompressed) {
    const finalStopIndex = Math.max(1, Math.min(reel2.length - 1, 6));
    if (ceremony.winnerId) {
      reel2 = placeEntryAt(reel2, ceremony.winnerId, finalStopIndex);
    }
    if (ceremony.nearMissTargetId) {
      reel2 = placeEntryAt(reel2, ceremony.nearMissTargetId, Math.max(0, finalStopIndex - 1));
    }
  }

  // Pin landing indices for reels 0 and 1 based on winnerReelPair
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

  const reelOrders = [reel0, reel1, reel2];
  const winnerIndexInReel2 = ceremony.wasCompressed
    ? 0
    : reel2.indexOf(ceremony.winnerId);
  const nearMissIndexInReel2 = ceremony.wasCompressed
    ? null
    : (ceremony.nearMissTargetId ? reel2.indexOf(ceremony.nearMissTargetId) : null);
  const nonMatchReelIndex = ceremony.wasCompressed ? null
    : (ceremony.winnerReelPair
      ? [0, 1, 2].find(i => !ceremony.winnerReelPair.includes(i))
      : null);

  const matchedHoldRow = table.find(r => r.phase === 'matchedHold');
  const matchedHoldAbsoluteStart = matchedHoldRow ? matchedHoldRow.startAt : 9900;

  return {
    ceremony,
    reelOrders,
    table,
    reducedMotion: false,
    winnerIndexInReel2,
    nearMissIndexInReel2,
    reel0LandingIdx,
    reel1LandingIdx,
    nonMatchReelIndex,
    matchedHoldAbsoluteStart,
    viewportWidth: 1440,
    viewportHeight: 900,
    ...overrides,
  };
}

/** Build context for a compressed ceremony. */
function buildCompressedContext() {
  const ceremony = {
    ...mockCeremony,
    wasCompressed: true,
    candidateIds: ['a'],
    candidateNames: { a: 'Alice' },
    winnerId: 'a',
    nearMissTargetId: null,
    winnerReelPair: null,
    nonMatchReelPlayerId: null,
    isTripleJackpot: false,
    reelFillerIds: [],
    reelSeeds: [0, 0, 0],
  };
  return buildContext(ceremony, { table: PHASE_TABLE_COMPRESSED });
}

/** Build context for reduced motion. */
function buildReducedContext() {
  const ceremony = { ...mockCeremony };
  return buildContext(ceremony, {
    table: PHASE_TABLE_REDUCED,
    reducedMotion: true,
  });
}

// The last REEL2 click moment — validated from constant calculation:
// v4+: 11100 + 220 + 264 + 316 + 380 + 456 + 548 = 13284
const LAST_CLICK_MOMENT = REEL2_CLICK_MOMENTS[REEL2_CLICK_MOMENTS.length - 1];
const NEAR_MISS_HOLD_START = LAST_CLICK_MOMENT; // 13284
const NUDGE_START = NEAR_MISS_HOLD_START + 200;  // 13484

// ---------------------------------------------------------------------------
// Phase progression tests — standard ceremony
// ---------------------------------------------------------------------------

describe('computePhaseState — standard ceremony phase progression', () => {
  it('returns idle state when ceremony is null', () => {
    const state = computePhaseState(0, null, {});
    expect(state.phase).toBe('idle');
    expect(state.cabinetTransform).toBe('offscreen');
  });

  // v4: crownRemoval replaces preSpin, cabinetDrop is new phase
  it('elapsed=0 => phase=crownRemoval, cabinetTransform=offscreen', () => {
    const ctx = buildContext();
    const state = computePhaseState(0, mockCeremony, ctx);
    expect(state.phase).toBe('crownRemoval');
    expect(state.cabinetTransform).toBe('offscreen');
  });

  it('elapsed=5000 => cabinetTransform=entering (cabinetDrop phase)', () => {
    const ctx = buildContext();
    const state = computePhaseState(5000, mockCeremony, ctx);
    expect(state.phase).toBe('cabinetDrop');
    expect(state.cabinetTransform).toBe('entering');
  });

  it('elapsed=5250 => cabinetTransform=bounced', () => {
    const ctx = buildContext();
    const state = computePhaseState(5250, mockCeremony, ctx);
    expect(state.phase).toBe('cabinetDrop');
    expect(state.cabinetTransform).toBe('bounced');
  });

  it('elapsed=5400 => phase=spinning, cabinetTransform=landed', () => {
    const ctx = buildContext();
    const state = computePhaseState(5400, mockCeremony, ctx);
    expect(state.phase).toBe('spinning');
    expect(state.cabinetTransform).toBe('landed');
  });

  it('elapsed=7400 => phase=decelerating', () => {
    const ctx = buildContext();
    const state = computePhaseState(7400, mockCeremony, ctx);
    expect(state.phase).toBe('decelerating');
    expect(state.cabinetTransform).toBe('landed');
  });

  it('elapsed=9900 => phase=matchedHold, matchedHoldActive=true', () => {
    const ctx = buildContext();
    const state = computePhaseState(9900, mockCeremony, ctx);
    expect(state.phase).toBe('matchedHold');
    expect(state.matchedHoldActive).toBe(true);
    expect(state.reel3StillSpinning).toBe(true);
  });

  it('elapsed=11100 => phase=reel3Decel', () => {
    const ctx = buildContext();
    const state = computePhaseState(11100, mockCeremony, ctx);
    expect(state.phase).toBe('reel3Decel');
  });

  it('elapsed at last click => phase=reel3Decel, near-miss hold active', () => {
    const ctx = buildContext();
    const state = computePhaseState(NEAR_MISS_HOLD_START, mockCeremony, ctx);
    expect(state.phase).toBe('reel3Decel');
    expect(state.nudgeActive).toBe(false);
    // bulb pattern should be dark during near-miss hold
    expect(state.bulbPattern).toBe('dark');
  });

  // REGRESSION TEST: nonMatchRelief timing fix (iter 3).
  it('nonMatchRelief=true during near-miss hold (bug fix regression)', () => {
    const ctx = buildContext();
    const state = computePhaseState(NEAR_MISS_HOLD_START, mockCeremony, ctx);
    expect(state.nonMatchRelief).toBe(true);
    expect(state.nonMatchReliefPlayerId).toBe('d');
  });

  it('nonMatchRelief is true throughout the 200ms near-miss hold window', () => {
    const ctx = buildContext();
    const mid = NEAR_MISS_HOLD_START + 100;
    const state = computePhaseState(mid, mockCeremony, ctx);
    expect(state.nonMatchRelief).toBe(true);
  });

  it('nudgeActive=true after near-miss hold, nonMatchRelief=false', () => {
    const ctx = buildContext();
    const state = computePhaseState(NUDGE_START, mockCeremony, ctx);
    expect(state.nudgeActive).toBe(true);
    expect(state.nonMatchRelief).toBe(false);
    expect(state.bulbPattern).toBe('chase');
  });

  it('elapsed=14200 => phase=winnerFreeze', () => {
    const ctx = buildContext();
    const state = computePhaseState(14200, mockCeremony, ctx);
    expect(state.phase).toBe('winnerFreeze');
    expect(state.winnerEmphasis).toBe('none');
    expect(state.bulbPattern).toBe('allLit');
    expect(state.marqueeText).toBe('rising');
  });

  it('elapsed=14600 => phase=winnerEmphasis, matchConfirmed set', () => {
    const ctx = buildContext();
    const state = computePhaseState(14600, mockCeremony, ctx);
    expect(state.phase).toBe('winnerEmphasis');
    expect(state.winnerEmphasis).toBe('beat2');
    expect(state.matchConfirmed).toEqual({
      reels: [0, 2],
      isTriple: false,
    });
    expect(state.bulbPattern).toBe('allLit');
  });

  it('elapsed=15800 => phase=cabinetOut, cabinetTransform=exiting', () => {
    const ctx = buildContext();
    const state = computePhaseState(15800, mockCeremony, ctx);
    expect(state.phase).toBe('cabinetOut');
    expect(state.cabinetTransform).toBe('exiting');
    expect(state.winnerEmphasis).toBe('crowned');
  });

  // v4: cabinetOut overlap — wizard ceremony starts during last 200ms of cabinetOut
  it('elapsed=16000 => phase=cabinetOut, phaseElapsed>=200, wizardMode=ceremony', () => {
    const ctx = buildContext();
    const state = computePhaseState(16000, mockCeremony, ctx);
    expect(state.phase).toBe('cabinetOut');
    expect(state.wizardMode).toBe('ceremony');
  });

  it('elapsed=16300 => phase=crownDelivery, cabinetTransform=gone', () => {
    const ctx = buildContext();
    const state = computePhaseState(16300, mockCeremony, ctx);
    expect(state.phase).toBe('crownDelivery');
    expect(state.cabinetTransform).toBe('gone');
    expect(state.wizardMode).toBe('ceremony');
    expect(state.dimLevel).toBe(0.35);
  });

  it('elapsed=21300 => phase=done', () => {
    const ctx = buildContext();
    const state = computePhaseState(21300, mockCeremony, ctx);
    expect(state.phase).toBe('done');
    expect(state.cabinetTransform).toBe('gone');
    expect(state.dimLevel).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Reduced motion — short path
// ---------------------------------------------------------------------------

describe('computePhaseState — reduced motion', () => {
  it('elapsed=600 => phase=winnerFreeze (skips spin/decel/hold entirely)', () => {
    const ctx = buildReducedContext();
    const state = computePhaseState(600, mockCeremony, ctx);
    expect(state.phase).toBe('winnerFreeze');
    expect(state.reducedMotion).toBe(true);
  });

  it('elapsed=1200 is within crownDelivery (reduced motion)', () => {
    const ctx = buildReducedContext();
    const state = computePhaseState(1200, mockCeremony, ctx);
    // v4 reduced: crownDelivery starts at 1100, done at 1500
    expect(state.phase).toBe('crownDelivery');
  });

  it('elapsed=1500 => phase=done (verify short path total)', () => {
    const ctx = buildReducedContext();
    const state = computePhaseState(1500, mockCeremony, ctx);
    expect(state.phase).toBe('done');
  });
});

// ---------------------------------------------------------------------------
// Triple jackpot — marquee text
// ---------------------------------------------------------------------------

describe('computePhaseState — triple jackpot', () => {
  const tripleJackpotCeremony = {
    ...mockCeremony,
    winnerReelPair: [0, 1],
    isTripleJackpot: true,
  };

  it('during winnerEmphasis with isTripleJackpot=true, marquee=tripleJackpot', () => {
    const ctx = buildContext(tripleJackpotCeremony);
    // v4+: winnerEmphasis starts at 14600, first 400ms show tripleJackpot
    const state = computePhaseState(14600, tripleJackpotCeremony, ctx);
    expect(state.phase).toBe('winnerEmphasis');
    expect(state.marqueeText).toBe('tripleJackpot');
    expect(state.isTripleJackpot).toBe(true);
  });

  it('tripleJackpot marquee ends after 400ms of winnerEmphasis', () => {
    const ctx = buildContext(tripleJackpotCeremony);
    // v4+: phaseElapsed = 15000 - 14600 = 400 => no longer tripleJackpot
    const state = computePhaseState(15000, tripleJackpotCeremony, ctx);
    expect(state.phase).toBe('winnerEmphasis');
    expect(state.marqueeText).toBe('rising');
  });

  it('non-triple ceremony shows "rising" during winnerEmphasis', () => {
    const ctx = buildContext();
    // v4+: winnerEmphasis starts at 14600
    const state = computePhaseState(14600, mockCeremony, ctx);
    expect(state.phase).toBe('winnerEmphasis');
    expect(state.marqueeText).toBe('rising');
    expect(state.isTripleJackpot).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Compressed ceremony
// ---------------------------------------------------------------------------

describe('computePhaseState — compressed ceremony', () => {
  const compressedCeremony = {
    ...mockCeremony,
    wasCompressed: true,
    candidateIds: ['a'],
    candidateNames: { a: 'Alice' },
    winnerId: 'a',
    nearMissTargetId: null,
    winnerReelPair: null,
    nonMatchReelPlayerId: null,
    isTripleJackpot: false,
    reelFillerIds: [],
    reelSeeds: [0, 0, 0],
  };

  it('elapsed=0 => crownRemoval (compressed)', () => {
    const ctx = buildCompressedContext();
    const state = computePhaseState(0, compressedCeremony, ctx);
    expect(state.phase).toBe('crownRemoval');
    expect(state.marqueeText).toBe('compressed');
  });

  it('elapsed=5000 => crownDelivery (skips cabinet entirely)', () => {
    const ctx = buildCompressedContext();
    const state = computePhaseState(5000, compressedCeremony, ctx);
    expect(state.phase).toBe('crownDelivery');
  });

  it('elapsed=10000 => done', () => {
    const ctx = buildCompressedContext();
    const state = computePhaseState(10000, compressedCeremony, ctx);
    expect(state.phase).toBe('done');
  });
});

// ---------------------------------------------------------------------------
// Crown removal (Act 1) — replaces farewell walk
// ---------------------------------------------------------------------------

describe('computePhaseState — crown removal (Act 1)', () => {
  it('wizardMode=ceremony during crownRemoval', () => {
    const ctx = buildContext();
    const state = computePhaseState(500, mockCeremony, ctx);
    expect(state.wizardMode).toBe('ceremony');
    expect(state.wizardCeremonyBubble).not.toBeNull();
    expect(state.wizardCeremonyPosition).not.toBeNull();
  });

  it('wizardMode is ceremony during spinning (PM visible during cabinet)', () => {
    const ctx = buildContext();
    const state = computePhaseState(5500, mockCeremony, ctx);
    expect(state.phase).toBe('spinning');
    expect(state.wizardMode).toBe('ceremony');
  });

  it('wizard position moves during crown removal', () => {
    const ctx = buildContext();
    const state0 = computePhaseState(0, mockCeremony, ctx);
    const state500 = computePhaseState(500, mockCeremony, ctx);
    // Position should have moved (y coordinate changes during vertical walk)
    expect(state500.wizardCeremonyPosition.y).not.toBe(state0.wizardCeremonyPosition.y);
  });

  it('leaderWalkOffTriggered is true at t=3000ms', () => {
    const ctx = buildContext();
    const state = computePhaseState(3000, mockCeremony, ctx);
    expect(state.leaderWalkOffTriggered).toBe(true);
  });

  it('leaderWalkOffTriggered is false before t=2500ms', () => {
    const ctx = buildContext();
    const state = computePhaseState(2000, mockCeremony, ctx);
    expect(state.leaderWalkOffTriggered).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Dim level progression
// ---------------------------------------------------------------------------

describe('computePhaseState — dim level', () => {
  it('dim level ramps from 0 to 0.35 during first 400ms of crownRemoval', () => {
    const ctx = buildContext();
    const state0 = computePhaseState(0, mockCeremony, ctx);
    expect(state0.dimLevel).toBe(0);

    const state200 = computePhaseState(200, mockCeremony, ctx);
    expect(state200.dimLevel).toBeCloseTo(0.175, 1);

    const state400 = computePhaseState(400, mockCeremony, ctx);
    expect(state400.dimLevel).toBeCloseTo(0.35, 2);
  });

  it('dim level is 1 during spinning phase', () => {
    const ctx = buildContext();
    const state = computePhaseState(5500, mockCeremony, ctx);
    expect(state.phase).toBe('spinning');
    expect(state.dimLevel).toBe(1);
  });

  it('dim level decreases during cabinetOut', () => {
    const ctx = buildContext();
    const state = computePhaseState(15800, mockCeremony, ctx);
    expect(state.phase).toBe('cabinetOut');
    // v4: cabinetOut dim starts at 1.0, ramps to 0.35
    expect(state.dimLevel).toBeGreaterThanOrEqual(0.35);

    const stateMid = computePhaseState(16000, mockCeremony, ctx);
    expect(stateMid.dimLevel).toBeGreaterThanOrEqual(0.35);
    expect(stateMid.dimLevel).toBeLessThan(1);
  });

  it('dim level is 0.35 during crownDelivery (early)', () => {
    const ctx = buildContext();
    const state = computePhaseState(16400, mockCeremony, ctx);
    expect(state.phase).toBe('crownDelivery');
    expect(state.dimLevel).toBe(0.35);
  });

  it('dim level is 0 when done', () => {
    const ctx = buildContext();
    const state = computePhaseState(21300, mockCeremony, ctx);
    expect(state.dimLevel).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Skippable flag
// ---------------------------------------------------------------------------

describe('computePhaseState — skippable', () => {
  it('not skippable before 2000ms', () => {
    const ctx = buildContext();
    expect(computePhaseState(0, mockCeremony, ctx).skippable).toBe(false);
    expect(computePhaseState(1999, mockCeremony, ctx).skippable).toBe(false);
  });

  it('skippable at and after 2000ms', () => {
    const ctx = buildContext();
    expect(computePhaseState(2000, mockCeremony, ctx).skippable).toBe(true);
    expect(computePhaseState(5000, mockCeremony, ctx).skippable).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// REGRESSION: skip keybind during postCabinet (iter 3 fix)
// ---------------------------------------------------------------------------

describe('computePhaseState — skip keybind regression: postCabinet fast-forward', () => {
  // This test verifies the phase state at times relevant to the skip keybind logic.
  // The actual keydown handler is in the hook, but we can verify that the phase
  // machine produces correct states at the skip target times.

  it('at cabinetOut start (15800ms), phase is cabinetOut', () => {
    const ctx = buildContext();
    const state = computePhaseState(15800, mockCeremony, ctx);
    expect(state.phase).toBe('cabinetOut');
  });

  it('at near-done (doneStart - 50 = 21250ms), phase is crownDelivery (not rewind)', () => {
    const ctx = buildContext();
    // v4+: doneStart = 21300, so 21300 - 50 = 21250 should be in crownDelivery
    const state = computePhaseState(21250, mockCeremony, ctx);
    expect(state.phase).toBe('crownDelivery');
    expect(state.phase).not.toBe('cabinetOut');
    expect(state.phase).not.toBe('spinning');
  });
});

// ---------------------------------------------------------------------------
// v3 match confirmation and non-match reel
// ---------------------------------------------------------------------------

describe('computePhaseState — match confirmation and non-match reel', () => {
  it('matchConfirmed is null before winnerEmphasis', () => {
    const ctx = buildContext();
    const state = computePhaseState(9900, mockCeremony, ctx);
    expect(state.matchConfirmed).toBeNull();
  });

  it('matchConfirmed is set during winnerEmphasis with correct reels', () => {
    const ctx = buildContext();
    // v4+: winnerEmphasis starts at 14600
    const state = computePhaseState(14600, mockCeremony, ctx);
    expect(state.matchConfirmed).toEqual({
      reels: [0, 2],
      isTriple: false,
    });
  });

  it('matchingReelIndices matches the winnerReelPair (non-triple)', () => {
    const ctx = buildContext();
    const state = computePhaseState(14600, mockCeremony, ctx);
    expect(state.matchingReelIndices).toEqual([0, 2]);
  });

  it('nonMatchReelIndex is the reel NOT in winnerReelPair', () => {
    const ctx = buildContext();
    const state = computePhaseState(14600, mockCeremony, ctx);
    expect(state.nonMatchReelIndex).toBe(1);
  });

  it('non-match reel is dimmed during winnerEmphasis', () => {
    const ctx = buildContext();
    const state = computePhaseState(14600, mockCeremony, ctx);
    expect(state.reelStates[1].dimmed).toBe(true);
    expect(state.reelStates[0].dimmed).toBe(false);
    expect(state.reelStates[2].dimmed).toBe(false);
  });

  it('triple jackpot includes reel 2 in matchingReelIndices', () => {
    const tripleJackpotCeremony = {
      ...mockCeremony,
      winnerReelPair: [0, 1],
      isTripleJackpot: true,
    };
    const ctx = buildContext(tripleJackpotCeremony);
    const state = computePhaseState(14600, tripleJackpotCeremony, ctx);
    expect(state.matchingReelIndices).toEqual([0, 1, 2]);
  });
});

// ---------------------------------------------------------------------------
// Reel state assertions
// ---------------------------------------------------------------------------

describe('computePhaseState — reel states', () => {
  it('reels are not stopped during spinning phase', () => {
    const ctx = buildContext();
    // v4+: spinning starts at 5400
    const state = computePhaseState(5500, mockCeremony, ctx);
    expect(state.phase).toBe('spinning');
    for (const reel of state.reelStates) {
      expect(reel.stopped).toBe(false);
    }
  });

  it('reel 0 stops by REEL0_STOP_AT (9400ms)', () => {
    const ctx = buildContext();
    const state = computePhaseState(9401, mockCeremony, ctx);
    expect(state.phase).toBe('decelerating');
    expect(state.reelStates[0].stopped).toBe(true);
  });

  it('reel 1 stops by REEL1_STOP_AT (9900ms)', () => {
    const ctx = buildContext();
    const state = computePhaseState(9901, mockCeremony, ctx);
    expect(state.phase).toBe('matchedHold');
    expect(state.reelStates[0].stopped).toBe(true);
    expect(state.reelStates[1].stopped).toBe(true);
    expect(state.reelStates[2].stopped).toBe(false); // reel 2 still spinning
  });

  it('during matchedHold, only winner-pair reels pulse', () => {
    const ctx = buildContext();
    // v4+: matchedHold starts at 9900. Pulse cycle is 300ms: active when 60 <= (elapsed - 9900) % 300 < 240
    // At 9960: (9960-9900) % 300 = 60 => pulse ON
    const state = computePhaseState(9960, mockCeremony, ctx);
    expect(state.phase).toBe('matchedHold');
    expect(state.reelStates[0].pulseActive).toBe(true);
    expect(state.reelStates[1].pulseActive).toBe(false);
    expect(state.reelStates[2].stopped).toBe(false);
  });

  it('all reels stopped and locked after winnerFreeze', () => {
    const ctx = buildContext();
    // v4+: winnerFreeze starts at 14200
    const state = computePhaseState(14200, mockCeremony, ctx);
    expect(state.phase).toBe('winnerFreeze');
    for (const reel of state.reelStates) {
      expect(reel.stopped).toBe(true);
    }
  });

  it('compressed ceremony: all reels frozen from the start', () => {
    const compressedCeremony = {
      ...mockCeremony,
      wasCompressed: true,
      candidateIds: ['a'],
      winnerId: 'a',
      nearMissTargetId: null,
      winnerReelPair: null,
      nonMatchReelPlayerId: null,
      isTripleJackpot: false,
      reelFillerIds: [],
      reelSeeds: [0, 0, 0],
    };
    const ctx = buildCompressedContext();
    const state = computePhaseState(0, compressedCeremony, ctx);
    for (const reel of state.reelStates) {
      expect(reel.stopped).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Bulb pattern progression
// ---------------------------------------------------------------------------

describe('computePhaseState — bulb pattern', () => {
  it('chase during spinning', () => {
    const ctx = buildContext();
    // v4+: spinning starts at 5400
    const state = computePhaseState(5500, mockCeremony, ctx);
    expect(state.bulbPattern).toBe('chase');
  });

  it('dark during near-miss hold', () => {
    const ctx = buildContext();
    const state = computePhaseState(NEAR_MISS_HOLD_START + 50, mockCeremony, ctx);
    expect(state.bulbPattern).toBe('dark');
  });

  it('allLit during winnerFreeze', () => {
    const ctx = buildContext();
    // v4+: winnerFreeze starts at 14200
    const state = computePhaseState(14200, mockCeremony, ctx);
    expect(state.bulbPattern).toBe('allLit');
  });

  it('slowPulse during cabinetOut', () => {
    const ctx = buildContext();
    // v4+: cabinetOut starts at 15800
    const state = computePhaseState(15800, mockCeremony, ctx);
    expect(state.bulbPattern).toBe('slowPulse');
  });
});

// ---------------------------------------------------------------------------
// Crown and flourish
// ---------------------------------------------------------------------------

describe('computePhaseState — crown and flourish', () => {
  it('crownPosition is null before winnerEmphasis', () => {
    const ctx = buildContext();
    const state = computePhaseState(9900, mockCeremony, ctx);
    expect(state.crownPosition).toBeNull();
  });

  it('crownPosition is settled during winnerEmphasis', () => {
    const ctx = buildContext();
    // v4+: winnerEmphasis starts at 14600
    const state = computePhaseState(14600, mockCeremony, ctx);
    expect(state.crownPosition).toEqual({ mode: 'settled', progress: 1 });
  });

  it('flourish is null when ceremony has no flourishVariant', () => {
    const ctx = buildContext();
    const state = computePhaseState(14600, mockCeremony, ctx);
    expect(state.flourish).toBeNull();
  });

  it('flourish is set during winnerEmphasis when ceremony has a variant', () => {
    const ceremony = { ...mockCeremony, flourishVariant: 'cat' };
    const ctx = buildContext(ceremony);
    const state = computePhaseState(14600, ceremony, ctx);
    expect(state.flourish).toBe('cat');
  });
});

// ---------------------------------------------------------------------------
// REEL2_CLICK_MOMENTS validation
// ---------------------------------------------------------------------------

describe('REEL2_CLICK_MOMENTS', () => {
  it('has exactly 6 moments matching the 6 slowdown intervals', () => {
    expect(REEL2_CLICK_MOMENTS.length).toBe(6);
  });

  it('first moment is REEL2_SLOWDOWN_START + first interval', () => {
    // v4+: REEL2_SLOWDOWN_START = 11100
    expect(REEL2_CLICK_MOMENTS[0]).toBe(11100 + 220);
  });

  it('last moment is 13284 (11100 + sum of intervals)', () => {
    // 11100 + 220 + 264 + 316 + 380 + 456 + 548 = 13284
    expect(REEL2_CLICK_MOMENTS[5]).toBe(13284);
  });

  it('moments are strictly increasing', () => {
    for (let i = 1; i < REEL2_CLICK_MOMENTS.length; i++) {
      expect(REEL2_CLICK_MOMENTS[i]).toBeGreaterThan(REEL2_CLICK_MOMENTS[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// crownDelivery (Act 3) procession announcement
// ---------------------------------------------------------------------------

describe('computePhaseState — crownDelivery procession', () => {
  it('showProcessionAnnouncement is true in early crownDelivery', () => {
    const ctx = buildContext();
    // v4+: crownDelivery starts at 16300
    const state = computePhaseState(16300, mockCeremony, ctx);
    expect(state.phase).toBe('crownDelivery');
    expect(state.showProcessionAnnouncement).toBe(true);
  });

  it('showProcessionAnnouncement is false after 3500ms of crownDelivery', () => {
    const ctx = buildContext();
    // crownDelivery starts at 16300, so 16300 + 3500 = 19800
    const state = computePhaseState(19800, mockCeremony, ctx);
    expect(state.phase).toBe('crownDelivery');
    expect(state.showProcessionAnnouncement).toBe(false);
  });

  it('processionSpotlightPosition is set during crownDelivery', () => {
    const ctx = buildContext();
    const state = computePhaseState(16500, mockCeremony, ctx);
    expect(state.processionSpotlightPosition).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computePlayerGridPosition — math-based grid position (replaces DOM query)
// ---------------------------------------------------------------------------

describe('computePlayerGridPosition', () => {
  it('returns center of first item for index=0, 1 player', () => {
    const pos = computePlayerGridPosition(0, 1, 1440);
    // rowWidth = 1 * 80 + 0 * 28 = 80
    // rowLeft = (1440 - 80) / 2 = 680
    // x = 680 + 0 * 108 + 40 = 720 (center of viewport)
    expect(pos.x).toBe(720);
    // y = 174 + 0 * (180 + 16) + 70 = 244  (FIGURE_OFFSET_FROM_TOP, not item center)
    expect(pos.y).toBe(244);
  });

  it('places second player to the right of the first', () => {
    const pos0 = computePlayerGridPosition(0, 4, 1440);
    const pos1 = computePlayerGridPosition(1, 4, 1440);
    expect(pos1.x).toBeGreaterThan(pos0.x);
    expect(pos1.y).toBe(pos0.y);
  });

  it('wraps to next row when columns are full', () => {
    // With viewportWidth=400, availableWidth = 400 - 32 = 368
    // slotPitch = 80 + 28 = 108
    // columnsPerRow = floor((368 + 28) / 108) = floor(396/108) = 3
    // index=2 is last col of row 0, index=3 wraps to row 1
    const posLastCol = computePlayerGridPosition(2, 8, 400);
    const posNextRow = computePlayerGridPosition(3, 8, 400);
    expect(posNextRow.y).toBeGreaterThan(posLastCol.y);
  });

  it('centers each row horizontally', () => {
    const pos = computePlayerGridPosition(0, 2, 1000);
    // availableWidth = 1000 - 32 = 968
    // slotPitch = 108, columnsPerRow = floor((968+28)/108) = floor(996/108) = 9
    // colsThisRow = 2 (only 2 players)
    // rowWidth = 2 * 80 + 1 * 28 = 188
    // rowLeft = (1000 - 188) / 2 = 406
    // x = 406 + 0 * 108 + 40 = 446
    expect(pos.x).toBe(446);
  });
});

// ---------------------------------------------------------------------------
// Fix #5 regression: CEREMONY_WALK_FRAME_MS === 400
// ---------------------------------------------------------------------------

describe('computePhaseState — walk speed (Fix #5 regression)', () => {
  // CEREMONY_WALK_FRAME_MS is not exported, but we can verify its value
  // indirectly by checking wizardCeremonyPose alternation timing.
  // At 400ms intervals the pose toggles between 'walk1' and 'walk2'.

  it('wizardCeremonyPose alternates at 400ms intervals during crownRemoval walk', () => {
    const ctx = buildContext();
    // During crownRemoval walk (0-2000ms), pose = floor(elapsed / 400) % 2
    // At elapsed=0:   floor(0/400)=0, 0%2=0 => walk1
    // At elapsed=399: floor(399/400)=0, 0%2=0 => walk1
    // At elapsed=400: floor(400/400)=1, 1%2=1 => walk2
    // At elapsed=799: floor(799/400)=1, 1%2=1 => walk2
    // At elapsed=800: floor(800/400)=2, 2%2=0 => walk1
    const state0 = computePhaseState(0, mockCeremony, ctx);
    const state399 = computePhaseState(399, mockCeremony, ctx);
    const state400 = computePhaseState(400, mockCeremony, ctx);
    const state799 = computePhaseState(799, mockCeremony, ctx);
    const state800 = computePhaseState(800, mockCeremony, ctx);

    expect(state0.wizardCeremonyPose).toBe('walk1');
    expect(state399.wizardCeremonyPose).toBe('walk1');
    expect(state400.wizardCeremonyPose).toBe('walk2');
    expect(state799.wizardCeremonyPose).toBe('walk2');
    expect(state800.wizardCeremonyPose).toBe('walk1');
  });

  it('walk frame period is NOT 280ms (pre-fix value would give different toggle points)', () => {
    const ctx = buildContext();
    // If CEREMONY_WALK_FRAME_MS were 280 (the old value), elapsed=280 would toggle.
    // With 400ms, elapsed=280 is still in the first frame (walk1).
    const state280 = computePhaseState(280, mockCeremony, ctx);
    expect(state280.wizardCeremonyPose).toBe('walk1');
    // And at 400 it toggles (which it would NOT at exactly 400 if frame was 280)
    const state400 = computePhaseState(400, mockCeremony, ctx);
    expect(state400.wizardCeremonyPose).toBe('walk2');
  });
});

// ---------------------------------------------------------------------------
// Fix #3 regression: Transition crown during crownDelivery settled state
// ---------------------------------------------------------------------------

describe('computePhaseState — transition crown (Fix #3 regression)', () => {
  it('crownDelivery at phaseElapsed=3000 (settled): parent=new-leader-head, progress>=1', () => {
    // hadCrown=true ceremony for crown transfer
    const ceremony = { ...mockCeremony, outgoingLeaderHadCrown: true };
    const ctx = buildContext(ceremony);
    // crownDelivery starts at 16300, so absolute elapsed = 16300 + 3000 = 19300
    const state = computePhaseState(19300, ceremony, ctx);
    expect(state.phase).toBe('crownDelivery');
    expect(state.crownCeremonyState).not.toBeNull();
    expect(state.crownCeremonyState.parent).toBe('new-leader-head');
    expect(state.crownCeremonyState.progress).toBeGreaterThanOrEqual(1);
  });

  it('crownDelivery at phaseElapsed=4000 (walk-back): crown settled on new leader head', () => {
    const ceremony = { ...mockCeremony, outgoingLeaderHadCrown: true };
    const ctx = buildContext(ceremony);
    // 16300 + 4000 = 20300
    const state = computePhaseState(20300, ceremony, ctx);
    expect(state.phase).toBe('crownDelivery');
    expect(state.crownCeremonyState).not.toBeNull();
    expect(state.crownCeremonyState.parent).toBe('new-leader-head');
    expect(state.crownCeremonyState.progress).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Fix #4 regression: Crown arc mid-lift and mid-place
// ---------------------------------------------------------------------------

describe('computePhaseState — crown arc transitions (Fix #4 regression)', () => {
  // These tests verify the crown ceremony state transitions through the
  // correct parent values, ensuring the arc animation works properly.

  it('crownRemoval mid-lift (phaseElapsed=2600): parent=leader-head, progress between 0 and 1', () => {
    const ceremony = { ...mockCeremony, outgoingLeaderHadCrown: true };
    const ctx = buildContext(ceremony);
    // crownRemoval starts at 0, so absolute elapsed = 2600
    // Crown lift runs from 2500 to 3000 (500ms window)
    // At 2600: liftProgress = (2600 - 2500) / 500 = 0.2
    const state = computePhaseState(2600, ceremony, ctx);
    expect(state.phase).toBe('crownRemoval');
    expect(state.crownCeremonyState).not.toBeNull();
    expect(state.crownCeremonyState.parent).toBe('leader-head');
    expect(state.crownCeremonyState.progress).toBeGreaterThan(0);
    expect(state.crownCeremonyState.progress).toBeLessThan(1);
  });

  it('crownDelivery mid-place (phaseElapsed=2600): parent=new-leader-head, progress between 0 and 1', () => {
    const ceremony = { ...mockCeremony, outgoingLeaderHadCrown: true };
    const ctx = buildContext(ceremony);
    // crownDelivery starts at 16300, so absolute elapsed = 16300 + 2600 = 18900
    // Crown place runs from 2500 to 3000 (500ms window within crownDelivery)
    // At phaseElapsed=2600: placeProgress = (2600 - 2500) / 500 = 0.2
    const state = computePhaseState(18900, ceremony, ctx);
    expect(state.phase).toBe('crownDelivery');
    expect(state.crownCeremonyState).not.toBeNull();
    // Fix #4: parent is 'new-leader-head' (not 'wizard-hand') so the mode
    // mapper in SlotMachineStage produces 'arcing' mode when progress < 1
    expect(state.crownCeremonyState.parent).toBe('new-leader-head');
    expect(state.crownCeremonyState.progress).toBeGreaterThan(0);
    expect(state.crownCeremonyState.progress).toBeLessThan(1);
  });

  it('crownRemoval after lift complete (phaseElapsed=3000): parent=wizard-hand', () => {
    const ceremony = { ...mockCeremony, outgoingLeaderHadCrown: true };
    const ctx = buildContext(ceremony);
    // liftProgress at phaseElapsed=3000: (3000-2500)/500 = 1.0 => clamped to 1
    const state = computePhaseState(3000, ceremony, ctx);
    expect(state.phase).toBe('crownRemoval');
    expect(state.crownCeremonyState).not.toBeNull();
    // Once lift is complete (progress >= 1), parent switches to 'wizard-hand'
    expect(state.crownCeremonyState.parent).toBe('wizard-hand');
    expect(state.crownCeremonyState.progress).toBeGreaterThanOrEqual(1);
  });

  it('crownDelivery after place complete (phaseElapsed=3000): parent=new-leader-head, progress=1', () => {
    const ceremony = { ...mockCeremony, outgoingLeaderHadCrown: true };
    const ctx = buildContext(ceremony);
    // crownDelivery starts at 16300, phaseElapsed=3000 => absolute 19300
    // placeProgress = (3000-2500)/500 = 1.0
    const state = computePhaseState(19300, ceremony, ctx);
    expect(state.phase).toBe('crownDelivery');
    expect(state.crownCeremonyState).not.toBeNull();
    expect(state.crownCeremonyState.parent).toBe('new-leader-head');
    expect(state.crownCeremonyState.progress).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// CRITICAL REGRESSION: outgoingLeaderHadCrown=true full ceremony path
// ---------------------------------------------------------------------------

describe('computePhaseState — outgoingLeaderHadCrown: true (full crown path)', () => {
  const crownedCeremony = {
    ...mockCeremony,
    outgoingLeaderHadCrown: true,
  };

  // --- Crown Removal (Act 1) ---

  it('crownRemoval start: crown on leader-head, progress=0', () => {
    const ctx = buildContext(crownedCeremony);
    const state = computePhaseState(0, crownedCeremony, ctx);
    expect(state.phase).toBe('crownRemoval');
    expect(state.crownCeremonyState).not.toBeNull();
    expect(state.crownCeremonyState.parent).toBe('leader-head');
    expect(state.crownCeremonyState.progress).toBe(0);
  });

  it('crownRemoval during walk (phaseElapsed=500): crown still on leader-head', () => {
    const ctx = buildContext(crownedCeremony);
    const state = computePhaseState(500, crownedCeremony, ctx);
    expect(state.phase).toBe('crownRemoval');
    expect(state.crownCeremonyState.parent).toBe('leader-head');
    expect(state.crownCeremonyState.progress).toBe(0);
  });

  it('crownRemoval gravity pause (phaseElapsed=2100): crown still on leader-head', () => {
    const ctx = buildContext(crownedCeremony);
    const state = computePhaseState(2100, crownedCeremony, ctx);
    expect(state.phase).toBe('crownRemoval');
    expect(state.crownCeremonyState.parent).toBe('leader-head');
    expect(state.crownCeremonyState.progress).toBe(0);
  });

  it('crownRemoval lift midway (phaseElapsed=2750): transitioning off leader-head', () => {
    const ctx = buildContext(crownedCeremony);
    // liftProgress = (2750-2500)/500 = 0.5
    const state = computePhaseState(2750, crownedCeremony, ctx);
    expect(state.phase).toBe('crownRemoval');
    expect(state.crownCeremonyState.parent).toBe('leader-head');
    expect(state.crownCeremonyState.progress).toBeCloseTo(0.5, 1);
  });

  it('crownRemoval lift complete (phaseElapsed=3000): crown in wizard-hand', () => {
    const ctx = buildContext(crownedCeremony);
    const state = computePhaseState(3000, crownedCeremony, ctx);
    expect(state.crownCeremonyState.parent).toBe('wizard-hand');
    expect(state.crownCeremonyState.progress).toBeGreaterThanOrEqual(1);
  });

  it('crownRemoval walk-back (phaseElapsed=3600): crown in wizard-hand', () => {
    const ctx = buildContext(crownedCeremony);
    const state = computePhaseState(3600, crownedCeremony, ctx);
    expect(state.phase).toBe('crownRemoval');
    expect(state.crownCeremonyState.parent).toBe('wizard-hand');
    expect(state.crownCeremonyState.progress).toBe(1);
  });

  it('crownRemoval silence gap (phaseElapsed=4800): crown in wizard-hand', () => {
    const ctx = buildContext(crownedCeremony);
    const state = computePhaseState(4800, crownedCeremony, ctx);
    expect(state.phase).toBe('crownRemoval');
    expect(state.crownCeremonyState.parent).toBe('wizard-hand');
    expect(state.crownCeremonyState.progress).toBe(1);
  });

  // --- Cabinet phases (Act 2) — PM visible holding crown during slot machine ---

  it('during spinning: crownCeremonyState is wizard-hand (hadCrown=true, PM visible)', () => {
    const ctx = buildContext(crownedCeremony);
    // spinning starts at 5400
    const state = computePhaseState(5500, crownedCeremony, ctx);
    expect(state.phase).toBe('spinning');
    // PM visible during cabinet with crown in hand
    expect(state.wizardMode).toBe('ceremony');
    expect(state.crownCeremonyState).not.toBeNull();
    expect(state.crownCeremonyState.parent).toBe('wizard-hand');
    expect(state.crownCeremonyState.progress).toBe(1);
  });

  // --- Crown Delivery (Act 3) ---

  it('crownDelivery start (phaseElapsed=0): crown in wizard-hand', () => {
    const ctx = buildContext(crownedCeremony);
    // crownDelivery starts at 16300
    const state = computePhaseState(16300, crownedCeremony, ctx);
    expect(state.phase).toBe('crownDelivery');
    expect(state.crownCeremonyState).not.toBeNull();
    expect(state.crownCeremonyState.parent).toBe('wizard-hand');
    expect(state.crownCeremonyState.progress).toBe(1);
  });

  it('crownDelivery walk (phaseElapsed=1000): crown still in wizard-hand', () => {
    const ctx = buildContext(crownedCeremony);
    const state = computePhaseState(17300, crownedCeremony, ctx);
    expect(state.phase).toBe('crownDelivery');
    expect(state.crownCeremonyState.parent).toBe('wizard-hand');
    expect(state.crownCeremonyState.progress).toBe(1);
  });

  it('crownDelivery gravity pause (phaseElapsed=2100): crown in wizard-hand', () => {
    const ctx = buildContext(crownedCeremony);
    const state = computePhaseState(18400, crownedCeremony, ctx);
    expect(state.phase).toBe('crownDelivery');
    expect(state.crownCeremonyState.parent).toBe('wizard-hand');
    expect(state.crownCeremonyState.progress).toBe(1);
  });

  it('crownDelivery place midway (phaseElapsed=2750): arcing to new-leader-head', () => {
    const ctx = buildContext(crownedCeremony);
    // placeProgress = (2750-2500)/500 = 0.5
    const state = computePhaseState(19050, crownedCeremony, ctx);
    expect(state.phase).toBe('crownDelivery');
    expect(state.crownCeremonyState.parent).toBe('new-leader-head');
    expect(state.crownCeremonyState.progress).toBeCloseTo(0.5, 1);
  });

  it('crownDelivery place complete (phaseElapsed=3000): crown settled on new-leader-head', () => {
    const ctx = buildContext(crownedCeremony);
    const state = computePhaseState(19300, crownedCeremony, ctx);
    expect(state.phase).toBe('crownDelivery');
    expect(state.crownCeremonyState.parent).toBe('new-leader-head');
    expect(state.crownCeremonyState.progress).toBeGreaterThanOrEqual(1);
  });

  it('crownDelivery walk-back (phaseElapsed=4000): crown on new-leader-head', () => {
    const ctx = buildContext(crownedCeremony);
    const state = computePhaseState(20300, crownedCeremony, ctx);
    expect(state.phase).toBe('crownDelivery');
    expect(state.crownCeremonyState.parent).toBe('new-leader-head');
    expect(state.crownCeremonyState.progress).toBe(1);
  });

  // --- Contrast with outgoingLeaderHadCrown=false ---

  it('crownRemoval with hadCrown=false: crownCeremonyState is null throughout', () => {
    // Default mockCeremony has outgoingLeaderHadCrown: false
    const ctx = buildContext();
    const state0 = computePhaseState(0, mockCeremony, ctx);
    const state2600 = computePhaseState(2600, mockCeremony, ctx);
    const state3000 = computePhaseState(3000, mockCeremony, ctx);
    expect(state0.crownCeremonyState).toBeNull();
    expect(state2600.crownCeremonyState).toBeNull();
    expect(state3000.crownCeremonyState).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// REGRESSION: PM walks to correct position when outgoing leader disconnected
// ---------------------------------------------------------------------------

describe('computePhaseState — disconnected outgoing leader (v7 injection)', () => {
  // Scenario: outgoing leader has disconnected (not in context.players), but
  // ceremony.outgoingLeaderLastData still has their data. PlayerList renders a
  // synthetic figure at the grid position based on joinedAt sort order. The PM
  // must walk to that grid position, NOT the center fallback.

  const disconnectedCeremony = {
    ...mockCeremony,
    outgoingLeaderId: 'old-leader',
    outgoingLeaderLastData: { name: 'OldLeader', role: 'player', joinedAt: 100 },
    outgoingLeaderHadCrown: true,
  };

  // Live players do NOT include 'old-leader' — they disconnected.
  const playersWithoutOldLeader = {
    p1: { name: 'Alice', role: 'player', joinedAt: 200 },
    p2: { name: 'Bob', role: 'player', joinedAt: 300 },
  };

  // With injection: old-leader (joinedAt=100) sorts first among 3 players.
  // Without injection: only p1, p2 exist and liveIndex=-1 => center fallback.

  it('crownRemoval: PM walks to outgoing leader grid position, not center fallback', () => {
    const ctx = buildContext(disconnectedCeremony, {
      players: playersWithoutOldLeader,
    });
    // At phaseElapsed=1000 (mid-walk to leader), wizard should be interpolating
    // toward the outgoing leader's grid position, not the center fallback.
    const state = computePhaseState(1000, disconnectedCeremony, ctx);
    expect(state.phase).toBe('crownRemoval');

    // Compute expected grid position: old-leader has joinedAt=100, sorts index 0
    // in a 3-player list (old-leader@100, p1@200, p2@300).
    const expectedPos = computePlayerGridPosition(0, 3, 1440);
    const centerFallback = { x: 1440 * 0.5, y: 900 * 0.4 };

    // The wizard position should NOT be the center fallback.
    // At progress=0.5 (1000/2000), it should be halfway between start and target.
    // Just verify it's not heading toward the center fallback.
    const wizPos = state.wizardCeremonyPosition;

    // If the bug were present, the target would be centerFallback (720, 360).
    // With the fix, target is expectedPos (a grid position, y ~ 244).
    // The start position is default: { x: 720, y: 760 } (vw/2, vh-140).
    // At progress=0.5, y should be (760 + expectedPos.y) / 2, not (760 + 360) / 2.
    expect(wizPos.y).not.toBeCloseTo(
      (900 - 140 + centerFallback.y) / 2,
      0
    );
    // Positive check: y should be moving toward the grid position
    expect(wizPos.y).toBeLessThan(900 - 140); // below start
    expect(wizPos.y).toBeGreaterThan(expectedPos.y - 50); // approaching target
  });

  it('crownRemoval at gravity pause: wizard at outgoing leader grid position', () => {
    const ctx = buildContext(disconnectedCeremony, {
      players: playersWithoutOldLeader,
    });
    // At phaseElapsed=2100 (gravity pause), wizard should be AT target position.
    const state = computePhaseState(2100, disconnectedCeremony, ctx);
    expect(state.phase).toBe('crownRemoval');

    const expectedPos = computePlayerGridPosition(0, 3, 1440);
    expect(state.wizardCeremonyPosition.x).toBeCloseTo(expectedPos.x, 0);
    expect(state.wizardCeremonyPosition.y).toBeCloseTo(expectedPos.y, 0);
  });

  it('crownDelivery: PM walks to winner grid position when outgoing leader disconnected', () => {
    const ctx = buildContext(disconnectedCeremony, {
      players: {
        ...playersWithoutOldLeader,
        // Winner 'b' IS still connected
        b: { name: 'Bob-Winner', role: 'player', joinedAt: 250 },
      },
    });
    // crownDelivery starts at 16300, at phaseElapsed=2100 (gravity pause) wizard
    // should be at the winner's grid position.
    const state = computePhaseState(16300 + 2100, disconnectedCeremony, ctx);
    expect(state.phase).toBe('crownDelivery');

    // Players sorted by joinedAt: old-leader@100, p1@200, b@250, p2@300 => 4 players
    // Winner 'b' is at index 2.
    const expectedWinnerPos = computePlayerGridPosition(2, 4, 1440);
    expect(state.wizardCeremonyPosition.x).toBeCloseTo(expectedWinnerPos.x, 0);
    expect(state.wizardCeremonyPosition.y).toBeCloseTo(expectedWinnerPos.y, 0);
  });

  it('crownDelivery compressed: start position uses outgoing leader grid slot (not center)', () => {
    // In compressed ceremonies, PM walks directly from old leader to winner.
    // If old leader disconnected, start position should still be their grid slot.
    const compressedCeremony = {
      ...disconnectedCeremony,
      wasCompressed: true,
      candidateIds: ['b'],
      candidateNames: { b: 'Bob-Winner' },
      winnerId: 'b',
      nearMissTargetId: null,
      winnerReelPair: null,
      nonMatchReelPlayerId: null,
      isTripleJackpot: false,
      reelFillerIds: [],
      reelSeeds: [0, 0, 0],
    };
    const ctx = buildContext(compressedCeremony, {
      table: PHASE_TABLE_COMPRESSED,
      players: {
        ...playersWithoutOldLeader,
        b: { name: 'Bob-Winner', role: 'player', joinedAt: 250 },
      },
    });
    // crownDelivery in compressed starts at 5000.
    // At phaseElapsed=0, wizard should be at old-leader's grid position (start).
    const state = computePhaseState(5000, compressedCeremony, ctx);
    expect(state.phase).toBe('crownDelivery');

    // Outgoing leader sorted index 0 in 4 players
    const outgoingGridPos = computePlayerGridPosition(0, 4, 1440);
    // At phaseElapsed=0 (start of walk), wizard should be at start position
    expect(state.wizardCeremonyPosition.x).toBeCloseTo(outgoingGridPos.x, 0);
    expect(state.wizardCeremonyPosition.y).toBeCloseTo(outgoingGridPos.y, 0);
  });

  it('injection does NOT duplicate when outgoing leader is still connected', () => {
    // If the outgoing leader is still in context.players, the injection should
    // not create a duplicate entry.
    const stillConnectedPlayers = {
      ...playersWithoutOldLeader,
      'old-leader': { name: 'OldLeader', role: 'player', joinedAt: 100 },
    };
    const ctx = buildContext(disconnectedCeremony, {
      players: stillConnectedPlayers,
    });
    const state = computePhaseState(2100, disconnectedCeremony, ctx);
    expect(state.phase).toBe('crownRemoval');

    // Same result as if they were injected — position should be identical
    const expectedPos = computePlayerGridPosition(0, 3, 1440);
    expect(state.wizardCeremonyPosition.x).toBeCloseTo(expectedPos.x, 0);
    expect(state.wizardCeremonyPosition.y).toBeCloseTo(expectedPos.y, 0);
  });
});
