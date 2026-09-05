import { act, render, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { useGridLayout } from './useGridLayout';
import { usePlayerDirector } from './usePlayerDirector';
import { createStageRuntime } from './useCharacterStage';

describe('measured player layout', () => {
  it('follows measured slots when split mode or header height changes', () => {
    const stage = createStageRuntime();
    const players = { alice: { name: 'Alice', role: 'player', joinedAt: 1 } };
    stage.updateLayout(new Map([['alice', { x: 440, y: 250 }]]), null);
    renderHook(() => usePlayerDirector({ stage, players }));
    expect(stage.get('player-alice').position).toEqual({ x: 440, y: 250 });
    act(() => stage.updateLayout(new Map([['alice', { x: 440, y: 300 }]]), null));
    act(() => { stage.tick(0); stage.tick(4000); });
    expect(stage.get('player-alice').position).toEqual({ x: 440, y: 300 });
    const version = stage.getLayoutVersion();
    stage.updateLayout(new Map([['alice', { x: 440, y: 300 }]]), null);
    expect(stage.getLayoutVersion()).toBe(version);
  });

  it('measures the actual placeholder and keeps PM above the card picker', () => {
    const stage = createStageRuntime();
    function Fixture() {
      const gridRef = useRef(null);
      useGridLayout(stage, gridRef);
      return <div data-room>
        <div ref={gridRef}><div data-figure-placeholder="alice" ref={el => {
          if (el) el.getBoundingClientRect = () => ({ x: 400, y: 220, width: 50, height: 100 });
        }} /></div>
        <div data-split-picker ref={el => {
          if (el) el.getBoundingClientRect = () => ({ top: 600 });
        }} />
      </div>;
    }
    render(<Fixture />);
    expect(stage.getSlot('alice')).toEqual({ x: 425, y: 270 });
    expect(stage.groundY).toBe(553);
  });
});
