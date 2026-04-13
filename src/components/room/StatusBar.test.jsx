import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import StatusBar from './StatusBar';

describe('StatusBar — celebration', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('allVotedClean=true adds .status-bar--celebrate class', () => {
    const { container } = render(
      <StatusBar phase="voting" votedCount={3} playerCount={3} allVotedClean={true} />
    );
    expect(container.querySelector('.status-bar--celebrate')).not.toBeNull();
  });

  it('allVotedClean=false shows "Everyone voted!" text but no celebrate class', () => {
    const { container } = render(
      <StatusBar phase="voting" votedCount={3} playerCount={3} allVotedClean={false} />
    );
    expect(container.textContent).toContain('Everyone voted!');
    expect(container.querySelector('.status-bar--celebrate')).toBeNull();
  });

  it('sparkle particles only render during celebration', () => {
    const { container, rerender } = render(
      <StatusBar phase="voting" votedCount={2} playerCount={3} allVotedClean={false} />
    );
    expect(container.querySelector('.sparkle-burst')).toBeNull();

    rerender(
      <StatusBar phase="voting" votedCount={3} playerCount={3} allVotedClean={true} />
    );
    expect(container.querySelector('.sparkle-burst')).not.toBeNull();
  });

  it('shows "Results revealed" when phase is revealed', () => {
    const { container } = render(
      <StatusBar phase="revealed" votedCount={3} playerCount={3} allVotedClean={false} />
    );
    expect(container.textContent).toContain('Results revealed');
  });
});
