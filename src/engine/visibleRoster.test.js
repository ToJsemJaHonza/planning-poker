import { describe, it, expect } from 'vitest';
import { buildVisibleRoster } from './visibleRoster';

describe('buildVisibleRoster', () => {
  it('returns non-PM players sorted by joinedAt', () => {
    const players = {
      p2: { name: 'Cara', role: 'player', joinedAt: 3000 },
      p0: { name: 'Alice', role: 'player', joinedAt: 1000, isLeader: true },
      pPM: { name: 'Michael', role: 'pm', joinedAt: 500 },
      p1: { name: 'Bob', role: 'player', joinedAt: 2000 },
    };
    const ids = buildVisibleRoster(players, null).map(([id]) => id);
    expect(ids).toEqual(['p0', 'p1', 'p2']);
  });

  it('keeps a still-isLeader player even if disconnected (grace window)', () => {
    const players = {
      p0: { name: 'Alice', role: 'player', joinedAt: 1000, isLeader: true, disconnected: true },
      p1: { name: 'Bob', role: 'player', joinedAt: 2000 },
    };
    const ids = buildVisibleRoster(players, null).map(([id]) => id);
    expect(ids).toEqual(['p0', 'p1']);
  });

  it('drops disconnected players once isLeader has been flipped off', () => {
    const players = {
      p0: { name: 'Alice', role: 'player', joinedAt: 1000, isLeader: false, disconnected: true },
      p1: { name: 'Bob', role: 'player', joinedAt: 2000 },
    };
    const ids = buildVisibleRoster(players, null).map(([id]) => id);
    expect(ids).toEqual(['p1']);
  });

  it('injects the outgoing leader from pmRoulette at their joinedAt slot', () => {
    // Alice (joinedAt 1000) was leader, got her isLeader flipped off mid-
    // ceremony. Without injection she'd vanish from the roster and her
    // name tag would slide onto Bob's figure.
    const players = {
      p0: { name: 'Alice', role: 'player', joinedAt: 1000, isLeader: false, disconnected: true },
      p1: { name: 'Bob', role: 'player', joinedAt: 2000 },
      p2: { name: 'Cara', role: 'player', joinedAt: 3000 },
    };
    const pmRoulette = {
      outgoingLeaderId: 'p0',
      outgoingLeaderLastData: { name: 'Alice', role: 'player' },
      startedAt: Date.now(),
      ceremonyId: 'c1',
    };
    const entries = buildVisibleRoster(players, pmRoulette);
    const ids = entries.map(([id]) => id);
    expect(ids).toEqual(['p0', 'p1', 'p2']); // joinedAt 1000 goes first
    const alice = entries.find(([id]) => id === 'p0')[1];
    expect(alice.isLeader).toBe(true); // keep 👑 on nameplate during ceremony
  });

  it('does not double-inject when the outgoing leader is already present', () => {
    const players = {
      p0: { name: 'Alice', role: 'player', joinedAt: 1000, isLeader: true, disconnected: true },
      p1: { name: 'Bob', role: 'player', joinedAt: 2000 },
    };
    const pmRoulette = {
      outgoingLeaderId: 'p0',
      outgoingLeaderLastData: { name: 'Alice', role: 'player' },
      startedAt: Date.now(),
      ceremonyId: 'c1',
    };
    const entries = buildVisibleRoster(players, pmRoulette);
    expect(entries).toHaveLength(2);
    expect(entries.map(([id]) => id)).toEqual(['p0', 'p1']);
  });

  it('appends injected outgoing leader to end when no joinedAt is known', () => {
    // Full record gone from players map — we fall back to end-of-list.
    const players = {
      p1: { name: 'Bob', role: 'player', joinedAt: 2000 },
      p2: { name: 'Cara', role: 'player', joinedAt: 3000 },
    };
    const pmRoulette = {
      outgoingLeaderId: 'p0',
      outgoingLeaderLastData: { name: 'Alice', role: 'player' },
      startedAt: Date.now(),
      ceremonyId: 'c1',
    };
    const ids = buildVisibleRoster(players, pmRoulette).map(([id]) => id);
    expect(ids).toEqual(['p1', 'p2', 'p0']);
  });
});
