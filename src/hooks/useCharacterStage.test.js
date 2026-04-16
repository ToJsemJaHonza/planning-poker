import { describe, it, expect, beforeEach } from 'vitest';
import { createStageRuntime } from './useCharacterStage';

describe('createStageRuntime', () => {
  let stage;
  beforeEach(() => {
    stage = createStageRuntime();
  });

  it('starts empty', () => {
    expect(stage.size()).toBe(0);
    expect(stage.all()).toEqual([]);
    expect(stage.getVersion()).toBe(0);
  });

  it('add creates a character, bumps version, and makes it queryable', () => {
    const char = stage.add({ id: 'pm', sprite: 'pm', position: { x: 10, y: 20 } });
    expect(char.id).toBe('pm');
    expect(stage.size()).toBe(1);
    expect(stage.has('pm')).toBe(true);
    expect(stage.get('pm')).toBe(char);
    expect(stage.getVersion()).toBe(1);
  });

  it('add is idempotent — second add with same id returns existing', () => {
    const a = stage.add({ id: 'p', sprite: 'player', position: { x: 0, y: 0 } });
    const b = stage.add({ id: 'p', sprite: 'player', position: { x: 999, y: 999 } });
    expect(a).toBe(b);
    expect(stage.size()).toBe(1);
    expect(a.position).toEqual({ x: 0, y: 0 }); // original wins; teleport to move
  });

  it('ensure creates on first call, returns existing on next', () => {
    const a = stage.ensure({ id: 'x', sprite: 'player' });
    const b = stage.ensure({ id: 'x', sprite: 'player' });
    expect(a).toBe(b);
    expect(stage.size()).toBe(1);
  });

  it('remove deletes and bumps version', () => {
    stage.add({ id: 'pm', sprite: 'pm' });
    const v0 = stage.getVersion();
    stage.remove('pm');
    expect(stage.has('pm')).toBe(false);
    expect(stage.getVersion()).toBeGreaterThan(v0);
  });

  it('subscribe → notify fires listeners on structural and tick changes', () => {
    let calls = 0;
    const unsub = stage.subscribe(() => calls++);
    stage.add({ id: 'a', sprite: 'pm' });
    stage.tick(16);
    stage.tick(32);
    unsub();
    stage.tick(48); // should not fire after unsub
    expect(calls).toBe(3);
  });

  it('tick advances every character in the map', () => {
    const a = stage.add({ id: 'a', sprite: 'pm', position: { x: 0, y: 0 } });
    const b = stage.add({ id: 'b', sprite: 'player', position: { x: 100, y: 0 } });
    a.walkTo({ x: 500, y: 0, duration: 1000 });
    b.walkTo({ x: 0, y: 0, duration: 1000 });
    stage.tick(0);
    stage.tick(1000);
    expect(a.position).toEqual({ x: 500, y: 0 });
    expect(b.position).toEqual({ x: 0, y: 0 });
  });

  it('clear empties the map and bumps version once', () => {
    stage.add({ id: 'a', sprite: 'pm' });
    stage.add({ id: 'b', sprite: 'player' });
    const v = stage.getVersion();
    stage.clear();
    expect(stage.size()).toBe(0);
    expect(stage.getVersion()).toBe(v + 1);
    // No-op clear on empty doesn't bump
    const v2 = stage.getVersion();
    stage.clear();
    expect(stage.getVersion()).toBe(v2);
  });

  it('listener throwing does not break other listeners or the notify', () => {
    let a = 0;
    let b = 0;
    stage.subscribe(() => {
      a++;
      throw new Error('boom');
    });
    stage.subscribe(() => {
      b++;
    });
    stage.tick(0);
    expect(a).toBe(1);
    expect(b).toBe(1);
  });
});
