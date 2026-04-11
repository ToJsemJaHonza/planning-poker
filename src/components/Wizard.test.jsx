import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import Wizard from './Wizard';

describe('Wizard — smoke', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mounts without throwing', () => {
    expect(() => render(
      <Wizard isCasting={false} onCastComplete={() => {}} onQuote={null} externalQuote={null} />
    )).not.toThrow();
  });

  it('renders externalQuote text in a bubble when shown', () => {
    // externalQuote takes effect only when onQuote is null (non-leader path).
    const { container } = render(
      <Wizard isCasting={false} onCastComplete={() => {}} onQuote={null} externalQuote="Hello there" />
    );
    // Bubble text lands in the DOM once the position effect runs
    expect(container.textContent).toContain('Hello there');
  });

  // Y7 — one-shot getBoundingClientRect read instead of rAF loop.
  // We spy on Element.prototype.getBoundingClientRect and verify the wizard
  // does NOT call it repeatedly once the bubble mounts (old code ran on every
  // animation frame).
  it('Y7: does not call getBoundingClientRect in a rAF loop', () => {
    const origBCR = Element.prototype.getBoundingClientRect;
    let callCount = 0;
    Element.prototype.getBoundingClientRect = function () {
      callCount += 1;
      return { left: 100, top: 200, width: 50, height: 70, right: 150, bottom: 270, x: 100, y: 200, toJSON: () => ({}) };
    };

    try {
      render(
        <Wizard isCasting={false} onCastComplete={() => {}} onQuote={null} externalQuote="Quoted!" />
      );

      // Flush any immediate microtasks + one animation frame worth of time.
      vi.advanceTimersByTime(50);
      const countAfterMount = callCount;

      // If the old rAF loop were still active, this advance would stack up
      // many additional BCR calls. The new one-shot read should NOT.
      vi.advanceTimersByTime(500);
      const countAfterHalfSec = callCount;

      // Allow at most a couple extra calls (e.g. strict mode double-mount
      // or other library code), but definitely not hundreds.
      expect(countAfterHalfSec - countAfterMount).toBeLessThanOrEqual(2);
    } finally {
      Element.prototype.getBoundingClientRect = origBCR;
    }
  });
});
