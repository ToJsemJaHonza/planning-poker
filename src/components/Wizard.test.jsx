import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    const { container } = render(
      <Wizard isCasting={false} onCastComplete={() => {}} onQuote={null} externalQuote="Hello there" />
    );
    expect(container.textContent).toContain('Hello there');
  });
});

describe('Wizard idle positioning (JS-driven)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('renders with data-wizard-idle attribute, not .wizard-walk CSS class', () => {
    const { container } = render(
      <Wizard isCasting={false} position={{ x: 100, y: 500 }} facingLeft={false} />
    );
    expect(container.querySelector('[data-wizard-idle]')).toBeTruthy();
    expect(container.querySelector('.wizard-walk')).toBeNull();
  });

  it('positions via transform: translate() for GPU compositing', () => {
    const { container } = render(
      <Wizard isCasting={false} position={{ x: 200, y: 400 }} facingLeft={false} />
    );
    const el = container.querySelector('[data-wizard-idle]');
    expect(el.style.transform).toBe('translate(200px, 400px)');
    expect(el.style.position).toBe('fixed');
  });

  it('flips sprite via inner container scaleX, not outer', () => {
    const { container } = render(
      <Wizard isCasting={false} position={{ x: 100, y: 500 }} facingLeft={true} />
    );
    const outer = container.querySelector('[data-wizard-idle]');
    // Outer uses translate only, no scaleX
    expect(outer.style.transform).not.toContain('scaleX');
    // Inner has the flip
    const inner = outer.children[0];
    expect(inner.style.transform).toBe('scaleX(-1)');
  });
});

describe('Wizard speech bubble centering and flip', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('bubble uses float animation for centering (not inline translateX)', () => {
    render(
      <Wizard isCasting={false} position={{ x: 100, y: 500 }} facingLeft={false}
        externalQuote="Quick sync anyone?" />
    );
    const bubble = screen.getByText("Quick sync anyone?").closest('div');
    expect(bubble.style.animation).toContain('float');
    // No inline transform that would conflict with the float animation
    expect(bubble.style.transform).toBe('');
  });

  it('when facing left, text is in scaleX(-1) span to stay readable', () => {
    render(
      <Wizard isCasting={false} position={{ x: 100, y: 500 }} facingLeft={true}
        externalQuote="Per my last email..." />
    );
    const span = screen.getByText("Per my last email...");
    expect(span.tagName).toBe('SPAN');
    expect(span.style.transform).toBe('scaleX(-1)');
    expect(span.style.display).toBe('inline-block');
  });

  it('when facing right, text span has no transform', () => {
    render(
      <Wizard isCasting={false} position={{ x: 100, y: 500 }} facingLeft={false}
        externalQuote="Action items!" />
    );
    const span = screen.getByText("Action items!");
    expect(span.tagName).toBe('SPAN');
    expect(span.style.transform).toBe('');
  });
});
