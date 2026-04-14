import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { SingleCard, SplitCards } from './VotingCards';

describe('SingleCard — flip animation', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('mounted with phase=revealed shows vote immediately without flip classes', () => {
    const { container } = render(
      <SingleCard data={{ vote: '5' }} phase="revealed" playerIndex={0} />
    );
    expect(container.textContent).toBe('5');
    expect(container.querySelector('.card-flip-out')).toBeNull();
    expect(container.querySelector('.card-flip-in')).toBeNull();
  });

  it('phase voting->revealed triggers flip-out then flip-in sequence', () => {
    const { container, rerender } = render(
      <SingleCard data={{ vote: '5' }} phase="voting" playerIndex={0} />
    );
    // Card shows "?" while voting
    expect(container.textContent).toBe('?');

    // Transition to revealed
    rerender(<SingleCard data={{ vote: '5' }} phase="revealed" playerIndex={0} />);

    // After stagger (0ms for index 0), flip-out starts
    act(() => { vi.advanceTimersByTime(1); });
    expect(container.querySelector('.card-flip-out')).not.toBeNull();
    // Content still shows "?" during flip-out
    expect(container.textContent).toBe('?');

    // After 250ms, flip-in starts with revealed content
    act(() => { vi.advanceTimersByTime(250); });
    expect(container.querySelector('.card-flip-in')).not.toBeNull();
    expect(container.textContent).toBe('5');

    // After 250ms more, bounce
    act(() => { vi.advanceTimersByTime(250); });
    expect(container.querySelector('.card-flip-bounce')).not.toBeNull();

    // After 200ms, done — no flip classes
    act(() => { vi.advanceTimersByTime(200); });
    expect(container.querySelector('.card-flip-out')).toBeNull();
    expect(container.querySelector('.card-flip-in')).toBeNull();
    expect(container.querySelector('.card-flip-bounce')).toBeNull();
    expect(container.textContent).toBe('5');
  });

  it('new round resets flip state', () => {
    const { container, rerender } = render(
      <SingleCard data={{ vote: '5' }} phase="voting" playerIndex={0} />
    );
    // Reveal
    rerender(<SingleCard data={{ vote: '5' }} phase="revealed" playerIndex={0} />);
    act(() => { vi.advanceTimersByTime(800); });
    expect(container.textContent).toBe('5');

    // New round
    rerender(<SingleCard data={{ vote: null }} phase="voting" playerIndex={0} />);
    // No card shown (no vote)
    expect(container.querySelector('.card-flip-out')).toBeNull();
  });

  it('stagger delay offsets per playerIndex', () => {
    render(
      <SingleCard data={{ vote: '3' }} phase="voting" playerIndex={0} />
    );
    render(
      <SingleCard data={{ vote: '5' }} phase="voting" playerIndex={1} />
    );

    // Manually trigger phase change by re-rendering (can't share rerender across two renders)
    // Instead, test the stagger with a single card at playerIndex=2
    const { container, rerender } = render(
      <SingleCard data={{ vote: '8' }} phase="voting" playerIndex={2} />
    );
    rerender(<SingleCard data={{ vote: '8' }} phase="revealed" playerIndex={2} />);

    // At 100ms (less than 2*80=160ms stagger), no flip yet
    act(() => { vi.advanceTimersByTime(100); });
    expect(container.querySelector('.card-flip-out')).toBeNull();

    // At 170ms (past 160ms stagger), flip-out should have started
    act(() => { vi.advanceTimersByTime(70); });
    expect(container.querySelector('.card-flip-out')).not.toBeNull();
  });
});

describe('SplitCards — flip animation', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('mounted with phase=revealed shows both votes immediately', () => {
    const { container } = render(
      <SplitCards data={{ voteFe: '3', voteBe: '8' }} phase="revealed" playerIndex={0} />
    );
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('8');
  });
});
