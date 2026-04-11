import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NamePrompt from './NamePrompt';

describe('NamePrompt — name validation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('submits a clean name through onSubmit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<NamePrompt onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText(/your name/i), 'Honza');
    await user.click(screen.getByRole('button', { name: /enter/i }));

    expect(onSubmit).toHaveBeenCalledWith('Honza');
    expect(localStorage.getItem('poker-player-name')).toBe('Honza');
  });

  it('strips Firebase-unsafe characters from the name', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<NamePrompt onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText(/your name/i), 'R.I.C.H.A.R.D');
    await user.click(screen.getByRole('button', { name: /enter/i }));

    expect(onSubmit).toHaveBeenCalledWith('RICHARD');
  });

  it('strips $, #, [, ], / but keeps Unicode letters', async () => {
    // userEvent.type treats `[`, `{`, `/` as keyboard descriptors — bypass it
    // by setting the value directly and firing the React change event instead.
    const onSubmit = vi.fn();
    render(<NamePrompt onSubmit={onSubmit} />);

    const input = screen.getByPlaceholderText(/your name/i);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Pepa$#[]/');
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /enter/i }));

    expect(onSubmit).toHaveBeenCalledWith('Pepa');
  });

  it('does NOT call onSubmit for names that sanitize to empty', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<NamePrompt onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText(/your name/i), '...');
    await user.click(screen.getByRole('button', { name: /enter/i }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('enforces a maxLength of 20 on the input itself', () => {
    render(<NamePrompt onSubmit={() => {}} />);
    const input = screen.getByPlaceholderText(/your name/i);
    expect(input).toHaveAttribute('maxlength', '20');
  });

  it('disables the Enter button when input is empty', () => {
    render(<NamePrompt onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: /enter/i })).toBeDisabled();
  });

  // B2 — hint + disabled state for unsafe-only input
  it('B2: dots-only input disables button, shows hint, submit is a no-op', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<NamePrompt onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText(/your name/i), '...');

    expect(screen.getByRole('button', { name: /enter/i })).toBeDisabled();
    expect(screen.getByTestId('name-hint')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /enter/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('B2: $$$ input disables + shows hint', async () => {
    const onSubmit = vi.fn();
    render(<NamePrompt onSubmit={onSubmit} />);

    const input = screen.getByPlaceholderText(/your name/i);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '$$$');
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(screen.getByRole('button', { name: /enter/i })).toBeDisabled();
    expect(screen.getByTestId('name-hint')).toBeInTheDocument();
  });

  it('B2: R.I.C.H.A.R.D → button enabled, submits "RICHARD"', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<NamePrompt onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText(/your name/i), 'R.I.C.H.A.R.D');

    const btn = screen.getByRole('button', { name: /enter/i });
    expect(btn).not.toBeDisabled();
    expect(screen.queryByTestId('name-hint')).not.toBeInTheDocument();

    await user.click(btn);
    expect(onSubmit).toHaveBeenCalledWith('RICHARD');
  });

  it('B2: whitespace-only input disables, hint stays hidden', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<NamePrompt onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText(/your name/i), '   ');

    expect(screen.getByRole('button', { name: /enter/i })).toBeDisabled();
    expect(screen.queryByTestId('name-hint')).not.toBeInTheDocument();
  });
});
