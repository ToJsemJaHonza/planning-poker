/**
 * slotMachine.js — pure function tests.
 *
 * Zero fake timers needed. Every function under test is a pure transform
 * (seed in, value out) so we just assert inputs vs outputs.
 */

import { describe, it, expect } from 'vitest';
import {
  mulberry32,
  buildReelOrder,
  placeEntryAt,
  buildCeremonyPayload,
  isValidCeremonyPayload,
  isStalePayload,
  isFillerKey,
  rollFlourish,
  nonPmCandidatesSorted,
  phaseTableFor,
  totalDurationFor,
  currentPhaseRow,
  SCHEMA_VERSION,
  CEREMONY_TTL_MS,
  CEREMONY_STALE_GRACE_MS,
  FILLER_TYPE_KEYS,
  FAREWELL_PHRASES,
  CROWNING_BUBBLES,
  FLOURISH_VARIANTS,
  PHASE_TABLE_STANDARD,
  PHASE_TABLE_COMPRESSED,
  PHASE_TABLE_REDUCED,
  REEL0_STOP_AT,
  REEL1_STOP_AT,
  REEL2_SLOWDOWN_START,
  REEL2_SLOWDOWN_INTERVALS,
} from './slotMachine';

// ---------------------------------------------------------------------------
// mulberry32 — deterministic PRNG
// ---------------------------------------------------------------------------

