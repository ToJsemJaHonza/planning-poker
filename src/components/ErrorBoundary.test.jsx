import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from './ErrorBoundary';

function Boom() {
  throw new Error('child exploded');
}

describe('ErrorBoundary', () => {
  // React logs the error to console during testing; silence the noise so the
  // test output stays clean, but keep the real spy so we can assert on it.
  let errSpy;
  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errSpy.mockRestore();
  });

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('catches a thrown error and shows the fallback UI', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    expect(screen.getByText(/something broke/i)).toBeInTheDocument();
    expect(screen.getByText(/child exploded/)).toBeInTheDocument();
  });

  it('logs the error to console.error so users can share it', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    // React itself + our own log = at least one "[ErrorBoundary]" call
    const ourCall = errSpy.mock.calls.find(c => String(c[0]).includes('[ErrorBoundary]'));
    expect(ourCall).toBeDefined();
  });

  it('"Try again" button clears the error and rerenders children', async () => {
    let shouldThrow = true;
    function Toggle() {
      if (shouldThrow) throw new Error('bad');
      return <div data-testid="recovered">ok</div>;
    }
    const { rerender } = render(
      <ErrorBoundary>
        <Toggle />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();

    // Simulate the user fixing the condition then clicking "Try again"
    shouldThrow = false;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    // Force a re-render so our boundary re-tries its children
    rerender(
      <ErrorBoundary>
        <Toggle />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('recovered')).toBeInTheDocument();
  });
});
