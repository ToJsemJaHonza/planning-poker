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

  it('join form normalizes the code to uppercase and calls onJoinRoom with empty initial tasks', async () => {
    const user = userEvent.setup();
    const onJoinRoom = vi.fn();
    render(<Landing playerName="Alice" onJoinRoom={onJoinRoom} />);

    await user.type(screen.getByPlaceholderText(/code/i), 'abcdef');
    await user.click(screen.getByRole('button', { name: /join/i }));

    expect(onJoinRoom).toHaveBeenCalledWith('ABCDEF', 'player', []);
  });
});

describe('Landing — task-entry step (both roles)', () => {
  async function openTaskEntryFor(user, role) {
    const onJoinRoom = vi.fn();
    render(<Landing playerName="Alice" onJoinRoom={onJoinRoom} />);
    await user.click(screen.getByRole('button', { name: /create room/i }));
    const roleBtn = role === 'pm'
      ? screen.getByRole('button', { name: /manager/i })
      : screen.getByRole('button', { name: /player/i });
    await user.click(roleBtn);
    return onJoinRoom;
  }

  it('Manager pick reveals the task-entry card with a Start grooming action', async () => {
    const user = userEvent.setup();
    const { container } = render(<Landing playerName="Alice" onJoinRoom={() => {}} />);
    await user.click(screen.getByRole('button', { name: /create room/i }));
    await user.click(screen.getByRole('button', { name: /manager/i }));

    expect(container.querySelector('[data-task-entry]')).not.toBeNull();
    expect(container.querySelectorAll('[data-task-row]').length).toBe(1);
    expect(screen.getByRole('button', { name: /start grooming/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
  });

  it('Player pick ALSO reveals the task-entry card (Player-as-creator can seed a backlog)', async () => {
    const user = userEvent.setup();
    const { container } = render(<Landing playerName="Alice" onJoinRoom={() => {}} />);
    await user.click(screen.getByRole('button', { name: /create room/i }));
    await user.click(screen.getByRole('button', { name: /player/i }));

    expect(container.querySelector('[data-task-entry]')).not.toBeNull();
    expect(screen.getByRole('button', { name: /start grooming/i })).toBeInTheDocument();
  });

  it('Manager Skip calls onJoinRoom with role=pm and empty tasks', async () => {
    const user = userEvent.setup();
    const onJoinRoom = await openTaskEntryFor(user, 'pm');
    await user.click(screen.getByRole('button', { name: /skip/i }));

    expect(onJoinRoom).toHaveBeenCalledTimes(1);
    const [code, role, tasks] = onJoinRoom.mock.calls[0];
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(role).toBe('pm');
    expect(tasks).toEqual([]);
  });

  it('Player Skip calls onJoinRoom with role=player and empty tasks', async () => {
    const user = userEvent.setup();
    const onJoinRoom = await openTaskEntryFor(user, 'player');
    await user.click(screen.getByRole('button', { name: /skip/i }));

    expect(onJoinRoom).toHaveBeenCalledTimes(1);
    const [code, role, tasks] = onJoinRoom.mock.calls[0];
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(role).toBe('player');
    expect(tasks).toEqual([]);
  });

  it('Manager Start grooming passes normalized rows to onJoinRoom', async () => {
    const user = userEvent.setup();
    const onJoinRoom = await openTaskEntryFor(user, 'pm');

    const titleInputs = () => document.querySelectorAll('[data-task-title-input]');
    const urlInputs = () => document.querySelectorAll('[data-task-url-input]');

    await user.type(titleInputs()[0], 'RAFSL-1');
    await user.type(urlInputs()[0], 'https://j/1');
    await user.click(screen.getByRole('button', { name: /add row/i }));
    await user.type(titleInputs()[1], 'RAFSL-2');
    // Relaxed URL — bare domain auto-becomes https:// on save.
    await user.type(urlInputs()[1], 'seznam.cz');

    await user.click(screen.getByRole('button', { name: /start grooming/i }));

    expect(onJoinRoom).toHaveBeenCalledTimes(1);
    const [, role, tasks] = onJoinRoom.mock.calls[0];
    expect(role).toBe('pm');
    expect(tasks).toEqual([
      { title: 'RAFSL-1', url: 'https://j/1' },
      { title: 'RAFSL-2', url: 'https://seznam.cz' },
    ]);
  });

  it('Player Start grooming passes role=player + normalized rows', async () => {
    const user = userEvent.setup();
    const onJoinRoom = await openTaskEntryFor(user, 'player');

    const titleInputs = document.querySelectorAll('[data-task-title-input]');
    await user.type(titleInputs[0], 'Design spec');

    await user.click(screen.getByRole('button', { name: /start grooming/i }));

    expect(onJoinRoom).toHaveBeenCalledTimes(1);
    const [, role, tasks] = onJoinRoom.mock.calls[0];
    expect(role).toBe('player');
    expect(tasks).toEqual([{ title: 'Design spec', url: null }]);
  });

  it('empty-title rows are filtered out on Start grooming', async () => {
    const user = userEvent.setup();
    const onJoinRoom = await openTaskEntryFor(user, 'pm');

    await user.click(screen.getByRole('button', { name: /add row/i }));
    const titleInputs = document.querySelectorAll('[data-task-title-input]');
    await user.type(titleInputs[1], 'Real');

    await user.click(screen.getByRole('button', { name: /start grooming/i }));
    const tasks = onJoinRoom.mock.calls[0][2];
    expect(tasks).toEqual([{ title: 'Real', url: null }]);
  });
});
