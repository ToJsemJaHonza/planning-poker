import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---- useRoom mock ---------------------------------------------------------
// Room.jsx pulls everything it needs from the useRoom hook. Tests configure
// a mutable `roomState` object and the mock returns a merged view of it —
// this lets each test set a tiny slice (phase, isLeader, etc.) without
// building a full Firebase fixture.

const roomState = {};
const triggerOktaMock = vi.fn();

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

function baseReturn() {
  return {
    players: roomState.players ?? {},
    phase: roomState.phase ?? 'voting',
    task: roomState.task ?? '',
    splitMode: roomState.splitMode ?? false,
    specialRound: false,
    pmQuote: '',
    setPmQuote: vi.fn(),
    oktaEvent: false,
    triggerOkta: triggerOktaMock,
    syncedEvent: null,
    fireSyncedEvent: vi.fn(),
    isLeader: roomState.isLeader ?? false,
    connected: true,
    leaderChangedAt: 0,
    createdAt: 0,
    castVote: vi.fn(),
    castVoteFe: vi.fn(),
    castVoteBe: vi.fn(),
    toggleSplit: vi.fn(),
    revealCards: vi.fn().mockResolvedValue(undefined),
    newRound: vi.fn().mockResolvedValue(undefined),
    updateTask: vi.fn(),
  };
}

vi.mock('../hooks/useRoom', () => ({
  useRoom: () => baseReturn(),
  generateRoomCode: () => 'TESTRM',
}));

// Import AFTER the mock is registered
import Room from './Room';

function setState(patch) {
  Object.assign(roomState, patch);
}

function resetState() {
  for (const k of Object.keys(roomState)) delete roomState[k];
  triggerOktaMock.mockClear();
}

