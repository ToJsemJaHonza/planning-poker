import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Landing from './Landing';

describe('Landing — create + join', () => {
  it('renders Create Room and a join form', () => {
    render(<Landing playerName="Alice" onJoinRoom={() => {}} />);
    expect(screen.getByRole('button', { name: /create room/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument();
  });

  it('clicking Create Room reveals the Player / Manager role picker', async () => {
    const user = userEvent.setup();
    render(<Landing playerName="Alice" onJoinRoom={() => {}} />);

    await user.click(screen.getByRole('button', { name: /create room/i }));

    expect(screen.getByRole('button', { name: /player/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manager/i })).toBeInTheDocument();
  });

  it('Join button is disabled when the code input is empty', () => {
    render(<Landing playerName="Alice" onJoinRoom={() => {}} />);
    expect(screen.getByRole('button', { name: /join/i })).toBeDisabled();
  });

  it('join form normalizes the code to uppercase and calls onJoinRoom', async () => {
    const user = userEvent.setup();
    const onJoinRoom = vi.fn();
    render(<Landing playerName="Alice" onJoinRoom={onJoinRoom} />);

    await user.type(screen.getByPlaceholderText(/code/i), 'abcdef');
    await user.click(screen.getByRole('button', { name: /join/i }));

    expect(onJoinRoom).toHaveBeenCalledWith('ABCDEF', 'player');
  });
});
