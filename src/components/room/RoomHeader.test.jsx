/**
 * RoomHeader — clipboard fallback regression coverage.
 *
 * The fallback modal exists because Safari without HTTPS, locked-down
 * browsers, and older WebKit clients reject `navigator.clipboard.writeText`.
 * Without the fallback users were stranded with "✗ Copy failed" and no
 * way to retrieve the URL. These tests would have failed before the
 * fallback shipped.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import RoomHeader from './RoomHeader';

const ORIGINAL_CLIPBOARD = navigator.clipboard;

function setClipboard(impl) {
  Object.defineProperty(navigator, 'clipboard', {
    value: impl,
    configurable: true,
  });
}

describe('RoomHeader — happy path', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/?room=ABC123');
  });
  afterEach(() => {
    setClipboard(ORIGINAL_CLIPBOARD);
  });

  it('renders room code and player count', () => {
    const { getByText } = render(<RoomHeader roomCode="ABC123" playerCount={3} />);
    expect(getByText(/Room: ABC123/)).toBeTruthy();
    expect(getByText('3 players')).toBeTruthy();
  });

  it('shows "✓ Copied" when navigator.clipboard.writeText resolves', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const { container, getByText } = render(<RoomHeader roomCode="ABC123" playerCount={1} />);
    fireEvent.click(container.querySelector('[data-copy-btn]'));
    await waitFor(() => expect(getByText('✓ Copied')).toBeTruthy());
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('?room=ABC123');
    expect(container.querySelector('[data-clipboard-fallback]')).toBeNull();
  });
});

describe('RoomHeader — clipboard fallback', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/?room=ABC123');
  });
  afterEach(() => {
    setClipboard(ORIGINAL_CLIPBOARD);
  });

  it('opens the fallback modal when navigator.clipboard is undefined', async () => {
    setClipboard(undefined);
    const { container, getByText } = render(<RoomHeader roomCode="ABC123" playerCount={2} />);
    await act(async () => {
      fireEvent.click(container.querySelector('[data-copy-btn]'));
    });
    expect(container.querySelector('[data-clipboard-fallback]')).not.toBeNull();
    expect(getByText(/Copy this link/)).toBeTruthy();
    const input = container.querySelector('[data-clipboard-fallback-input]');
    expect(input).not.toBeNull();
    expect(input.value).toContain('?room=ABC123');
    expect(input.readOnly).toBe(true);
  });

  it('opens the fallback modal when writeText rejects (Safari/no-HTTPS)', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    setClipboard({ writeText });
    const { container } = render(<RoomHeader roomCode="ABC123" playerCount={1} />);
    await act(async () => {
      fireEvent.click(container.querySelector('[data-copy-btn]'));
    });
    await waitFor(() =>
      expect(container.querySelector('[data-clipboard-fallback]')).not.toBeNull(),
    );
    const input = container.querySelector('[data-clipboard-fallback-input]');
    expect(input.value).toContain('?room=ABC123');
  });

  it('closes when the close button is clicked', async () => {
    setClipboard(undefined);
    const { container } = render(<RoomHeader roomCode="ABC123" playerCount={1} />);
    await act(async () => {
      fireEvent.click(container.querySelector('[data-copy-btn]'));
    });
    expect(container.querySelector('[data-clipboard-fallback]')).not.toBeNull();
    fireEvent.click(container.querySelector('[data-clipboard-fallback-close]'));
    expect(container.querySelector('[data-clipboard-fallback]')).toBeNull();
  });

  it('closes when the overlay backdrop is clicked but not the modal body', async () => {
    setClipboard(undefined);
    const { container } = render(<RoomHeader roomCode="ABC123" playerCount={1} />);
    await act(async () => {
      fireEvent.click(container.querySelector('[data-copy-btn]'));
    });
    // Click on the inner modal — should NOT close.
    fireEvent.click(container.querySelector('[data-clipboard-fallback-modal]'));
    expect(container.querySelector('[data-clipboard-fallback]')).not.toBeNull();
    // Click on the overlay (outside the modal) — closes.
    fireEvent.click(container.querySelector('[data-clipboard-fallback]'));
    expect(container.querySelector('[data-clipboard-fallback]')).toBeNull();
  });
});
