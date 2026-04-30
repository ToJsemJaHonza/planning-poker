import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import RevealBackground from './RevealBackground';

describe('RevealBackground — smoke', () => {
  const players = {
    Alice: { name: 'Alice', vote: '5', voteFe: null, voteBe: null, joinedAt: 1, role: 'player', isLeader: false },
    Bob:   { name: 'Bob',   vote: '5', voteFe: null, voteBe: null, joinedAt: 2, role: 'player', isLeader: false },
  };

  it('mounts without throwing in normal mode', () => {
    expect(() => render(<RevealBackground players={players} splitMode={false} />)).not.toThrow();
  });

  it('mounts without throwing in split mode', () => {
    const splitPlayers = {
      Alice: { name: 'Alice', vote: null, voteFe: '3', voteBe: '8', joinedAt: 1, role: 'player', isLeader: false },
      Bob:   { name: 'Bob',   vote: null, voteFe: '3', voteBe: '8', joinedAt: 2, role: 'player', isLeader: false },
    };
    expect(() => render(<RevealBackground players={splitPlayers} splitMode={true} />)).not.toThrow();
  });

  it('unmounts cleanly', () => {
    const { unmount } = render(<RevealBackground players={players} splitMode={false} />);
    expect(() => unmount()).not.toThrow();
  });

  it('handles empty players object', () => {
    expect(() => render(<RevealBackground players={{}} splitMode={false} />)).not.toThrow();
  });
});

// --- Display-card regression: background must show the average rounded to
// the nearest deck card, not the arbitrary first-iteration vote the old
// `getConsensus` fallback returned. These tests reproduce the exact
// screenshot the user reported (FE: 2 and 5; BE: 2 and 13) and would have
// failed with the old implementation. ---------------------------------
describe('RevealBackground — card rounding (reveal screenshot bug)', () => {
  const read = (container) =>
    Array.from(container.querySelectorAll('.reveal-number')).map((el) => el.textContent);

  it('split: FE avg 3.5 (2+5) renders as 3, BE avg 7.5 (2+13) renders as 8', () => {
    const players = {
      Alice: { name: 'Alice', vote: null, voteFe: '2', voteBe: '2',  joinedAt: 1, role: 'player', isLeader: false },
      Bob:   { name: 'Bob',   vote: null, voteFe: '5', voteBe: '13', joinedAt: 2, role: 'player', isLeader: false },
    };
    const { container } = render(<RevealBackground players={players} splitMode={true} />);
    const texts = read(container);

    // FE items (even indices in the generator) should all say "3".
    // BE items (odd indices) should all say "8".
    expect(texts).toContain('3');
    expect(texts).toContain('8');
    // And never leak the raw individual votes.
    expect(texts).not.toContain('2');
    expect(texts).not.toContain('5');
    expect(texts).not.toContain('13');
  });

  it('normal: avg rounds to nearest card and ignores ?/☕', () => {
    const players = {
      Alice: { name: 'Alice', vote: '5',  voteFe: null, voteBe: null, joinedAt: 1, role: 'player', isLeader: false },
      Bob:   { name: 'Bob',   vote: '8',  voteFe: null, voteBe: null, joinedAt: 2, role: 'player', isLeader: false },
      Cara:  { name: 'Cara',  vote: '☕', voteFe: null, voteBe: null, joinedAt: 3, role: 'player', isLeader: false },
      Dan:   { name: 'Dan',   vote: '?',  voteFe: null, voteBe: null, joinedAt: 4, role: 'player', isLeader: false },
    };
    const { container } = render(<RevealBackground players={players} splitMode={false} />);
    const texts = read(container);
    // (5+8)/2 = 6.5 → tie between 5 and 8 → round UP to 8.
    expect(new Set(texts)).toEqual(new Set(['8']));
  });

  it('normal: exact card avg renders that card', () => {
    const players = {
      A: { name: 'A', vote: '3', voteFe: null, voteBe: null, joinedAt: 1, role: 'player', isLeader: false },
      B: { name: 'B', vote: '3', voteFe: null, voteBe: null, joinedAt: 2, role: 'player', isLeader: false },
    };
    const { container } = render(<RevealBackground players={players} splitMode={false} />);
    expect(new Set(read(container))).toEqual(new Set(['3']));
  });

  // Regression: getDisplayCard used Number(p?.[field]) and filtered with
  // Number.isNaN — but Number(null) === 0 (not NaN), so a player who
  // joined the round but hasn't voted yet was counted as a literal 0,
  // dragging the displayed background card toward zero. ResultModal
  // didn't have this bug because it pre-filters `p.vote != null` before
  // calling computeStats, so the modal showed one number while the
  // background showed a different (lower) one.
  it('normal: ignores players who have not voted (vote: null)', () => {
    const players = {
      Alice: { name: 'Alice', vote: '13', voteFe: null, voteBe: null, joinedAt: 1, role: 'player', isLeader: false },
      Bob:   { name: 'Bob',   vote: null, voteFe: null, voteBe: null, joinedAt: 2, role: 'player', isLeader: false },
    };
    const { container } = render(<RevealBackground players={players} splitMode={false} />);
    // Only Alice voted — background must show 13. Without the fix,
    // Number(null)=0 turned the average into (13+0)/2 = 6.5 → tie 5↔8
    // → "8", which mismatched the ResultModal's "Result: 13".
    expect(new Set(read(container))).toEqual(new Set(['13']));
  });

  it('split: ignores players who have not voted FE/BE (null)', () => {
    const players = {
      Alice: { name: 'Alice', vote: null, voteFe: '8', voteBe: '13', joinedAt: 1, role: 'player', isLeader: false },
      Bob:   { name: 'Bob',   vote: null, voteFe: null, voteBe: null, joinedAt: 2, role: 'player', isLeader: false },
    };
    const { container } = render(<RevealBackground players={players} splitMode={true} />);
    const set = new Set(read(container));
    // FE: only Alice voted 8 → background FE = 8
    // BE: only Alice voted 13 → background BE = 13
    expect(set).toEqual(new Set(['8', '13']));
  });

  it('normal: renders nothing when no numeric votes', () => {
    const players = {
      A: { name: 'A', vote: '☕', voteFe: null, voteBe: null, joinedAt: 1, role: 'player', isLeader: false },
      B: { name: 'B', vote: '?',  voteFe: null, voteBe: null, joinedAt: 2, role: 'player', isLeader: false },
    };
    const { container } = render(<RevealBackground players={players} splitMode={false} />);
    expect(container.querySelectorAll('.reveal-number').length).toBe(0);
  });
});
