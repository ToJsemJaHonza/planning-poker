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

// --- Histogram scale regression: in split mode, FE and BE sections used to
// each use their OWN local max to size bars. That made a single-vote BE bar
// look identical in height to a 2-of-2 consensus FE bar, which the user
// correctly flagged as misleading. Bars are now scaled to totalVotes so a
// full-height bar always means "everyone agreed".
describe('ResultModal — split histogram bar heights', () => {
  // Pull the pixel height directly off the rendered bar style. The barLabel
  // div sits right below the bar, so we query by the vote label text and
  // walk up to the bar sibling.
  const getBarHeight = (container, label) => {
    const labels = Array.from(container.querySelectorAll('div')).filter(
      (el) => el.textContent === label && el.style.fontWeight === 'bold'
    );
    // The label we want is the one inside a .barCol — find the parent
    // column and grab its middle child (the bar itself, which has an
    // explicit pixel height in its inline style).
    for (const lbl of labels) {
      const col = lbl.parentElement;
      if (!col) continue;
      const children = Array.from(col.children);
      if (children.length !== 3) continue; // barCount, bar, barLabel
      const bar = children[1];
      const h = parseFloat(bar.style.height);
      if (!Number.isNaN(h)) return h;
    }
    return null;
  };

  it('split: FE consensus bar is TALLER than BE split bars (same team size)', () => {
    // FE: both voted 3 → one bar, count 2 → should be full-height.
    // BE: one voted 3, one voted 5 → two bars, each count 1 → half-height.
    const players = mkPlayers({
      Alice: { voteFe: '3', voteBe: '3' },
      Bob:   { voteFe: '3', voteBe: '5' },
    });
    const { container } = render(
      <ResultModal players={players} splitMode={true} onNewRound={() => {}} />
    );

    // Find both "3" labels — one in FE, one in BE. We expect the FE one
    // (full consensus) to be visibly taller than BE's (split vote).
    const allLabels = Array.from(container.querySelectorAll('div')).filter(
      (el) => el.textContent === '3' && el.style.fontWeight === 'bold'
    );
    // Two bars labeled "3" — one per section.
    expect(allLabels.length).toBe(2);
    const heights = allLabels
      .map((lbl) => parseFloat(lbl.parentElement.children[1].style.height))
      .sort((a, b) => b - a);
    // FE "3" has count 2 of 2 → 60px. BE "3" has count 1 of 2 → 30px.
    // The taller bar must be strictly taller, not equal (the old bug).
    expect(heights[0]).toBeGreaterThan(heights[1]);
    expect(heights[0]).toBeCloseTo(60, 1);
    expect(heights[1]).toBeCloseTo(30, 1);
  });

  it('split: two full-consensus sections render identical full-height bars', () => {
    // Sanity: when both sides agree, both bars should be full-height.
    const players = mkPlayers({
      Alice: { voteFe: '3', voteBe: '8' },
      Bob:   { voteFe: '3', voteBe: '8' },
    });
    const { container } = render(
      <ResultModal players={players} splitMode={true} onNewRound={() => {}} />
    );
    const feH = getBarHeight(container, '3');
    const beH = getBarHeight(container, '8');
    expect(feH).toBeCloseTo(60, 1);
    expect(beH).toBeCloseTo(60, 1);
  });

  it('normal mode: bar height reflects voter fraction, not local max', () => {
    // 4 players, split 3/1 → majority bar should be ~45px (60 * 3/4),
    // minority bar should be ~15px (60 * 1/4). Old code would have shown
    // 60 / 20 instead (local max = 3), exaggerating minority visibility.
    const players = mkPlayers({
      A: { vote: '5' }, B: { vote: '5' }, C: { vote: '5' }, D: { vote: '8' },
    });
    const { container } = render(
      <ResultModal players={players} splitMode={false} onNewRound={() => {}} />
    );
    const majH = getBarHeight(container, '5');
    const minH = getBarHeight(container, '8');
    expect(majH).toBeCloseTo(45, 1);
    expect(minH).toBeCloseTo(15, 1);
  });
});
