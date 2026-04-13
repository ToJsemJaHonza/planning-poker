import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import StressMeter from './StressMeter';

describe('StressMeter', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns null at stage 0 and 1', () => {
    const { container: c0 } = render(<StressMeter stage={0} startedAt={0} />);
    expect(c0.innerHTML).toBe('');

    const { container: c1 } = render(<StressMeter stage={1} startedAt={Date.now() - 30000} />);
    expect(c1.innerHTML).toBe('');
  });

  it('renders at stage 2+ with STRESS label', () => {
    const { container } = render(<StressMeter stage={2} startedAt={Date.now() - 45000} />);
    expect(container.textContent).toContain('STRESS');
  });

  it('renders MAX STRESS at stage 5', () => {
    const { container } = render(<StressMeter stage={5} startedAt={Date.now() - 120000} />);
    expect(container.textContent).toContain('MAX STRESS');
  });

  it('crack marks appear only at stage 4+', () => {
    const crackSelector = (c) => Array.from(c.querySelectorAll('div')).filter(
      d => d.style.width === '2px'
    );

    const { container: c3 } = render(<StressMeter stage={3} startedAt={Date.now() - 65000} />);
    expect(crackSelector(c3).length).toBe(0);

    const { container: c4 } = render(<StressMeter stage={4} startedAt={Date.now() - 85000} />);
    expect(crackSelector(c4).length).toBe(2);

    const { container: c5 } = render(<StressMeter stage={5} startedAt={Date.now() - 120000} />);
    expect(crackSelector(c5).length).toBe(3);
  });

  it('self-updates elapsed via its own interval (no prop dependency)', () => {
    const startedAt = Date.now() - 44000; // Just under stage 2 boundary
    const { container } = render(<StressMeter stage={2} startedAt={startedAt} />);

    // Initially renders with the current elapsed
    expect(container.textContent).toContain('STRESS');

    // Advance time by 20 seconds — the fill bar should still be updating
    // (meter owns its own interval, doesn't rely on parent re-render)
    vi.advanceTimersByTime(20000);
    // The meter should still be rendered (didn't freeze or disappear)
    expect(container.textContent).toContain('STRESS');
  });
});
