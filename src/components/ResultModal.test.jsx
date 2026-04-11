import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResultModal from './ResultModal';
import { computeStats } from './resultModal.utils';

function mkPlayers(votes) {
  const out = {};
  Object.entries(votes).forEach(([name, v], i) => {
    out[name] = {
      name,
      joinedAt: i,
      vote: v.vote ?? null,
      voteFe: v.voteFe ?? null,
      voteBe: v.voteBe ?? null,
      role: 'player',
      isLeader: false,
    };
  });
  return out;
}

describe('ResultModal — verdict logic (computeStats)', () => {
  it('Perfect match when all votes equal', () => {
    const stats = computeStats([
      { name: 'A', vote: '5' },
      { name: 'B', vote: '5' },
      { name: 'C', vote: '5' },
    ]);
    expect(stats.verdict).toBe('Perfect match!');
  });

  it('Good match when spread ≤ 2', () => {
    const stats = computeStats([
      { name: 'A', vote: '3' },
      { name: 'B', vote: '5' },
    ]);
    expect(stats.verdict).toBe('Good match');
  });

  it('Some spread when spread 3..5', () => {
    const stats = computeStats([
      { name: 'A', vote: '2' },
      { name: 'B', vote: '7' },
    ]);
    expect(stats.verdict).toBe('Some spread');
  });

  it('Big spread when spread > 5', () => {
    const stats = computeStats([
      { name: 'A', vote: '1' },
      { name: 'B', vote: '13' },
    ]);
    expect(stats.verdict).toBe('Big spread!');
  });

  it('No votes verdict when nothing numeric', () => {
    const stats = computeStats([{ name: 'A', vote: '?' }]);
    expect(stats.verdict).toBe('No votes');
  });
});

describe('ResultModal — rendering', () => {
  it('renders a single-mode modal with New Round button', () => {
    const players = mkPlayers({
      Alice: { vote: '5' },
      Bob: { vote: '5' },
    });
    render(<ResultModal players={players} splitMode={false} onNewRound={() => {}} />);
    expect(screen.getByRole('button', { name: /new round/i })).toBeInTheDocument();
    expect(screen.getByText(/Perfect match!/i)).toBeInTheDocument();
  });

  it('split mode renders both Frontend and Backend sections', () => {
    const players = mkPlayers({
      Alice: { voteFe: '3', voteBe: '8' },
      Bob: { voteFe: '3', voteBe: '8' },
    });
    render(<ResultModal players={players} splitMode={true} onNewRound={() => {}} />);
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('Backend')).toBeInTheDocument();
  });

  it('New Round button calls onNewRound', async () => {
    const user = userEvent.setup();
    const onNewRound = vi.fn();
    const players = mkPlayers({ Alice: { vote: '5' } });
    render(<ResultModal players={players} splitMode={false} onNewRound={onNewRound} />);

    await user.click(screen.getByRole('button', { name: /new round/i }));
    expect(onNewRound).toHaveBeenCalled();
  });
});
