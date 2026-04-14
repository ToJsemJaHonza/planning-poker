/**
 * computeRoomPaddingBottom — pure helper extracted from Room.jsx.
 *
 * Pins down the room-bottom-padding precedence so a future refactor
 * can't silently regress the priority order:
 *   entrance cinematic > PM > leader-with-split > leader > player-with-split > player
 */
import { describe, it, expect } from 'vitest';
import { computeRoomPaddingBottom } from './styles';

describe('computeRoomPaddingBottom', () => {
  it('reserves 380px when an entrance cinematic is mounted (highest priority)', () => {
    expect(
      computeRoomPaddingBottom({ hasEntrance: true, isPM: true, canControl: true, splitMode: true }),
    ).toBe('380px');
    expect(
      computeRoomPaddingBottom({ hasEntrance: true, isPM: false, canControl: false, splitMode: false }),
    ).toBe('380px');
  });

  it('returns 80px for PM (no picker visible)', () => {
    expect(
      computeRoomPaddingBottom({ hasEntrance: false, isPM: true, canControl: true, splitMode: false }),
    ).toBe('80px');
  });

  it('leader with split mode = 280px (status bar + 2-row picker)', () => {
    expect(
      computeRoomPaddingBottom({ hasEntrance: false, isPM: false, canControl: true, splitMode: true }),
    ).toBe('280px');
  });

  it('leader without split = 240px (status bar + 1-row picker)', () => {
    expect(
      computeRoomPaddingBottom({ hasEntrance: false, isPM: false, canControl: true, splitMode: false }),
    ).toBe('240px');
  });

  it('plain player with split = 220px (no status bar, 2-row picker)', () => {
    expect(
      computeRoomPaddingBottom({ hasEntrance: false, isPM: false, canControl: false, splitMode: true }),
    ).toBe('220px');
  });

  it('plain player without split = 190px (lowest reserve)', () => {
    expect(
      computeRoomPaddingBottom({ hasEntrance: false, isPM: false, canControl: false, splitMode: false }),
    ).toBe('190px');
  });
});