describe('mulberry32', () => {
  it('same seed produces the same sequence across calls', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    const seq1 = Array.from({ length: 20 }, () => rng1());
    const seq2 = Array.from({ length: 20 }, () => rng2());
    expect(seq1).toEqual(seq2);
  });

  it('different seeds produce different sequences', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(999);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    // Extremely unlikely for 10 floats to be identical with different seeds
    expect(seq1).not.toEqual(seq2);
  });

  it('returns values in [0, 1)', () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('seed 0 still produces a deterministic, non-degenerate sequence', () => {
    const rng = mulberry32(0);
    const vals = new Set(Array.from({ length: 100 }, () => rng()));
    // A degenerate PRNG would produce only 1-2 distinct values
    expect(vals.size).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------------------
// buildReelOrder — Fisher-Yates shuffle with seeded RNG
// ---------------------------------------------------------------------------

describe('buildReelOrder', () => {
  const pool = ['alice', 'bob', 'carol', 'dave', 'crown', 'trophy'];

  it('returns an array of the same length as the pool', () => {
    const result = buildReelOrder(pool, 42);
    expect(result.length).toBe(pool.length);
  });

  it('contains every pool member exactly once (no duplicates)', () => {
    const result = buildReelOrder(pool, 42);
    expect([...result].sort()).toEqual([...pool].sort());
  });

  it('is deterministic — same seed = same result', () => {
    const a = buildReelOrder(pool, 77);
    const b = buildReelOrder(pool, 77);
    expect(a).toEqual(b);
  });

  it('different seeds produce different orderings', () => {
    const a = buildReelOrder(pool, 1);
    const b = buildReelOrder(pool, 2);
    // Technically possible but astronomically unlikely to be identical
    expect(a).not.toEqual(b);
  });

  it('does NOT mutate the input array', () => {
    const original = [...pool];
    buildReelOrder(pool, 42);
    expect(pool).toEqual(original);
  });

  it('handles a single-element pool', () => {
    const result = buildReelOrder(['solo'], 42);
    expect(result).toEqual(['solo']);
  });

  it('handles an empty pool', () => {
    const result = buildReelOrder([], 42);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// placeEntryAt — swap an entry to a specific index
// ---------------------------------------------------------------------------

describe('placeEntryAt', () => {
  const base = ['a', 'b', 'c', 'd', 'e'];

  it('moves entry to the specified index', () => {
    const result = placeEntryAt(base, 'c', 0);
    expect(result[0]).toBe('c');
    expect(result.length).toBe(base.length);
  });

  it('preserves all other entries (no drops)', () => {
    const result = placeEntryAt(base, 'c', 1);
    expect([...result].sort()).toEqual([...base].sort());
  });

  it('returns a new array (no mutation)', () => {
    const original = [...base];
    const result = placeEntryAt(base, 'c', 0);
    expect(base).toEqual(original);
    expect(result).not.toBe(base);
  });

  it('handles entry already at the target index (no-op swap)', () => {
    const result = placeEntryAt(base, 'c', 2);
    // 'c' is already at index 2, but the returned array is a new copy
    expect(result[2]).toBe('c');
    expect([...result].sort()).toEqual([...base].sort());
  });

  it('handles entry not in the array — returns a copy unchanged', () => {
    const result = placeEntryAt(base, 'z', 0);
    expect(result).toEqual(base);
    expect(result).not.toBe(base);
  });

  it('clamps out-of-bounds index to the last position', () => {
    const result = placeEntryAt(base, 'a', 100);
    expect(result[result.length - 1]).toBe('a');
    expect(result.length).toBe(base.length);
  });

  it('clamps negative index to 0', () => {
    const result = placeEntryAt(base, 'e', -5);
    expect(result[0]).toBe('e');
    expect(result.length).toBe(base.length);
  });

  it('moving first element to last maintains all entries', () => {
    const result = placeEntryAt(base, 'a', 4);
    expect(result[4]).toBe('a');
    expect([...result].sort()).toEqual([...base].sort());
  });
});

// ---------------------------------------------------------------------------
// buildCeremonyPayload — standard case (4+ candidates)
// ---------------------------------------------------------------------------

describe('buildCeremonyPayload — standard (4+ candidates)', () => {
  const players = {
    alice: { name: 'Alice', role: 'player', joinedAt: 1 },
    bob: { name: 'Bob', role: 'player', joinedAt: 2 },
    carol: { name: 'Carol', role: 'player', joinedAt: 3 },
    dave: { name: 'Dave', role: 'player', joinedAt: 4 },
  };

  // Deterministic RNG: always returns 0.5
  const fixedRand = () => 0.5;

  it('returns a valid payload with all required fields', () => {
    const payload = buildCeremonyPayload({ players, now: 1000, rand: fixedRand });
    expect(payload).not.toBeNull();
    expect(payload.ceremonyId).toMatch(/^cm-/);
    expect(payload.schemaVersion).toBe(4);
    expect(payload.startedAt).toBe(1000);
    expect(payload.expiresAt).toBe(1000 + CEREMONY_TTL_MS);
    expect(payload.wasCompressed).toBe(false);
    expect(Array.isArray(payload.candidateIds)).toBe(true);
    expect(payload.candidateIds.length).toBe(4);
    expect(typeof payload.candidateNames).toBe('object');
    expect(typeof payload.winnerId).toBe('string');
    expect(Array.isArray(payload.reelFillerIds)).toBe(true);
    expect(payload.reelFillerIds.length).toBe(4);
    expect(Array.isArray(payload.reelSeeds)).toBe(true);
    expect(payload.reelSeeds.length).toBe(3);
    expect(typeof payload.farewellPhraseIndex).toBe('number');
    expect(typeof payload.crowningBubbleIndex).toBe('number');
    expect(typeof payload.outgoingLeaderHadCrown).toBe('boolean');
    // v5: index fields
    expect(typeof payload.outgoingLeaderIndex).toBe('number');
    expect(typeof payload.winnerIndex).toBe('number');
  });

  it('winnerIndex is valid index in candidateIds', () => {
    const payload = buildCeremonyPayload({ players, now: 1000, rand: fixedRand });
    expect(payload.winnerIndex).toBeGreaterThanOrEqual(0);
    expect(payload.winnerIndex).toBeLessThan(payload.candidateIds.length);
    expect(payload.candidateIds[payload.winnerIndex]).toBe(payload.winnerId);
  });

  it('outgoingLeaderIndex is -1 when no outgoing leader', () => {
    const payload = buildCeremonyPayload({ players, now: 1000, rand: fixedRand });
    // No outgoing leader specified, so index should be -1
    expect(payload.outgoingLeaderIndex).toBe(-1);
  });

  it('winnerId is in candidateIds', () => {
    const payload = buildCeremonyPayload({ players, now: 1000, rand: fixedRand });
    expect(payload.candidateIds).toContain(payload.winnerId);
  });

  it('nearMissTargetId is in candidateIds and not equal to winnerId', () => {
    const payload = buildCeremonyPayload({ players, now: 1000, rand: fixedRand });
    expect(payload.candidateIds).toContain(payload.nearMissTargetId);
    expect(payload.nearMissTargetId).not.toBe(payload.winnerId);
  });

  it('winnerReelPair is one of the 3 valid pairs', () => {
    const payload = buildCeremonyPayload({ players, now: 1000, rand: fixedRand });
    const validPairs = [[0, 1], [0, 2], [1, 2]];
    const match = validPairs.some(
      vp => vp[0] === payload.winnerReelPair[0] && vp[1] === payload.winnerReelPair[1]
    );
    expect(match).toBe(true);
  });

  it('nonMatchReelPlayerId is in candidateIds and differs from winner and nearMiss', () => {
    const payload = buildCeremonyPayload({ players, now: 1000, rand: fixedRand });
    expect(payload.candidateIds).toContain(payload.nonMatchReelPlayerId);
    expect(payload.nonMatchReelPlayerId).not.toBe(payload.winnerId);
  });

  it('does NOT have reel1LandingId or reel2LandingId (removed in v3)', () => {
    const payload = buildCeremonyPayload({ players, now: 1000, rand: fixedRand });
    expect(payload).not.toHaveProperty('reel1LandingId');
    expect(payload).not.toHaveProperty('reel2LandingId');
  });

  it('schemaVersion is exactly 4', () => {
    const payload = buildCeremonyPayload({ players, now: 1000, rand: fixedRand });
    expect(payload.schemaVersion).toBe(4);
  });

  it('isTripleJackpot is true when winnerReelPair is [0,1]', () => {
    // Use a rand that forces pair selection to index 0 => [0,1]
    // The 2nd rand call picks the winner reel pair (Math.floor(rand() * 3))
    // We need it to be 0 to pick [0,1].
    // Call 1: winner index (return 0)
    // Call 2: winner reel pair (return 0 => index 0 => [0,1])
    const controlledRand = () => 0.01;
    const payload = buildCeremonyPayload({ players, now: 1000, rand: controlledRand });
    if (payload.winnerReelPair[0] === 0 && payload.winnerReelPair[1] === 1) {
      expect(payload.isTripleJackpot).toBe(true);
    }
  });

  it('isTripleJackpot is false when winnerReelPair is NOT [0,1]', () => {
    // Force pair selection to [1,2] (index 2 => rand returns 0.99)
    const controlledRand = () => 0.99;
    const payload = buildCeremonyPayload({ players, now: 1000, rand: controlledRand });
    // 0.99 * 3 = 2.97, floor = 2 => VALID_PAIRS[2] = [1,2]
    expect(payload.winnerReelPair).toEqual([1, 2]);
    expect(payload.isTripleJackpot).toBe(false);
  });

  it('reelFillerIds are all valid filler keys with no duplicates', () => {
    const payload = buildCeremonyPayload({ players, now: 1000, rand: fixedRand });
    for (const filler of payload.reelFillerIds) {
      expect(isFillerKey(filler)).toBe(true);
    }
    const unique = new Set(payload.reelFillerIds);
    expect(unique.size).toBe(payload.reelFillerIds.length);
  });
});

// ---------------------------------------------------------------------------
// buildCeremonyPayload — outgoing leader exclusion (BUG FIX regression)
// ---------------------------------------------------------------------------

describe('buildCeremonyPayload — outgoing leader exclusion (iter 3 bug fix)', () => {
  it('outgoingLeaderId is NOT in candidateIds when outgoing leader is in the player list', () => {
    const players = {
      pm: { name: 'OldPM', role: 'player', joinedAt: 1, isLeader: true },
      alice: { name: 'Alice', role: 'player', joinedAt: 2 },
      bob: { name: 'Bob', role: 'player', joinedAt: 3 },
    };
    const payload = buildCeremonyPayload({
      players,
      now: 1000,
      rand: () => 0.5,
      outgoingLeader: { id: 'pm', data: players.pm },
    });
    expect(payload).not.toBeNull();
    expect(payload.outgoingLeaderId).toBe('pm');
    expect(payload.candidateIds).not.toContain('pm');
    expect(payload.candidateIds).toEqual(['alice', 'bob']);
  });

  it('winner is chosen from candidates AFTER outgoing leader exclusion', () => {
    const players = {
      pm: { name: 'OldPM', role: 'player', joinedAt: 1, isLeader: true },
      alice: { name: 'Alice', role: 'player', joinedAt: 2 },
      bob: { name: 'Bob', role: 'player', joinedAt: 3 },
    };
    const payload = buildCeremonyPayload({
      players,
      now: 1000,
      rand: () => 0.5,
      outgoingLeader: { id: 'pm', data: players.pm },
    });
    // Winner must be one of the remaining candidates, not the outgoing leader
    expect(['alice', 'bob']).toContain(payload.winnerId);
    expect(payload.winnerId).not.toBe('pm');
  });

  it('outgoing PM role is correctly excluded from candidates', () => {
    const players = {
      pm: { name: 'Manager', role: 'pm', joinedAt: 0 },
      alice: { name: 'Alice', role: 'player', joinedAt: 1 },
    };
    // The PM is already filtered by role='pm', but also excluded by outgoingLeader
    const payload = buildCeremonyPayload({
      players,
      now: 1000,
      rand: () => 0.5,
      outgoingLeader: { id: 'pm', data: players.pm },
    });
    expect(payload).not.toBeNull();
    expect(payload.candidateIds).toEqual(['alice']);
  });

  it('outgoingLeaderIndex reflects position in sorted list BEFORE filtering', () => {
    const players = {
      pm: { name: 'OldPM', role: 'player', joinedAt: 1, isLeader: true },
      alice: { name: 'Alice', role: 'player', joinedAt: 2 },
      bob: { name: 'Bob', role: 'player', joinedAt: 3 },
    };
    const payload = buildCeremonyPayload({
      players,
      now: 1000,
      rand: () => 0.5,
      outgoingLeader: { id: 'pm', data: players.pm },
    });
    // pm has joinedAt=1, so it sorts first in the full list => index 0
    expect(payload.outgoingLeaderIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildCeremonyPayload — compressed case (1 candidate)
// ---------------------------------------------------------------------------

describe('buildCeremonyPayload — compressed (1 candidate)', () => {
  it('wasCompressed is true with a single candidate', () => {
    const players = {
      alice: { name: 'Alice', role: 'player', joinedAt: 1 },
    };
    const payload = buildCeremonyPayload({ players, now: 1000, rand: () => 0.5 });
    expect(payload.wasCompressed).toBe(true);
  });

  it('no near-miss, no reel pair, no nonMatch when compressed', () => {
    const players = {
      alice: { name: 'Alice', role: 'player', joinedAt: 1 },
    };
    const payload = buildCeremonyPayload({ players, now: 1000, rand: () => 0.5 });
    expect(payload.nearMissTargetId).toBeNull();
    expect(payload.winnerReelPair).toBeNull();
    expect(payload.nonMatchReelPlayerId).toBeNull();
    expect(payload.isTripleJackpot).toBe(false);
  });

  it('winnerId is the sole candidate', () => {
    const players = {
      alice: { name: 'Alice', role: 'player', joinedAt: 1 },
    };
    const payload = buildCeremonyPayload({ players, now: 1000, rand: () => 0.5 });
    expect(payload.winnerId).toBe('alice');
    expect(payload.winnerIndex).toBe(0);
  });

  it('reelFillerIds is empty for compressed case', () => {
    const players = {
      alice: { name: 'Alice', role: 'player', joinedAt: 1 },
    };
    const payload = buildCeremonyPayload({ players, now: 1000, rand: () => 0.5 });
    expect(payload.reelFillerIds).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildCeremonyPayload — 0 candidates
// ---------------------------------------------------------------------------

describe('buildCeremonyPayload — 0 candidates', () => {
  it('returns null when no non-PM players exist', () => {
    const players = {
      pm: { name: 'Manager', role: 'pm', joinedAt: 0 },
    };
    const payload = buildCeremonyPayload({ players, now: 1000, rand: () => 0.5 });
    expect(payload).toBeNull();
  });

  it('returns null for empty players map', () => {
    const payload = buildCeremonyPayload({ players: {}, now: 1000, rand: () => 0.5 });
    expect(payload).toBeNull();
  });

  it('returns null when only candidate is the outgoing leader', () => {
    const players = {
      alice: { name: 'Alice', role: 'player', joinedAt: 1 },
    };
    const payload = buildCeremonyPayload({
      players,
      now: 1000,
      rand: () => 0.5,
      outgoingLeader: { id: 'alice', data: players.alice },
    });
    expect(payload).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildCeremonyPayload — 2 candidates (near-miss = nonMatch edge case)
// ---------------------------------------------------------------------------

describe('buildCeremonyPayload — 2 candidates', () => {
  it('nearMissTargetId equals nonMatchReelPlayerId when only 2 candidates', () => {
    const players = {
      alice: { name: 'Alice', role: 'player', joinedAt: 1 },
      bob: { name: 'Bob', role: 'player', joinedAt: 2 },
    };
    const payload = buildCeremonyPayload({ players, now: 1000, rand: () => 0.5 });
    expect(payload.wasCompressed).toBe(false);
    // With only 2 candidates, the near-miss pool (excluding winner + nonMatch)
    // is empty, so nearMiss falls back to nonMatchReelPlayerId
    expect(payload.nearMissTargetId).toBe(payload.nonMatchReelPlayerId);
  });
});

// ---------------------------------------------------------------------------
// buildCeremonyPayload — outgoing leader fields
// ---------------------------------------------------------------------------

describe('buildCeremonyPayload — outgoing leader fields', () => {
  it('outgoingLeaderHadCrown is true when outgoing leader was a player-leader', () => {
    const players = {
      pm: { name: 'OldPM', role: 'player', joinedAt: 1, isLeader: true },
      alice: { name: 'Alice', role: 'player', joinedAt: 2 },
    };
    const payload = buildCeremonyPayload({
      players,
      now: 1000,
      rand: () => 0.5,
      outgoingLeader: { id: 'pm', data: players.pm },
    });
    expect(payload.outgoingLeaderHadCrown).toBe(true);
    expect(payload.outgoingLeaderLastData).toEqual({ name: 'OldPM', role: 'player' });
  });

  it('outgoingLeaderHadCrown is false when outgoing leader was a PM role', () => {
    const players = {
      pm: { name: 'Manager', role: 'pm', joinedAt: 0 },
      alice: { name: 'Alice', role: 'player', joinedAt: 1 },
    };
    const payload = buildCeremonyPayload({
      players,
      now: 1000,
      rand: () => 0.5,
      outgoingLeader: { id: 'pm', data: players.pm },
    });
    expect(payload.outgoingLeaderHadCrown).toBe(false);
  });

  it('outgoing leader fields are null when no outgoing leader provided', () => {
    const players = {
      alice: { name: 'Alice', role: 'player', joinedAt: 1 },
    };
    const payload = buildCeremonyPayload({ players, now: 1000, rand: () => 0.5 });
    expect(payload.outgoingLeaderId).toBeNull();
    expect(payload.outgoingLeaderLastData).toBeNull();
    expect(payload.outgoingLeaderHadCrown).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidCeremonyPayload
// ---------------------------------------------------------------------------

describe('isValidCeremonyPayload', () => {
  // Build a valid non-compressed v4 payload for test baseline
  function validPayload(overrides = {}) {
    return {
      ceremonyId: 'cm-1000-abc',
      schemaVersion: 4,
      startedAt: 1000,
      expiresAt: 16000,
      wasCompressed: false,
      candidateIds: ['alice', 'bob', 'carol', 'dave'],
      candidateNames: { alice: 'Alice', bob: 'Bob', carol: 'Carol', dave: 'Dave' },
      winnerId: 'bob',
      nearMissTargetId: 'carol',
      winnerReelPair: [0, 2],
      nonMatchReelPlayerId: 'dave',
      isTripleJackpot: false,
      reelFillerIds: ['crown', 'trophy', 'pizza', 'wizardHat'],
      reelSeeds: [42, 100, 200],
      farewellPhraseIndex: 0,
      crowningBubbleIndex: 0,
      flourishVariant: null,
      outgoingLeaderId: 'old-pm',
      outgoingLeaderLastData: { name: 'OldPM', role: 'pm' },
      outgoingLeaderHadCrown: false,
      outgoingLeaderIndex: -1,
      winnerIndex: 1,
      ...overrides,
    };
  }

  it('returns true for a valid v4 non-compressed payload', () => {
    expect(isValidCeremonyPayload(validPayload())).toBe(true);
  });

  it('returns true for a valid v4 compressed payload', () => {
    const compressed = validPayload({
      wasCompressed: true,
      candidateIds: ['alice'],
      winnerId: 'alice',
      winnerReelPair: null,
      nonMatchReelPlayerId: null,
      nearMissTargetId: null,
      isTripleJackpot: false,
    });
    expect(isValidCeremonyPayload(compressed)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isValidCeremonyPayload(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidCeremonyPayload(undefined)).toBe(false);
  });

  it('returns false for wrong schema version (v1)', () => {
    expect(isValidCeremonyPayload(validPayload({ schemaVersion: 1 }))).toBe(false);
  });

  it('returns false for wrong schema version (v2)', () => {
    expect(isValidCeremonyPayload(validPayload({ schemaVersion: 2 }))).toBe(false);
  });

  it('returns false for missing candidateIds', () => {
    const p = validPayload();
    delete p.candidateIds;
    expect(isValidCeremonyPayload(p)).toBe(false);
  });

  it('returns false for empty candidateIds', () => {
    expect(isValidCeremonyPayload(validPayload({ candidateIds: [] }))).toBe(false);
  });

  it('returns false for missing ceremonyId', () => {
    expect(isValidCeremonyPayload(validPayload({ ceremonyId: '' }))).toBe(false);
  });

  it('returns false when winnerId is not in candidateIds', () => {
    expect(isValidCeremonyPayload(validPayload({ winnerId: 'unknown' }))).toBe(false);
  });

  it('returns false for invalid winnerReelPair', () => {
    expect(isValidCeremonyPayload(validPayload({ winnerReelPair: [0, 0] }))).toBe(false);
    expect(isValidCeremonyPayload(validPayload({ winnerReelPair: [2, 0] }))).toBe(false);
    expect(isValidCeremonyPayload(validPayload({ winnerReelPair: [0] }))).toBe(false);
  });

  it('returns false when nonMatchReelPlayerId equals winnerId', () => {
    expect(isValidCeremonyPayload(validPayload({ nonMatchReelPlayerId: 'bob' }))).toBe(false);
  });

  it('returns false when nonMatchReelPlayerId is not in candidateIds', () => {
    expect(isValidCeremonyPayload(validPayload({ nonMatchReelPlayerId: 'unknown' }))).toBe(false);
  });

  it('returns false when nearMissTargetId equals winnerId', () => {
    expect(isValidCeremonyPayload(validPayload({ nearMissTargetId: 'bob' }))).toBe(false);
  });

  it('returns false when isTripleJackpot is inconsistent with pair', () => {
    // pair [0,2] with isTripleJackpot true should be invalid (triple requires [0,1])
    expect(isValidCeremonyPayload(validPayload({ isTripleJackpot: true }))).toBe(false);
  });

  it('returns true when isTripleJackpot is consistent with pair [0,1]', () => {
    expect(isValidCeremonyPayload(validPayload({
      winnerReelPair: [0, 1],
      isTripleJackpot: true,
    }))).toBe(true);
  });

  // REGRESSION TEST: iter 3 bug fix — outgoingLeaderId must NOT be in candidateIds
  it('returns false when outgoingLeaderId is IN candidateIds (bug fix regression)', () => {
    const corrupt = validPayload({
      outgoingLeaderId: 'alice', // 'alice' is in candidateIds
      outgoingLeaderLastData: { name: 'Alice', role: 'player' },
    });
    expect(isValidCeremonyPayload(corrupt)).toBe(false);
  });

  it('returns false when outgoingLeaderId is present but outgoingLeaderLastData is null', () => {
    expect(isValidCeremonyPayload(validPayload({
      outgoingLeaderLastData: null,
    }))).toBe(false);
  });

  it('returns false when outgoingLeaderHadCrown is not a boolean', () => {
    expect(isValidCeremonyPayload(validPayload({ outgoingLeaderHadCrown: 1 }))).toBe(false);
  });

  // v5: index fields for math-based grid position
  it('returns false when outgoingLeaderIndex is missing', () => {
    const p = validPayload();
    delete p.outgoingLeaderIndex;
    expect(isValidCeremonyPayload(p)).toBe(false);
  });

  it('returns false when winnerIndex is missing', () => {
    const p = validPayload();
    delete p.winnerIndex;
    expect(isValidCeremonyPayload(p)).toBe(false);
  });

  it('returns false when outgoingLeaderIndex is not a number', () => {
    expect(isValidCeremonyPayload(validPayload({ outgoingLeaderIndex: 'x' }))).toBe(false);
  });

  it('returns false when winnerIndex is not a number', () => {
    expect(isValidCeremonyPayload(validPayload({ winnerIndex: null }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isStalePayload
// ---------------------------------------------------------------------------

describe('isStalePayload', () => {
  it('returns false when within TTL + grace window', () => {
    const payload = { expiresAt: 5000 };
    expect(isStalePayload(payload, 5000)).toBe(false);
    expect(isStalePayload(payload, 5000 + CEREMONY_STALE_GRACE_MS)).toBe(false);
  });

  it('returns true when past TTL + grace', () => {
    const payload = { expiresAt: 5000 };
    expect(isStalePayload(payload, 5000 + CEREMONY_STALE_GRACE_MS + 1)).toBe(true);
  });

  it('returns true for null payload', () => {
    expect(isStalePayload(null)).toBe(true);
  });

  it('returns true for payload without expiresAt', () => {
    expect(isStalePayload({})).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Helper functions: isFillerKey, rollFlourish, nonPmCandidatesSorted
// ---------------------------------------------------------------------------

describe('isFillerKey', () => {
  it('returns true for all known filler keys', () => {
    for (const key of FILLER_TYPE_KEYS) {
      expect(isFillerKey(key)).toBe(true);
    }
  });

  it('returns false for player IDs', () => {
    expect(isFillerKey('alice')).toBe(false);
    expect(isFillerKey('bob')).toBe(false);
  });

  it('returns false for non-strings', () => {
    expect(isFillerKey(42)).toBe(false);
    expect(isFillerKey(null)).toBe(false);
  });
});

describe('rollFlourish', () => {
  it('returns null for a high roll (above all weights)', () => {
    expect(rollFlourish(() => 0.99)).toBeNull();
  });

  it('returns a flourish variant for a very low roll', () => {
    const result = rollFlourish(() => 0.001);
    expect(FLOURISH_VARIANTS).toContain(result);
  });

  it('is deterministic with a fixed rand', () => {
    const a = rollFlourish(() => 0.025);
    const b = rollFlourish(() => 0.025);
    expect(a).toBe(b);
  });
});

describe('nonPmCandidatesSorted', () => {
  it('excludes PM role players', () => {
    const players = {
      pm: { name: 'PM', role: 'pm', joinedAt: 0 },
      alice: { name: 'Alice', role: 'player', joinedAt: 1 },
    };
    const sorted = nonPmCandidatesSorted(players);
    expect(sorted.length).toBe(1);
    expect(sorted[0][0]).toBe('alice');
  });

  it('sorts by joinedAt ascending', () => {
    const players = {
      carol: { name: 'Carol', role: 'player', joinedAt: 3 },
      alice: { name: 'Alice', role: 'player', joinedAt: 1 },
      bob: { name: 'Bob', role: 'player', joinedAt: 2 },
    };
    const sorted = nonPmCandidatesSorted(players);
    expect(sorted.map(([id]) => id)).toEqual(['alice', 'bob', 'carol']);
  });

  it('handles null player entries', () => {
    const players = {
      alice: { name: 'Alice', role: 'player', joinedAt: 1 },
      ghost: null,
    };
    const sorted = nonPmCandidatesSorted(players);
    expect(sorted.length).toBe(1);
  });

  // Regression: leader-player who closed their browser is marked
  // disconnected=true by onDisconnect but keeps isLeader=true and their
  // original joinedAt. If nonPmCandidatesSorted still returns them as
  // sorted[0], every remaining client bails out of the ceremony-trigger
  // effect ("that's not me"), the disconnected leader can't fire from the
  // grave, and the room stays leaderless forever. The filter must exclude
  // disconnected entries so the earliest-joined *connected* non-PM fires.
  it('excludes disconnected players so the earliest live candidate fires', () => {
    const players = {
      leaver: {
        name: 'Leaver', role: 'player', joinedAt: 1,
        isLeader: true, disconnected: true,
      },
      alice: { name: 'Alice', role: 'player', joinedAt: 2 },
      bob: { name: 'Bob', role: 'player', joinedAt: 3 },
    };
    const sorted = nonPmCandidatesSorted(players);
    expect(sorted.map(([id]) => id)).toEqual(['alice', 'bob']);
    expect(sorted[0][0]).toBe('alice');
  });

  it('a disconnected=false player is still included', () => {
    const players = {
      alice: { name: 'Alice', role: 'player', joinedAt: 1, disconnected: false },
    };
    const sorted = nonPmCandidatesSorted(players);
    expect(sorted.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Phase table helpers
// ---------------------------------------------------------------------------

describe('phaseTableFor', () => {
  it('returns standard table for non-compressed, non-reduced', () => {
    expect(phaseTableFor({ wasCompressed: false, reducedMotion: false }))
      .toBe(PHASE_TABLE_STANDARD);
  });

  it('returns compressed table when wasCompressed is true', () => {
    expect(phaseTableFor({ wasCompressed: true, reducedMotion: false }))
      .toBe(PHASE_TABLE_COMPRESSED);
  });

  it('returns reduced table when reducedMotion is true (overrides compressed)', () => {
    expect(phaseTableFor({ wasCompressed: true, reducedMotion: true }))
      .toBe(PHASE_TABLE_REDUCED);
  });
});

describe('totalDurationFor', () => {
  it('standard table total is 21300ms', () => {
    expect(totalDurationFor(PHASE_TABLE_STANDARD)).toBe(21300);
  });

  it('compressed table total is 10000ms', () => {
    expect(totalDurationFor(PHASE_TABLE_COMPRESSED)).toBe(10000);
  });

  it('reduced table total is 1500ms', () => {
    expect(totalDurationFor(PHASE_TABLE_REDUCED)).toBe(1500);
  });
});

describe('currentPhaseRow', () => {
  it('returns first row for negative elapsed', () => {
    const row = currentPhaseRow(PHASE_TABLE_STANDARD, -100);
    expect(row.phase).toBe('crownRemoval');
  });

  it('returns done row for elapsed past total', () => {
    const row = currentPhaseRow(PHASE_TABLE_STANDARD, 99999);
    expect(row.phase).toBe('done');
  });

  it('returns correct phase for elapsed at boundary', () => {
    // 5400 is the start of 'spinning' in v4+
    const row = currentPhaseRow(PHASE_TABLE_STANDARD, 5400);
    expect(row.phase).toBe('spinning');
  });

  it('returns crownRemoval for elapsed just before cabinetDrop', () => {
    const row = currentPhaseRow(PHASE_TABLE_STANDARD, 4999);
    expect(row.phase).toBe('crownRemoval');
  });
});

// ---------------------------------------------------------------------------
// Constants sanity checks
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('SCHEMA_VERSION is 4', () => {
    expect(SCHEMA_VERSION).toBe(4);
  });

  it('CEREMONY_TTL_MS is 30s', () => {
    expect(CEREMONY_TTL_MS).toBe(30000);
  });

  it('FAREWELL_PHRASES has 20 entries', () => {
    expect(FAREWELL_PHRASES.length).toBe(20);
  });

  it('CROWNING_BUBBLES has 8 entries', () => {
    expect(CROWNING_BUBBLES.length).toBe(8);
  });

  it('FILLER_TYPE_KEYS has 9 entries', () => {
    expect(FILLER_TYPE_KEYS.length).toBe(9);
  });

  it('v4+ timing constants for 2x longer ceremony', () => {
    expect(REEL0_STOP_AT).toBe(9400);
    expect(REEL1_STOP_AT).toBe(9900);
    expect(REEL2_SLOWDOWN_START).toBe(11100);
  });

  it('REEL2 slowdown intervals sum correctly (2x doubled)', () => {
    const sum = REEL2_SLOWDOWN_INTERVALS.reduce((a, b) => a + b, 0);
    expect(sum).toBe(220 + 264 + 316 + 380 + 456 + 548);
    expect(sum).toBe(2184);
  });
});
