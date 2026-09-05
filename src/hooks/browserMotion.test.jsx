import { act, renderHook, render, fireEvent } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createStageRuntime, useCharacterStage } from './useCharacterStage';
import { usePlayerDirector } from './usePlayerDirector';
import { useEntranceDirector } from '../events/useEntranceDirector';
import { setMotionMode } from '../engine/motionProbe';
import { SingleCard, SplitCards } from '../components/player/VotingCards';
import { readPreference, savePreference } from '../engine/storage';
import { resultDelay } from '../engine/cardReveal';
import { useEventTimeline } from '../engine/useEventTimeline';
import { __testing__ as motion } from '../engine/MotionRuntime';

beforeEach(() => { setMotionMode('full'); sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); setMotionMode('full'); });
const roster = () => ({ alice: { name: 'Alice', joinedAt: Date.now() - 60000, role: 'player' } });

describe('browser motion regressions', () => {
  it('uses real layout coordinates and reacts to a changed layout without a roster change', () => {
    const stage = createStageRuntime();
    stage.updateLayout(new Map([['alice', { x: 123, y: 234 }]]), 600);
    renderHook(() => usePlayerDirector({ stage, players: roster() }));
    expect(stage.get('player-alice').position).toEqual({ x: 123, y: 234 });
    act(() => stage.updateLayout(new Map([['alice', { x: 180, y: 280 }]]), 600));
    act(() => { stage.tick(0); stage.tick(3001); });
    expect(stage.get('player-alice').position).toEqual({ x: 180, y: 280 });
  });

  it('scroll shifts a walking figure and its path together, without restarting the walk', () => {
    const stage = createStageRuntime();
    const char = stage.add({ id: 'player-alice', sprite: 'player', position: { x: 10, y: 400 } });
    stage.updateLayout(new Map([['alice', { x: 100, y: 400 }]]), 600);
    char.walkTo({ x: 100, y: 400, duration: 1000 });
    stage.tick(0); stage.tick(400);
    const x = char.position.x;
    stage.updateLayout(new Map([['alice', { x: 100, y: 300 }]]), 600, -100);
    expect(char.position).toEqual({ x, y: 300 });
    expect(char.action.startedAt).toBe(0);
    stage.tick(1000);
    expect(char.position).toEqual({ x: 100, y: 300 });
  });

  it('returning mid-departure cancels the pending removal even at the old slot', () => {
    const stage = createStageRuntime();
    const players = roster();
    const { rerender } = renderHook(({ players }) => usePlayerDirector({ stage, players }), { initialProps: { players } });
    rerender({ players: {} });
    rerender({ players });
    act(() => { stage.tick(0); stage.tick(20000); });
    expect(stage.has('player-alice')).toBe(true);
    expect(stage.get('player-alice').leaving).toBe(false);
  });

  it('reduced motion settles fresh joins and removes departing players immediately', () => {
    setMotionMode('reduced');
    const stage = createStageRuntime();
    stage.updateLayout(new Map([['alice', { x: 200, y: 250 }]]), 500);
    const players = { alice: { name: 'Alice', joinedAt: Date.now(), role: 'player' } };
    const { rerender } = renderHook(({ players }) => usePlayerDirector({ stage, players }), { initialProps: { players } });
    expect(stage.get('player-alice').position).toEqual({ x: 200, y: 250 });
    expect(stage.get('player-alice').queue).toHaveLength(0);
    rerender({ players: {} });
    expect(stage.has('player-alice')).toBe(false);
  });

  it('an outgoing leader returning after coronation cancels the ceremonial walk-off removal', () => {
    const stage = createStageRuntime();
    const alice = roster().alice;
    const bob = { name: 'Bob', role: 'player', joinedAt: alice.joinedAt + 1 };
    const ceremony = { outgoingLeaderId: 'alice', outgoingLeaderLastData: alice };
    const { rerender } = renderHook(props => usePlayerDirector({ stage, ...props }), {
      initialProps: { players: { alice, bob }, pmRoulette: ceremony },
    });
    rerender({ players: { bob }, pmRoulette: null });
    expect(stage.get('player-alice').leaving).toBe(true);
    rerender({ players: { alice, bob }, pmRoulette: null });
    act(() => { stage.tick(0); stage.tick(20000); });
    expect(stage.has('player-alice')).toBe(true);
  });

  it('cinematic handoff remains visible and keeps its completion callback across roster updates', () => {
    const stage = createStageRuntime();
    const players = roster();
    const hiddenPlayers = new Set(['alice']);
    const markArrived = vi.fn();
    const director = renderHook(({ players }) => usePlayerDirector({ stage, players, hiddenPlayers }), { initialProps: { players } });
    const entrance = renderHook(() => useEntranceDirector({ stage, players, markArrived }));
    entrance.result.current.walkFromDoor({ playerId: 'alice', door: { x: 0, y: 600 }, duration: 1000 });
    act(() => stage.tick(0));
    director.rerender({ players: { alice: { ...players.alice, vote: '8' } } });
    expect(stage.get('player-alice').hidden).toBe(false);
    act(() => stage.tick(1000));
    expect(markArrived).toHaveBeenCalledOnce();
  });

  it('animation ticks do not rerender the room hosting the stage', () => {
    let renders = 0;
    const { result } = renderHook(() => { renders++; return useCharacterStage(); });
    const before = renders;
    act(() => { result.current.tick(0); result.current.tick(16); result.current.tick(32); });
    expect(renders).toBe(before);
  });

  it.each(['reduced', 'none'])('%s motion reveals cards immediately', mode => {
    setMotionMode(mode);
    const { container, rerender } = render(<SingleCard data={{ vote: '8' }} phase="voting" />);
    rerender(<SingleCard data={{ vote: '8' }} phase="revealed" />);
    expect(container.textContent).toBe('8');
    expect(container.querySelector('.card-flip-out')).toBeNull();
  });

  it('a throttled reveal catches up from wall time on visibility change', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<SingleCard data={{ vote: '8' }} phase="voting" />);
    rerender(<SingleCard data={{ vote: '8' }} phase="revealed" />);
    vi.setSystemTime(Date.now() + 10000);
    fireEvent(document, new Event('visibilitychange'));
    expect(container.textContent).toBe('8');
    expect(container.querySelector('[class^="card-flip-"] > .card-flip-out')).toBeNull();
  });

  it('a new round cancels every pending reveal deadline', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<SingleCard data={{ vote: '8' }} phase="voting" playerIndex={5} />);
    rerender(<SingleCard data={{ vote: '8' }} phase="revealed" playerIndex={5} />);
    rerender(<SingleCard data={{ vote: '3' }} phase="voting" playerIndex={5} />);
    act(() => vi.advanceTimersByTime(2000));
    expect(container.textContent).toBe('?');
    expect(container.querySelector('.card-flip-in, .card-flip-out')).toBeNull();
  });

  it('the last flip timer settles even when the browser wall clock is behind its deadline', () => {
    vi.useFakeTimers();
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const { container, rerender } = render(<SingleCard data={{ vote: '8' }} phase="voting" />);
    rerender(<SingleCard data={{ vote: '8' }} phase="revealed" />);
    act(() => vi.advanceTimersByTime(1200));
    expect(container.textContent).toBe('8');
    expect(container.querySelector('.card-flip-out, .card-flip-in, .card-flip-bounce')).toBeNull();
  });

  it('split cards reserve the same vertical space as a single card', () => {
    const single = render(<SingleCard data={{}} phase="voting" />);
    const split = render(<SplitCards data={{}} phase="voting" />);
    expect(single.container.firstChild.style.height).toBe(split.container.firstChild.style.height);
  });

  it('modal delay waits for the final flip but stays bounded for a large team', () => {
    expect(resultDelay(30, true, 'full')).toBe(1300);
    expect(resultDelay(1, false, 'full')).toBe(800);
    expect(resultDelay(30, true, 'reduced')).toBe(0);
  });

  it('late cinematic observers start from the shared timestamp and finish once', () => {
    vi.useFakeTimers();
    const onTime = vi.fn();
    const { result } = renderHook(() => useEventTimeline(Date.now() - 5000, 10000, onTime));
    expect(result.current).toBe(5000);
    vi.setSystemTime(Date.now() + 10000);
    act(() => motion.forceTick());
    expect(result.current).toBe(10000);
  });

  it('blocked storage remains optional for startup and name saving', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    expect(readPreference('name', 'fallback')).toBe('fallback');
    expect(() => savePreference('name', 'Alice')).not.toThrow();
    expect(() => savePreference('name', null)).not.toThrow();
  });
});
