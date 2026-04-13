/**
 * useCrownOwnership — single crown ownership priority rule tests.
 *
 * Tests the three priority rules and all transition edges:
 *   Rule 1: Slot machine ceremony active (highest priority)
 *   Rule 2: Room-start ceremony active
 *   Rule 3: Idle — crown on isLeader player
 *
 * Uses renderHook from @testing-library/react so we test the real useMemo
 * derivation, not a hand-rolled mock.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCrownOwnership } from './useCrownOwnership';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProps(overrides = {}) {
  return {
    players: overrides.players ?? {},
    slotMachinePhaseState: overrides.slotMachinePhaseState ?? null,
    roomStartState: overrides.roomStartState ?? null,
    pmRoulette: overrides.pmRoulette ?? null,
  };
}

function idlePhaseState() {
  return { phase: 'idle', crownCeremonyState: null };
}

function donePhaseState() {
  return { phase: 'done', crownCeremonyState: null };
}

// ---------------------------------------------------------------------------
// Rule 3: Idle state (no ceremony active)
// ---------------------------------------------------------------------------

describe('Rule 3: Idle — crown on leader', () => {
  it('returns player-head for the isLeader player', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: {
        alice: { isLeader: true, role: 'player' },
        bob: { isLeader: false, role: 'player' },
      },
    })));

    expect(result.current).toEqual({
      location: 'player-head',
      playerId: 'alice',
      progress: 1,
      glowing: false,
    });
  });

  it('returns none when no player has isLeader', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: {
        alice: { isLeader: false, role: 'player' },
      },
    })));

    expect(result.current.location).toBe('none');
    expect(result.current.playerId).toBeNull();
  });

  it('excludes PM role from crown even if isLeader', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: {
        pmUser: { isLeader: true, role: 'pm' },
        bob: { isLeader: false, role: 'player' },
      },
    })));

    expect(result.current.location).toBe('none');
  });

  it('returns none when players is empty', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps()));
    expect(result.current.location).toBe('none');
  });

  it('idle phase from slot machine falls through to Rule 3', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: { alice: { isLeader: true, role: 'player' } },
      slotMachinePhaseState: idlePhaseState(),
    })));

    expect(result.current.location).toBe('player-head');
    expect(result.current.playerId).toBe('alice');
  });

  it('done phase from slot machine falls through to Rule 3', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: { alice: { isLeader: true, role: 'player' } },
      slotMachinePhaseState: donePhaseState(),
    })));

    expect(result.current.location).toBe('player-head');
    expect(result.current.playerId).toBe('alice');
  });
});

// ---------------------------------------------------------------------------
// Rule 1: Slot machine ceremony active
// ---------------------------------------------------------------------------

describe('Rule 1: Slot machine ceremony — crownCeremonyState direct format', () => {
  const pmRoulette = {
    outgoingLeaderId: 'oldLeader',
    winnerId: 'newWinner',
    outgoingLeaderHadCrown: true,
  };

  it('crown on player-head (outgoing leader, not yet lifted) -> player-head', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: { oldLeader: { isLeader: false, role: 'player' } },
      slotMachinePhaseState: {
        phase: 'crownRemoval',
        crownCeremonyState: { location: 'player-head', playerId: 'oldLeader', progress: 1, glowing: false },
      },
      pmRoulette,
    })));

    expect(result.current).toEqual({
      location: 'player-head',
      playerId: 'oldLeader',
      progress: 1,
      glowing: false,
    });
  });

  it('crown lifting -> lifting', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: {},
      slotMachinePhaseState: {
        phase: 'crownRemoval',
        crownCeremonyState: { location: 'lifting', playerId: 'oldLeader', progress: 0.5, glowing: true },
      },
      pmRoulette,
    })));

    expect(result.current.location).toBe('lifting');
    expect(result.current.playerId).toBe('oldLeader');
    expect(result.current.progress).toBe(0.5);
    expect(result.current.glowing).toBe(true);
  });

  it('crown at pm-hand -> pm-hand', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: {},
      slotMachinePhaseState: {
        phase: 'spinning',
        crownCeremonyState: { location: 'pm-hand', playerId: null, progress: 1, glowing: true },
      },
      pmRoulette,
    })));

    expect(result.current.location).toBe('pm-hand');
    expect(result.current.playerId).toBeNull();
    expect(result.current.glowing).toBe(true);
  });

  it('crown materializing -> materializing', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: {},
      slotMachinePhaseState: {
        phase: 'crownDelivery',
        crownCeremonyState: { location: 'materializing', playerId: null, progress: 0.6, glowing: true },
      },
      pmRoulette: { ...pmRoulette, outgoingLeaderHadCrown: false },
    })));

    expect(result.current.location).toBe('materializing');
    expect(result.current.progress).toBe(0.6);
    expect(result.current.glowing).toBe(true);
  });

  it('crown arcing to new leader (progress < 1) -> arcing-to-player', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: {},
      slotMachinePhaseState: {
        phase: 'crownDelivery',
        crownCeremonyState: { location: 'arcing-to-player', playerId: 'newWinner', progress: 0.7, glowing: true },
      },
      pmRoulette,
    })));

    expect(result.current.location).toBe('arcing-to-player');
    expect(result.current.playerId).toBe('newWinner');
    expect(result.current.progress).toBe(0.7);
    expect(result.current.glowing).toBe(true);
  });

  it('crown settled on new leader (progress >= 1) -> player-head on winner', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: { newWinner: { isLeader: true, role: 'player' } },
      slotMachinePhaseState: {
        phase: 'crownDelivery',
        crownCeremonyState: { location: 'player-head', playerId: 'newWinner', progress: 1, glowing: false },
      },
      pmRoulette,
    })));

    expect(result.current).toEqual({
      location: 'player-head',
      playerId: 'newWinner',
      progress: 1,
      glowing: false,
    });
  });

  it('ceremony active with no crownCeremonyState (PM-creator, spinning) -> none', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: { alice: { isLeader: true, role: 'player' } },
      slotMachinePhaseState: {
        phase: 'spinning',
        crownCeremonyState: null,
      },
      pmRoulette: { ...pmRoulette, outgoingLeaderHadCrown: false },
    })));

    expect(result.current.location).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Rule 1 overrides Rule 3 (priority test)
// ---------------------------------------------------------------------------

describe('Priority: Rule 1 overrides Rule 3', () => {
  it('ceremony crown beats Firebase isLeader during ceremony', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: {
        oldLeader: { isLeader: false, role: 'player' },
        newWinner: { isLeader: true, role: 'player' }, // Firebase already set
      },
      slotMachinePhaseState: {
        phase: 'crownDelivery',
        crownCeremonyState: { location: 'pm-hand', playerId: null, progress: 1, glowing: true },
      },
      pmRoulette: { outgoingLeaderId: 'oldLeader', winnerId: 'newWinner' },
    })));

    // Crown should be pm-hand, NOT on newWinner's head
    expect(result.current.location).toBe('pm-hand');
    expect(result.current.playerId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Rule 2: Room-start ceremony
// ---------------------------------------------------------------------------

describe('Rule 2: Room-start ceremony', () => {
  it('pmEntry phase -> none (crown not yet created)', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: { alice: { isLeader: true, role: 'player' } },
      roomStartState: {
        active: true,
        phase: 'pmEntry',
        elapsed: 500,
        winnerId: 'alice',
      },
    })));

    expect(result.current.location).toBe('none');
  });

  it('castAndMaterialize phase -> materializing', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: { alice: { isLeader: true, role: 'player' } },
      roomStartState: {
        active: true,
        phase: 'castAndMaterialize',
        elapsed: 1600,
        winnerId: 'alice',
      },
    })));

    expect(result.current.location).toBe('materializing');
    expect(result.current.glowing).toBe(true);
  });

  it('crownPlace phase -> arcing-to-player', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: { alice: { isLeader: true, role: 'player' } },
      roomStartState: {
        active: true,
        phase: 'crownPlace',
        elapsed: 2200,
        winnerId: 'alice',
      },
    })));

    expect(result.current.location).toBe('arcing-to-player');
    expect(result.current.playerId).toBe('alice');
    expect(result.current.glowing).toBe(true);
  });

  it('pmExit phase -> player-head on winner', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: { alice: { isLeader: true, role: 'player' } },
      roomStartState: {
        active: true,
        phase: 'pmExit',
        elapsed: 3000,
        winnerId: 'alice',
      },
    })));

    expect(result.current).toEqual({
      location: 'player-head',
      playerId: 'alice',
      progress: 1,
      glowing: false,
    });
  });

  it('done phase (still active) -> player-head on winner', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: { alice: { isLeader: true, role: 'player' } },
      roomStartState: {
        active: true,
        phase: 'done',
        elapsed: 3600,
        winnerId: 'alice',
      },
    })));

    expect(result.current.location).toBe('player-head');
    expect(result.current.playerId).toBe('alice');
  });
});

// ---------------------------------------------------------------------------
// Rule 2 overrides Rule 3 (priority test)
// ---------------------------------------------------------------------------

describe('Priority: Rule 2 overrides Rule 3', () => {
  it('room-start crown suppresses Firebase isLeader crown', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: {
        alice: { isLeader: true, role: 'player' },
      },
      roomStartState: {
        active: true,
        phase: 'pmEntry',
        elapsed: 200,
        winnerId: 'alice',
      },
    })));

    // During pmEntry, crown is 'none', not 'player-head' on alice
    expect(result.current.location).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Rule 1 overrides Rule 2 (priority test)
// ---------------------------------------------------------------------------

describe('Priority: Rule 1 overrides Rule 2', () => {
  it('slot machine ceremony takes precedence over room-start', () => {
    const { result } = renderHook(() => useCrownOwnership(makeProps({
      players: {},
      slotMachinePhaseState: {
        phase: 'crownDelivery',
        crownCeremonyState: { location: 'pm-hand', playerId: null, progress: 1, glowing: true },
      },
      roomStartState: {
        active: true,
        phase: 'crownPlace',
        elapsed: 2200,
        winnerId: 'alice',
      },
      pmRoulette: { outgoingLeaderId: 'x', winnerId: 'bob' },
    })));

    // Slot machine wins — crown at pm-hand, not arcing to alice
    expect(result.current.location).toBe('pm-hand');
  });
});

// ---------------------------------------------------------------------------
// Transition edge: ceremony end -> idle handoff (no gap)
// ---------------------------------------------------------------------------

describe('Transition edge: ceremony end to idle', () => {
  it('settled crown on new leader transitions seamlessly to idle player-head', () => {
    const pmRoulette = {
      outgoingLeaderId: 'old',
      winnerId: 'winner',
      outgoingLeaderHadCrown: true,
    };

    // During ceremony: settled state
    const { result, rerender } = renderHook(
      (props) => useCrownOwnership(props),
      {
        initialProps: makeProps({
          players: { winner: { isLeader: true, role: 'player' } },
          slotMachinePhaseState: {
            phase: 'crownDelivery',
            crownCeremonyState: { location: 'player-head', playerId: 'winner', progress: 1, glowing: false },
          },
          pmRoulette,
        }),
      }
    );

    expect(result.current.location).toBe('player-head');
    expect(result.current.playerId).toBe('winner');

    // Ceremony ends — phase becomes 'done', crownCeremonyState becomes null
    rerender(makeProps({
      players: { winner: { isLeader: true, role: 'player' } },
      slotMachinePhaseState: donePhaseState(),
      pmRoulette: null,
    }));

    // Still player-head on winner — no gap
    expect(result.current.location).toBe('player-head');
    expect(result.current.playerId).toBe('winner');
  });
});

// ---------------------------------------------------------------------------
// Invariant: at most one crown visible
// ---------------------------------------------------------------------------

describe('Invariant: exactly one location at a time', () => {
  it('every valid state has exactly one location string', () => {
    const validLocations = new Set([
      'player-head', 'pm-hand', 'lifting',
      'arcing-to-player', 'materializing', 'none',
    ]);

    const states = [
      // Idle
      makeProps({ players: { a: { isLeader: true, role: 'player' } } }),
      // Ceremony lifting
      makeProps({
        slotMachinePhaseState: { phase: 'crownRemoval', crownCeremonyState: { location: 'lifting', playerId: 'a', progress: 0.5, glowing: true } },
        pmRoulette: { outgoingLeaderId: 'a', winnerId: 'b' },
      }),
      // Room-start materializing
      makeProps({
        roomStartState: { active: true, phase: 'castAndMaterialize', elapsed: 1500, winnerId: 'a' },
      }),
      // No leader, no ceremony
      makeProps({ players: { a: { isLeader: false, role: 'player' } } }),
    ];

    for (const props of states) {
      const { result } = renderHook(() => useCrownOwnership(props));
      expect(validLocations.has(result.current.location)).toBe(true);
      expect(typeof result.current.progress).toBe('number');
      expect(typeof result.current.glowing).toBe('boolean');
    }
  });
});
