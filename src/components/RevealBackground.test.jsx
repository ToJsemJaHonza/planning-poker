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
