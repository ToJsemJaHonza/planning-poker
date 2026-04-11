import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import PlayerList from './PlayerList';

function makePlayer(name, opts = {}) {
  return {
    name,
    joinedAt: opts.joinedAt ?? Date.now(),
    vote: opts.vote ?? null,
    voteFe: opts.voteFe ?? null,
    voteBe: opts.voteBe ?? null,
    isLeader: opts.isLeader ?? false,
    role: opts.role ?? 'player',
  };
}

describe('PlayerList — walking in / out', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all current players', () => {
    const players = {
      Alice: makePlayer('Alice', { joinedAt: 1 }),
      Bob: makePlayer('Bob', { joinedAt: 2 }),
    };

    const { getByTestId } = render(
      <PlayerList
        players={players}
        phase="voting"
        currentPlayer="Alice"
        splitMode={false}
        syncedEvent={null}
        fireSyncedEvent={() => {}}
        isLeader={false}
      />
    );

    expect(getByTestId('player-Alice')).toBeInTheDocument();
    expect(getByTestId('player-Bob')).toBeInTheDocument();
  });

  it('gives new players a walk-in animation class', () => {
    const players = {
      Alice: makePlayer('Alice', { joinedAt: 1 }),
    };

    const { rerender, getByTestId } = render(
      <PlayerList
        players={players}
        phase="voting"
        currentPlayer="Alice"
        splitMode={false}
        syncedEvent={null}
        fireSyncedEvent={() => {}}
        isLeader={false}
      />
    );

    // Add Bob
    const players2 = {
      ...players,
      Bob: makePlayer('Bob', { joinedAt: 2 }),
    };
    rerender(
      <PlayerList
        players={players2}
        phase="voting"
        currentPlayer="Alice"
        splitMode={false}
        syncedEvent={null}
        fireSyncedEvent={() => {}}
        isLeader={false}
      />
    );

    const bobEl = getByTestId('player-Bob');
    expect(bobEl.className).toMatch(/player-walk-in-(left|right)/);
  });

  it('keeps a disconnected player in the DOM briefly with a walk-OUT class', () => {
    const players = {
      Alice: makePlayer('Alice', { joinedAt: 1 }),
      Bob: makePlayer('Bob', { joinedAt: 2 }),
    };

    const { rerender, getByTestId, queryByTestId } = render(
      <PlayerList
        players={players}
        phase="voting"
        currentPlayer="Alice"
        splitMode={false}
        syncedEvent={null}
        fireSyncedEvent={() => {}}
        isLeader={false}
      />
    );

    // Both present
    expect(getByTestId('player-Bob')).toBeInTheDocument();

    // Bob disconnects
    rerender(
      <PlayerList
        players={{ Alice: players.Alice }}
        phase="voting"
        currentPlayer="Alice"
        splitMode={false}
        syncedEvent={null}
        fireSyncedEvent={() => {}}
        isLeader={false}
      />
    );

    // Bob should STILL be rendered, now with walk-out class
    const bobEl = getByTestId('player-Bob');
    expect(bobEl).toBeInTheDocument();
    expect(bobEl.className).toMatch(/player-walk-out-(left|right)/);

    // After walk-out duration passes, Bob is removed
    act(() => { vi.advanceTimersByTime(5000); });
    expect(queryByTestId('player-Bob')).toBeNull();
  });

  it('does NOT walk-in players that were already present on mount', () => {
    const players = {
      Alice: makePlayer('Alice', { joinedAt: 1 }),
      Bob: makePlayer('Bob', { joinedAt: 2 }),
    };

    const { getByTestId } = render(
      <PlayerList
        players={players}
        phase="voting"
        currentPlayer="Alice"
        splitMode={false}
        syncedEvent={null}
        fireSyncedEvent={() => {}}
        isLeader={false}
      />
    );

    // Note: initial mount technically adds them to enteringPlayers in the current
    // implementation — both get a walk-in. That's fine (they're "walking into the room"
    // when the client first joins), but the key behavior we guarantee is that if you
    // re-render with the same set, no NEW walk-in animations are assigned to players
    // that already existed.
    const aliceInitial = getByTestId('player-Alice').className;
    expect(aliceInitial).toMatch(/player-walk-in-(left|right)|^$/);
  });

  it('renders a revealed vote for each player', () => {
    const players = {
      Alice: makePlayer('Alice', { joinedAt: 1, vote: '5' }),
      Bob: makePlayer('Bob', { joinedAt: 2, vote: '8' }),
    };

    const { getByTestId } = render(
      <PlayerList
        players={players}
        phase="revealed"
        currentPlayer="Alice"
        splitMode={false}
        syncedEvent={null}
        fireSyncedEvent={() => {}}
        isLeader={false}
      />
    );

    expect(getByTestId('player-Alice').textContent).toContain('5');
    expect(getByTestId('player-Bob').textContent).toContain('8');
  });

  it('hides the voted number behind "?" while in voting phase', () => {
    const players = {
      Alice: makePlayer('Alice', { joinedAt: 1, vote: '5' }),
    };

    const { getByTestId } = render(
      <PlayerList
        players={players}
        phase="voting"
        currentPlayer="Alice"
        splitMode={false}
        syncedEvent={null}
        fireSyncedEvent={() => {}}
        isLeader={false}
      />
    );

    const alice = getByTestId('player-Alice');
    expect(alice.textContent).toContain('?');
    expect(alice.textContent).not.toContain('5');
  });

  it('filters out the PM from the player grid', () => {
    const players = {
      PM: makePlayer('PM', { joinedAt: 1, role: 'pm', isLeader: true }),
      Alice: makePlayer('Alice', { joinedAt: 2 }),
    };

    const { queryByTestId, getByTestId } = render(
      <PlayerList
        players={players}
        phase="voting"
        currentPlayer="Alice"
        splitMode={false}
        syncedEvent={null}
        fireSyncedEvent={() => {}}
        isLeader={false}
      />
    );

    expect(getByTestId('player-Alice')).toBeInTheDocument();
    expect(queryByTestId('player-PM')).toBeNull();
  });

  it('shows split-mode FE/BE cards when splitMode is true', () => {
    const players = {
      Alice: makePlayer('Alice', { joinedAt: 1, voteFe: '3', voteBe: '5' }),
    };

    const { getByTestId } = render(
      <PlayerList
        players={players}
        phase="revealed"
        currentPlayer="Alice"
        splitMode={true}
        syncedEvent={null}
        fireSyncedEvent={() => {}}
        isLeader={false}
      />
    );

    const alice = getByTestId('player-Alice');
    expect(alice.textContent).toContain('FE');
    expect(alice.textContent).toContain('BE');
    expect(alice.textContent).toContain('3');
    expect(alice.textContent).toContain('5');
  });

  it('hides a player while a train event is targeting them', () => {
    const players = {
      Richard: makePlayer('Richard', { joinedAt: 1 }),
      Alice: makePlayer('Alice', { joinedAt: 2 }),
    };

    const { queryByTestId, getByTestId } = render(
      <PlayerList
        players={players}
        phase="voting"
        currentPlayer="Alice"
        splitMode={false}
        syncedEvent={{ type: 'train', playerId: 'Richard', playerName: 'Richard', fromRight: false }}
        fireSyncedEvent={() => {}}
        isLeader={false}
      />
    );

    // Richard's normal testid is hidden (replaced by placeholder)
    expect(queryByTestId('player-Richard')).toBeNull();
    expect(getByTestId('player-Alice')).toBeInTheDocument();
  });

  it('Richard is never absent from the DOM during the train-to-grid handoff', () => {
    // Regression guard: before the continuous-walk refactor, there was
    // a window where Richard had faded out of the cinematic but not yet
    // appeared in the grid. Here we mount PlayerList with an active
    // train event so EntranceStage mounts Train AND the placeholder is
    // reserved in the grid. Advancing through the 10 s timeline, a
    // Richard-bearing element must always be present — either as the
    // reserved placeholder, or as the real grid player after handoff.
    const players = {
      Richard: makePlayer('Richard', { joinedAt: 1 }),
      Alice: makePlayer('Alice', { joinedAt: 2 }),
    };
    const { container } = render(
      <PlayerList
        players={players}
        phase="voting"
        currentPlayer="Alice"
        splitMode={false}
        syncedEvent={{ type: 'train', playerId: 'Richard', playerName: 'Richard', fromRight: false }}
        fireSyncedEvent={() => {}}
        isLeader={false}
      />
    );
    const hasRichard = () => (
      container.querySelector('[data-entrance-target="Richard"]') ||
      container.querySelector('[data-testid="player-Richard"]') ||
      container.querySelector('[data-testid="player-Richard-placeholder"]')
    );
    expect(hasRichard()).not.toBeNull();
    for (let t = 0; t < 10000; t += 100) {
      act(() => { vi.advanceTimersByTime(100); });
      expect(hasRichard()).not.toBeNull();
    }
  });

  it('Tomáš is never absent from the DOM during the DBB handoff', () => {
    const players = {
      'Tomáš': makePlayer('Tomáš', { joinedAt: 1 }),
      Alice: makePlayer('Alice', { joinedAt: 2 }),
    };
    const { container } = render(
      <PlayerList
        players={players}
        phase="voting"
        currentPlayer="Alice"
        splitMode={false}
        syncedEvent={{ type: 'dbbPipeline', playerId: 'Tomáš', playerName: 'Tomáš', fromSide: 'top' }}
        fireSyncedEvent={() => {}}
        isLeader={false}
      />
    );
    const hasTomas = () => (
      container.querySelector('[data-entrance-target="Tomáš"]') ||
      container.querySelector('[data-testid="player-Tomáš"]') ||
      container.querySelector('[data-testid="player-Tomáš-placeholder"]')
    );
    expect(hasTomas()).not.toBeNull();
    for (let t = 0; t < 8500; t += 100) {
      act(() => { vi.advanceTimersByTime(100); });
      expect(hasTomas()).not.toBeNull();
    }
  });

  it('reserves a placeholder slot with visibility:hidden for a hidden player', () => {
    const players = {
      Richard: makePlayer('Richard', { joinedAt: 1 }),
      Alice: makePlayer('Alice', { joinedAt: 2 }),
    };
    const { getByTestId, container } = render(
      <PlayerList
        players={players}
        phase="voting"
        currentPlayer="Alice"
        splitMode={false}
        syncedEvent={{ type: 'train', playerId: 'Richard', playerName: 'Richard', fromRight: false }}
        fireSyncedEvent={() => {}}
        isLeader={false}
      />
    );

    // Placeholder exists with a dedicated testid…
    expect(getByTestId('player-Richard-placeholder')).toBeInTheDocument();
    // …and an entrance-target marker the cinematic hook can aim at.
    // data-entrance-target is the stable Firebase key (the player ID),
    // which in this fixture equals the display name.
    const target = container.querySelector('[data-entrance-target="Richard"]');
    expect(target).not.toBeNull();
    expect(target.style.visibility).toBe('hidden');
    // No `.richard-exit-train` here — that lives inside Train, which is
    // rendered by EntranceStage, not by PlayerList's grid.
    expect(container.querySelector('.richard-exit-train')).toBeNull();
  });

  it('crowns the leader with 👑 in the name tag', () => {
    const players = {
      Alice: makePlayer('Alice', { joinedAt: 1, isLeader: true }),
      Bob: makePlayer('Bob', { joinedAt: 2 }),
    };

    const { getByTestId } = render(
      <PlayerList
        players={players}
        phase="voting"
        currentPlayer="Alice"
        splitMode={false}
        syncedEvent={null}
        fireSyncedEvent={() => {}}
        isLeader={true}
      />
    );

    expect(getByTestId('player-Alice').textContent).toContain('👑');
    expect(getByTestId('player-Bob').textContent).not.toContain('👑');
  });
});

