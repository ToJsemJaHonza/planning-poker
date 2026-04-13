import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import PhaseBar from './PhaseBar';

describe('PhaseBar — reveal button pulse', () => {
  it('reveal button gets .reveal-btn--pulse when allVotedClean=true', () => {
    const { container } = render(
      <PhaseBar
        phase="voting" splitMode={false}
        votedCount={3} playerCount={3}
        canControl={true} allVotedClean={true}
        onToggleSplit={() => {}} onReveal={() => {}} onNewRound={() => {}}
      />
    );
    expect(container.querySelector('.reveal-btn--pulse')).not.toBeNull();
  });

  it('reveal button has NO pulse when allVotedClean=false', () => {
    const { container } = render(
      <PhaseBar
        phase="voting" splitMode={false}
        votedCount={3} playerCount={3}
        canControl={true} allVotedClean={false}
        onToggleSplit={() => {}} onReveal={() => {}} onNewRound={() => {}}
      />
    );
    expect(container.querySelector('.reveal-btn--pulse')).toBeNull();
  });

  it('non-leader does not see reveal button at all', () => {
    const { container } = render(
      <PhaseBar
        phase="voting" splitMode={false}
        votedCount={3} playerCount={3}
        canControl={false} allVotedClean={true}
        onToggleSplit={() => {}} onReveal={() => {}} onNewRound={() => {}}
      />
    );
    expect(container.querySelector('button')).toBeNull();
  });
});
