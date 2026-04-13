/**
 * ceremonyPmWalk — computeCrownRemoval and computeCrownDelivery tests.
 *
 * Tests the PM walk phases at boundary values for timing, position,
 * pose alternation, and crown state transitions.
 */

import { describe, it, expect } from 'vitest';
import { computeCrownRemoval, computeCrownDelivery } from './ceremonyPmWalk';
import { FAREWELL_PHRASES, CROWNING_BUBBLES } from './slotMachine';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const baseCeremony = {
  outgoingLeaderId: 'oldLeader',
  outgoingLeaderLastData: { name: 'OldLeader', role: 'player' },
  outgoingLeaderHadCrown: true,
  winnerId: 'winner',
  candidateIds: ['oldLeader', 'winner'],
  candidateNames: { oldLeader: 'OldLeader', winner: 'Winner' },
  wasCompressed: false,
  farewellPhraseIndex: 0,
  crowningBubbleIndex: 0,
};

function baseContext(overrides = {}) {
  return {
    viewportWidth: 1440,
    viewportHeight: 900,
    ceremonyStartPos: { x: 720, y: 760 },
    players: {
      oldLeader: { name: 'OldLeader', role: 'player', joinedAt: 1, isLeader: false },
      winner: { name: 'Winner', role: 'player', joinedAt: 2 },
    },
    reducedMotion: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeCrownRemoval
// ---------------------------------------------------------------------------

describe('computeCrownRemoval — walk phases', () => {
  it('at 0ms: PM at start position, walking to leader', () => {
    const result = computeCrownRemoval(0, baseCeremony, baseContext());
    expect(result.crownRemovalState).toBe('pmWalkToLeader');
    expect(result.pmCeremonyPosition.x).toBeCloseTo(720, 0);
    expect(result.pmCeremonyPosition.y).toBeCloseTo(760, 0);
    expect(result.pmCeremonyPose).toBe('walk1');
  });

  it('at 1000ms: PM mid-walk, position interpolated', () => {
    const result = computeCrownRemoval(1000, baseCeremony, baseContext());
    expect(result.crownRemovalState).toBe('pmWalkToLeader');
    // Should be somewhere between start and target
    expect(result.pmCeremonyPosition.x).not.toBeCloseTo(720, 0);
  });

  it('at 2000ms: PM at gravity pause', () => {
    const result = computeCrownRemoval(2100, baseCeremony, baseContext());
    expect(result.crownRemovalState).toBe('gravityPause');
    expect(result.pmCeremonyPose).toBe('walk1');
  });

  it('at 2500ms: crown lift begins', () => {
    const result = computeCrownRemoval(2500, baseCeremony, baseContext());
    expect(result.crownRemovalState).toBe('crownLift');
    expect(result.pmCeremonyPose).toBe('cast');
  });

  it('at 3000ms: crown fully lifted to pm-hand', () => {
    const result = computeCrownRemoval(3000, baseCeremony, baseContext());
    expect(result.crownCeremonyState.location).toBe('pm-hand');
    expect(result.crownCeremonyState.glowing).toBe(true);
    expect(result.leaderWalkOffTriggered).toBe(true);
  });

  it('at 3600ms: PM walking back', () => {
    const result = computeCrownRemoval(3600, baseCeremony, baseContext());
    expect(result.crownRemovalState).toBe('pmWalkBack');
    expect(result.crownCeremonyState.location).toBe('pm-hand');
  });

  it('at 4600ms: PM in silence gap', () => {
    const result = computeCrownRemoval(4600, baseCeremony, baseContext());
    expect(result.crownRemovalState).toBe('silenceGap');
    expect(result.pmCeremonyPosition.x).toBeCloseTo(720, 0);
  });
});

describe('computeCrownRemoval — pose alternation', () => {
  it('pose alternates at 400ms intervals during walk', () => {
    const at0 = computeCrownRemoval(0, baseCeremony, baseContext());
    const at399 = computeCrownRemoval(399, baseCeremony, baseContext());
    const at400 = computeCrownRemoval(400, baseCeremony, baseContext());
    const at799 = computeCrownRemoval(799, baseCeremony, baseContext());
    const at800 = computeCrownRemoval(800, baseCeremony, baseContext());

    expect(at0.pmCeremonyPose).toBe('walk1');
    expect(at399.pmCeremonyPose).toBe('walk1');
    expect(at400.pmCeremonyPose).toBe('walk2');
    expect(at799.pmCeremonyPose).toBe('walk2');
    expect(at800.pmCeremonyPose).toBe('walk1');
  });
});

describe('computeCrownRemoval — no crown case (PM creator)', () => {
  it('hadCrown=false: no crownCeremonyState throughout', () => {
    const noCrown = { ...baseCeremony, outgoingLeaderHadCrown: false };
    const at0 = computeCrownRemoval(0, noCrown, baseContext());
    const at3000 = computeCrownRemoval(3000, noCrown, baseContext());
    expect(at0.crownCeremonyState).toBeNull();
    expect(at3000.crownCeremonyState).toBeNull();
  });
});

describe('computeCrownRemoval — reduced motion', () => {
  it('instant completion: before200 lifts, after200 complete', () => {
    const ctx = baseContext({ reducedMotion: true });
    const before = computeCrownRemoval(100, baseCeremony, ctx);
    expect(before.crownRemovalState).toBe('crownLift');
    expect(before.crownCeremonyState.location).toBe('player-head');

    const after = computeCrownRemoval(300, baseCeremony, ctx);
    expect(after.crownRemovalState).toBe('pmWalkBack');
    expect(after.crownCeremonyState.location).toBe('pm-hand');
    expect(after.leaderWalkOffTriggered).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeCrownDelivery
// ---------------------------------------------------------------------------

describe('computeCrownDelivery — walk phases', () => {
  it('at 0ms: PM at start position, walking to winner', () => {
    const result = computeCrownDelivery(0, baseCeremony, baseContext());
    expect(result.crownDeliveryState).toBe('pmWalkToWinner');
    expect(result.pmCeremonyPosition.x).toBeCloseTo(720, 0);
  });

  it('at 1000ms: PM mid-walk', () => {
    const result = computeCrownDelivery(1000, baseCeremony, baseContext());
    expect(result.crownDeliveryState).toBe('pmWalkToWinner');
  });

  it('at 2100ms: gravity pause at winner', () => {
    const result = computeCrownDelivery(2100, baseCeremony, baseContext());
    expect(result.crownDeliveryState).toBe('gravityPause');
    expect(result.pmCeremonyBubble).not.toBeNull();
  });

  it('at 2500ms: crown placing begins', () => {
    const result = computeCrownDelivery(2500, baseCeremony, baseContext());
    expect(result.crownDeliveryState).toBe('crownPlace');
    expect(result.pmCeremonyPose).toBe('cast');
  });

  it('at 3000ms: crown fully placed on winner head', () => {
    const result = computeCrownDelivery(3000, baseCeremony, baseContext());
    expect(result.crownCeremonyState.location).toBe('player-head');
    expect(result.crownCeremonyState.playerId).toBe('winner');
    expect(result.crownCeremonyState.glowing).toBe(false);
  });

  it('at 3500ms: PM walking back', () => {
    const result = computeCrownDelivery(3500, baseCeremony, baseContext());
    expect(result.crownDeliveryState).toBe('pmWalkBack');
    expect(result.crownCeremonyState.location).toBe('player-head');
  });

  it('at 4600ms: PM at bottom, complete', () => {
    const result = computeCrownDelivery(4600, baseCeremony, baseContext());
    expect(result.crownDeliveryState).toBe('complete');
  });
});

describe('computeCrownDelivery — PM-creator case (no crown)', () => {
  it('materializes crown during delivery phase', () => {
    const noCrown = { ...baseCeremony, outgoingLeaderHadCrown: false };
    const at2600 = computeCrownDelivery(2600, noCrown, baseContext());
    expect(at2600.crownCeremonyState.location).toBe('materializing');
    expect(at2600.crownCeremonyState.glowing).toBe(true);
  });
});

describe('computeCrownDelivery — reduced motion', () => {
  it('instant placement: before200 arcing, after200 settled', () => {
    const ctx = baseContext({ reducedMotion: true });
    const before = computeCrownDelivery(100, baseCeremony, ctx);
    expect(before.crownDeliveryState).toBe('crownPlace');
    expect(before.crownCeremonyState.location).toBe('arcing-to-player');

    const after = computeCrownDelivery(300, baseCeremony, ctx);
    expect(after.crownDeliveryState).toBe('complete');
    expect(after.crownCeremonyState.location).toBe('player-head');
  });
});
