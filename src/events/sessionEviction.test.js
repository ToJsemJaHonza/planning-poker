import { describe, expect, it } from 'vitest';
import { claimSession, EVICTION_DURATION } from './sessionEviction';

const room = () => ({ meta: { phase: 'voting' }, players: {
  old: { name: 'Alice', role: 'player', deviceId: 'device', joinedAt: 10,
    vote: '13', voteFe: '?', voteBe: '☕', isLeader: true, disconnected: false },
} });
const claim = (current, extra = {}) => claimSession(current, {
  playerId: 'new', playerName: 'Alice', role: 'player', deviceId: 'device',
  now: 10000, quote: 'VEN!', ...extra,
});

describe('atomic session claim', () => {
  it('preserves all selected cards, role, leadership and join order from the live record', () => {
    expect(claim(room()).players.new).toMatchObject({
      vote: '13', voteFe: '?', voteBe: '☕', joinedAt: 10, role: 'player', isLeader: true,
    });
  });
  it('waits for existing cinematics, remaps the holdout and prevents two live leaders', () => {
    const original = room();
    original.meta.syncedEvent = { type: 'train', expiresAt: 12000 };
    original.meta.pmRoulette = { winnerId: 'old', expiresAt: 15000 };
    original.meta.shameTimer = { holdoutId: 'old', startedAt: 4000 };
    const next = claim(original);
    expect(next.meta.sessionEvictions.old).toMatchObject({ startedAt: 15000, expiresAt: 15000 + EVICTION_DURATION });
    expect(next.meta.pmRoulette.winnerId).toBe('new');
    expect(next.meta.shameTimer).toEqual({ holdoutId: 'new', startedAt: 4000 });
    expect(next.players.old).toMatchObject({ replacedBy: 'new', isLeader: false, disconnected: true });
    expect(original.players.old.disconnected).toBe(false);
  });
  it('takes the current round state, including cleared and partial votes', () => {
    const current = room();
    current.players.old.vote = null;
    delete current.players.old.voteBe;
    const next = claim(current);
    expect(next.players.new.vote).toBeNull();
    expect(next.players.new.voteFe).toBe('?');
    expect(next.players.new.voteBe).toBeUndefined();
  });
  it('never revives a replaced document, even if storage protection is unavailable', () => {
    const next = claim(room());
    expect(claim(next, { playerId: 'old' })).toBeUndefined();
    expect(claim(next, { playerId: 'reload', previousPlayerId: 'old' })).toBeUndefined();
  });

  it('an already registered reload is idempotent when its mount effect runs again', () => {
    const next = claim(room(), { previousPlayerId: 'old' });
    expect(claim(next, { previousPlayerId: 'old' }).players.new.vote).toBe('13');
  });
});
