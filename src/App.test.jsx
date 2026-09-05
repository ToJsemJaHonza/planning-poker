import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from './App';

vi.mock('./components/Room', () => ({ default: ({ role, roomCode }) => <div>{roomCode}: {role}</div> }));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('poker-player-name', 'Alex');
  window.history.replaceState({}, '', '/?room=INVITE');
});

it('opens invitations as a player even if a previous room saved Manager', () => {
  localStorage.setItem('poker-role', 'pm');
  render(<App />);
  expect(screen.getByText('INVITE: player')).toBeInTheDocument();
});

it('resets the creator role when navigating to another room', () => {
  window.history.replaceState({}, '', '/');
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Create Room' }));
  fireEvent.click(screen.getByRole('button', { name: /Manager/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  expect(screen.getByText(/: pm$/)).toBeInTheDocument();
  act(() => {
    window.history.pushState({}, '', '/?room=INVITE');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(screen.getByText('INVITE: player')).toBeInTheDocument();
});