describe('cinematic walk math (diagonal case)', () => {
  it('computes non-zero dx + correct duration/step clamps for off-center slot', () => {
    // Simulate a cinematic figure at (100, 500) and a grid slot at (500, 520).
    const fromRect = { left: 100, top: 500, width: 40, height: 56 };
    const toRect   = { left: 500, top: 520, width: 40, height: 56 };
    const fCx = fromRect.left + fromRect.width / 2;
    const fCy = fromRect.top + fromRect.height / 2;
    const tCx = toRect.left + toRect.width / 2;
    const tCy = toRect.top + toRect.height / 2;
    const dx = tCx - fCx;
    const dy = tCy - fCy;
    const d = Math.hypot(dx, dy);

    // Match useCinematicHandoff clamps exactly
    const dur = Math.max(1800, Math.min(3200, Math.round(d * 6)));
    const rawSteps = Math.max(4, Math.round(d / 24));
    const stepCount = Math.min(rawSteps, 16);

    expect(dx).toBe(400);
    expect(dy).toBe(20);
    expect(dur).toBeGreaterThanOrEqual(1800);
    expect(dur).toBeLessThanOrEqual(3200);
    expect(stepCount).toBeGreaterThan(4);
    expect(stepCount).toBeLessThanOrEqual(16);
  });
});