describe('Room — rendering & controls', () => {
  beforeEach(() => {
    resetState();
  });

  it('PM view hides the CardPicker', () => {
    setState({
      players: { Alice: makePlayer('Alice', { joinedAt: 1 }) },
      phase: 'voting',
      isLeader: true,
    });

    const { container } = render(
      <Room roomCode="TESTRM" playerName="PMName" role="pm" />
    );

    // Card picker cards never render for PM — no button labelled '5' exists.
    const fiveBtns = Array.from(container.querySelectorAll('button')).filter(
      (b) => b.textContent === '5'
    );
    expect(fiveBtns).toHaveLength(0);
  });

  it('player view shows the CardPicker', () => {
    setState({
      players: { Alice: makePlayer('Alice', { joinedAt: 1 }) },
      phase: 'voting',
      isLeader: false,
    });

    const { container } = render(
      <Room roomCode="TESTRM" playerName="Alice" role="player" />
    );

    const fiveBtns = Array.from(container.querySelectorAll('button')).filter(
      (b) => b.textContent === '5'
    );
    expect(fiveBtns.length).toBeGreaterThan(0);
  });

  // === B1 regression — intentional behavior ===============================
  // Non-leaders MUST NOT see the ResultModal. This is NOT a bug — the product
  // decision is that only the leader/PM sees the verdict screen while other
  // players just see the revealed cards. If this test ever starts failing,
  // stop and confirm the product decision has changed before updating it.
  it('B1 (intentional): non-leader does NOT see ResultModal on reveal', () => {
    setState({
      players: {
        Alice: makePlayer('Alice', { joinedAt: 1, vote: '5', isLeader: true }),
        Bob:   makePlayer('Bob',   { joinedAt: 2, vote: '5' }),
      },
      phase: 'revealed',
      isLeader: false, // <-- non-leader
    });

    render(<Room roomCode="TESTRM" playerName="Bob" role="player" />);

    // Leader-only verdict modal must not appear
    expect(screen.queryByRole('button', { name: /new round/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Perfect match!/i)).not.toBeInTheDocument();
  });

  // For contrast — the leader DOES trigger the modal, but only after the
  // handleReveal timeout runs. Since the modal is state-gated on showResult,
  // we can't see it on initial render; but we can verify that no control
  // crashes when phase is revealed for the leader.
  it('leader sees control buttons when phase is revealed', () => {
    setState({
      players: {
        Alice: makePlayer('Alice', { joinedAt: 1, vote: '5', isLeader: true }),
      },
      phase: 'revealed',
      isLeader: true,
    });

    render(<Room roomCode="TESTRM" playerName="Alice" role="player" />);
    expect(screen.getByRole('button', { name: /new round/i })).toBeInTheDocument();
  });

  // === Y2 — plural helper ================================================
  it('Y2: renders "1 player" (singular) when playerCount === 1', () => {
    setState({
      players: { Alice: makePlayer('Alice', { joinedAt: 1 }) },
      phase: 'voting',
      isLeader: false,
    });

    render(<Room roomCode="TESTRM" playerName="Alice" role="player" />);
    expect(screen.getByText('1 player')).toBeInTheDocument();
  });

  it('Y2: renders "2 players" (plural) when playerCount === 2', () => {
    setState({
      players: {
        Alice: makePlayer('Alice', { joinedAt: 1 }),
        Bob:   makePlayer('Bob',   { joinedAt: 2 }),
      },
      phase: 'voting',
      isLeader: false,
    });

    render(<Room roomCode="TESTRM" playerName="Alice" role="player" />);
    expect(screen.getByText('2 players')).toBeInTheDocument();
  });

  // === Y6 — clipboard success + failure ==================================
  it('Y6: clipboard success flips the button to "✓ Copied"', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });

    setState({
      players: { Alice: makePlayer('Alice', { joinedAt: 1 }) },
      phase: 'voting',
      isLeader: true,
    });

    render(<Room roomCode="TESTRM" playerName="Alice" role="player" />);

    await user.click(screen.getByRole('button', { name: /invite/i }));
    expect(await screen.findByRole('button', { name: /Copied/i })).toBeInTheDocument();
  });

  it('Y6: clipboard rejection flips the button to "✗ Copy failed"', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('nope')) },
      configurable: true,
      writable: true,
    });

    setState({
      players: { Alice: makePlayer('Alice', { joinedAt: 1 }) },
      phase: 'voting',
      isLeader: true,
    });

    render(<Room roomCode="TESTRM" playerName="Alice" role="player" />);

    await user.click(screen.getByRole('button', { name: /invite/i }));
    expect(await screen.findByRole('button', { name: /Copy failed/i })).toBeInTheDocument();
  });

  // === P6 — OKTA modifier guard ==========================================
  it('P6: Ctrl+O + Ctrl+K + Ctrl+T + Ctrl+A does NOT trigger OKTA', () => {
    setState({
      players: { Honza: makePlayer('Honza', { joinedAt: 1, isLeader: true }) },
      phase: 'voting',
      isLeader: true,
    });

    render(<Room roomCode="TESTRM" playerName="Honza" role="player" />);

    // Fire each key WITH ctrlKey — the modifier guard should skip every one.
    ['o', 'k', 't', 'a'].forEach((key) => {
      fireEvent.keyDown(window, { key, ctrlKey: true });
    });

    expect(triggerOktaMock).not.toHaveBeenCalled();
  });

  it('P6: plain O + K + T + A (no modifiers) DOES trigger OKTA', () => {
    setState({
      players: { Honza: makePlayer('Honza', { joinedAt: 1, isLeader: true }) },
      phase: 'voting',
      isLeader: true,
    });

    render(<Room roomCode="TESTRM" playerName="Honza" role="player" />);

    ['o', 'k', 't', 'a'].forEach((key) => {
      fireEvent.keyDown(window, { key });
    });

    expect(triggerOktaMock).toHaveBeenCalled();
  });

  // === Y3 — task editor close triggers =================================
  it('Y3: task editor Escape key closes without saving', async () => {
    const user = userEvent.setup();
    setState({
      players: { Alice: makePlayer('Alice', { joinedAt: 1, isLeader: true }) },
      phase: 'voting',
      isLeader: true,
      task: 'Existing task',
    });

    render(<Room roomCode="TESTRM" playerName="Alice" role="player" />);

    // Click the task display to open the editor
    await user.click(screen.getByText('Existing task'));

    // Editor input now present
    const input = screen.getByPlaceholderText(/task name/i);
    expect(input).toBeInTheDocument();

    // Press Escape — editor should close and reveal the task display again
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByPlaceholderText(/task name/i)).not.toBeInTheDocument();
    expect(screen.getByText('Existing task')).toBeInTheDocument();
  });
});
