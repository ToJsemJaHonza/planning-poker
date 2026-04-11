import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardPicker, { SplitCardPicker } from './CardPicker';

const VALUES = ['1', '2', '3', '5', '8', '13', '21', '?', '☕'];

describe('CardPicker — normal mode', () => {
  it('renders all nine Fibonacci values', () => {
    render(<CardPicker selectedVote={null} onVote={() => {}} disabled={false} />);
    VALUES.forEach((v) => {
      expect(screen.getByRole('button', { name: v })).toBeInTheDocument();
    });
  });

  it('calls onVote with the clicked card value', async () => {
    const user = userEvent.setup();
    const onVote = vi.fn();
    render(<CardPicker selectedVote={null} onVote={onVote} disabled={false} />);

    await user.click(screen.getByRole('button', { name: '5' }));
    expect(onVote).toHaveBeenCalledWith('5');

    await user.click(screen.getByRole('button', { name: '☕' }));
    expect(onVote).toHaveBeenCalledWith('☕');
  });

  it('highlights the selected vote', () => {
    render(<CardPicker selectedVote="8" onVote={() => {}} disabled={false} />);
    const btn = screen.getByRole('button', { name: '8' });
    // Selected cards get a transform set on the style — assert presence
    expect(btn.getAttribute('style') || '').toMatch(/translate/);
  });

  it('disabled=true prevents onVote from firing', async () => {
    const user = userEvent.setup();
    const onVote = vi.fn();
    render(<CardPicker selectedVote={null} onVote={onVote} disabled={true} />);

    await user.click(screen.getByRole('button', { name: '5' }));
    expect(onVote).not.toHaveBeenCalled();
  });
});

describe('SplitCardPicker — FE/BE rows', () => {
  it('renders FE and BE labels', () => {
    render(
      <SplitCardPicker
        voteFe={null}
        voteBe={null}
        onVoteFe={() => {}}
        onVoteBe={() => {}}
        disabled={false}
      />
    );
    expect(screen.getByText('FE')).toBeInTheDocument();
    expect(screen.getByText('BE')).toBeInTheDocument();
  });

  it('clicking FE card routes to onVoteFe (not onVoteBe)', async () => {
    const user = userEvent.setup();
    const onVoteFe = vi.fn();
    const onVoteBe = vi.fn();
    const { container } = render(
      <SplitCardPicker
        voteFe={null}
        voteBe={null}
        onVoteFe={onVoteFe}
        onVoteBe={onVoteBe}
        disabled={false}
      />
    );

    // Each value renders twice (FE row + BE row). Grab all buttons with text "5"
    // and click the first one (FE row is rendered first).
    const fiveButtons = Array.from(container.querySelectorAll('button')).filter(
      (b) => b.textContent === '5'
    );
    expect(fiveButtons).toHaveLength(2);

    await user.click(fiveButtons[0]);
    expect(onVoteFe).toHaveBeenCalledWith('5');
    expect(onVoteBe).not.toHaveBeenCalled();

    await user.click(fiveButtons[1]);
    expect(onVoteBe).toHaveBeenCalledWith('5');
  });
});
