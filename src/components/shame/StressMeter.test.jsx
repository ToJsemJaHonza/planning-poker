import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import StressMeter from './StressMeter';

describe('StressMeter', () => {
  it('returns null at stage 0 and 1', () => {
    const { container: c0 } = render(<StressMeter stage={0} elapsed={0} />);
    expect(c0.innerHTML).toBe('');

    const { container: c1 } = render(<StressMeter stage={1} elapsed={30000} />);
    expect(c1.innerHTML).toBe('');
  });

  it('renders at stage 2+ with STRESS label', () => {
    const { container } = render(<StressMeter stage={2} elapsed={45000} />);
    expect(container.textContent).toContain('STRESS');
  });

  it('renders MAX STRESS at stage 5', () => {
    const { container } = render(<StressMeter stage={5} elapsed={120000} />);
    expect(container.textContent).toContain('MAX STRESS');
  });

  it('crack marks appear only at stage 4+', () => {
    const { container: c3 } = render(<StressMeter stage={3} elapsed={65000} />);
    // Cracks use position:absolute style with specific left values
    const cracks3 = c3.querySelectorAll('[style*="position: absolute"]');
    // At stage 3, the bar fill is absolute positioned but no crack divs
    // Cracks are small 2px wide divs — filter by width
    const crackDivs3 = Array.from(c3.querySelectorAll('div')).filter(
      d => d.style.width === '2px'
    );
    expect(crackDivs3.length).toBe(0);

    const { container: c4 } = render(<StressMeter stage={4} elapsed={85000} />);
    const crackDivs4 = Array.from(c4.querySelectorAll('div')).filter(
      d => d.style.width === '2px'
    );
    expect(crackDivs4.length).toBe(2);

    const { container: c5 } = render(<StressMeter stage={5} elapsed={120000} />);
    const crackDivs5 = Array.from(c5.querySelectorAll('div')).filter(
      d => d.style.width === '2px'
    );
    expect(crackDivs5.length).toBe(3);
  });
});
