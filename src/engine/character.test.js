import { describe, it, expect } from 'vitest';
import {
  createCharacter,
  tickCharacter,
  tickAll,
  startAction,
  interrupt,
  teleport,
  ACTION_TYPES,
} from './character';
import { WALK_FRAME_MS } from './animation';

const mk = (overrides = {}) =>
  createCharacter({ id: 't', sprite: 'pm', position: { x: 0, y: 100 }, ...overrides });

describe('createCharacter', () => {
  it('requires an id', () => {
    expect(() => createCharacter({ sprite: 'pm' })).toThrow(/id is required/);
  });

  it('rejects unknown sprite types', () => {
    expect(() => createCharacter({ id: 'a', sprite: 'spaceship' })).toThrow(/sprite/);
  });

  it('defaults position, facing, pose, queue, action', () => {
    const c = createCharacter({ id: 'a', sprite: 'pm' });
    expect(c.position).toEqual({ x: 0, y: 0 });
    expect(c.facingLeft).toBe(false);
    expect(c.pose).toBe('walk1');
    expect(c.action).toBeNull();
    expect(c.queue).toEqual([]);
  });

  it('exposes chainable method helpers', () => {
    const c = mk();
    c.walkTo({ x: 200, y: 100, duration: 1000 });
    expect(c.queue).toHaveLength(1);
    expect(c.queue[0]).toMatchObject({ type: ACTION_TYPES.WALK_TO, x: 200 });
  });
});

describe('startAction — the anti-handoff invariant', () => {
  it('binds from to the live position, not any earlier snapshot', () => {
    const c = mk({ position: { x: 42, y: 100 } });
    c.position.x = 137; // simulate another tick moving the character
    startAction(c, { type: ACTION_TYPES.WALK_TO, x: 500, y: 100, duration: 1000 }, 0);
    expect(c.action.from).toEqual({ x: 137, y: 100 });
  });

  it('auto-flips facing based on target x delta', () => {
    const c = mk({ position: { x: 200, y: 100 }, facingLeft: false });
    startAction(c, { type: ACTION_TYPES.WALK_TO, x: 50, y: 100, duration: 500 }, 0);
    expect(c.facingLeft).toBe(true);

    const c2 = mk({ position: { x: 0, y: 100 }, facingLeft: true });
    startAction(c2, { type: ACTION_TYPES.WALK_TO, x: 500, y: 100, duration: 500 }, 0);
    expect(c2.facingLeft).toBe(false);
  });

  it('honors autoFlip:false (director keeps facing explicit)', () => {
    const c = mk({ position: { x: 500, y: 100 }, facingLeft: false });
    startAction(
      c,
      { type: ACTION_TYPES.WALK_TO, x: 100, y: 100, duration: 500, autoFlip: false },
      0,
    );
    expect(c.facingLeft).toBe(false);
  });
});

describe('walkTo', () => {
  it('starts from live position on the first tick', () => {
    const c = mk({ position: { x: 10, y: 100 } });
    c.walkTo({ x: 310, y: 100, duration: 1000 });
    tickCharacter(c, 0);
    expect(c.position).toEqual({ x: 10, y: 100 });
    expect(c.action.from).toEqual({ x: 10, y: 100 });
  });

  it('reaches the target exactly at t = duration (no drift)', () => {
    const c = mk({ position: { x: 0, y: 100 } });
    c.walkTo({ x: 500, y: 250, duration: 1000 });
    tickCharacter(c, 0);
    tickCharacter(c, 1000);
    expect(c.position).toEqual({ x: 500, y: 250 });
    expect(c.action).toBeNull();
  });

  it('chains queued walkTos continuously — next from=previous target', () => {
    const c = mk({ position: { x: 0, y: 100 } });
    c.walkTo({ x: 100, y: 100, duration: 1000 });
    c.walkTo({ x: 300, y: 100, duration: 1000 });
    tickCharacter(c, 0);
    tickCharacter(c, 1000); // completes first, kicks off second same-tick
    expect(c.action).not.toBeNull();
    expect(c.action.from).toEqual({ x: 100, y: 100 });
    tickCharacter(c, 2000);
    expect(c.position).toEqual({ x: 300, y: 100 });
  });

  it('MID-WALK INTERRUPT: new walkTo continues from wherever we were', () => {
    // This is the regression test that the whole refactor hinges on.
    // Pre-refactor, a ceremony handoff would snapshot `startPos` in a
    // useEffect that hadn't run yet and re-render from `vh-140` → teleport.
    const c = mk({ position: { x: 0, y: 100 } });
    c.walkTo({ x: 1000, y: 100, duration: 1000 });
    tickCharacter(c, 0);
    tickCharacter(c, 500); // halfway through the first walk
    const midX = c.position.x;
    expect(midX).toBeGreaterThan(0);
    expect(midX).toBeLessThan(1000);

    c.interrupt();
    expect(c.action).toBeNull();
    expect(c.position.x).toBe(midX); // position stays put on interrupt

    c.walkTo({ x: 200, y: 100, duration: 1000 });
    tickCharacter(c, 500);
    expect(c.action.from).toEqual({ x: midX, y: 100 });

    // And it reaches the new target without any jump
    tickCharacter(c, 1500);
    expect(c.position).toEqual({ x: 200, y: 100 });
  });

  it('toggles walkFrame while in flight', () => {
    const c = mk({ position: { x: 0, y: 100 } });
    c.walkTo({ x: 500, y: 100, duration: 5000 });
    tickCharacter(c, 0);
    expect(c.walkFrame).toBe(0);
    tickCharacter(c, WALK_FRAME_MS + 1);
    expect(c.walkFrame).toBe(1);
    tickCharacter(c, 2 * WALK_FRAME_MS + 2);
    expect(c.walkFrame).toBe(0);
  });
});

describe('wait', () => {
  it('blocks the queue until its duration has elapsed', () => {
    const c = mk(); // position { x: 0, y: 100 }
    c.wait(500);
    c.walkTo({ x: 100, y: 100, duration: 200 });
    tickCharacter(c, 0);
    expect(c.action?.type).toBe(ACTION_TYPES.WAIT);
    tickCharacter(c, 499);
    expect(c.action?.type).toBe(ACTION_TYPES.WAIT);
    tickCharacter(c, 500);
    // wait completed, walkTo started, same-tick advance binds `from` to live pos
    expect(c.action?.type).toBe(ACTION_TYPES.WALK_TO);
    expect(c.action.from).toEqual({ x: 0, y: 100 });
  });
});

describe('instant actions drain in one tick', () => {
  it('runs a sequence of instant actions same tick', () => {
    const c = mk();
    c.setPose('cast');
    c.setFacing(true);
    c.setBubble('hello');
    c.setZIndex(99);
    tickCharacter(c, 0);
    expect(c.pose).toBe('cast');
    expect(c.facingLeft).toBe(true);
    expect(c.bubble).toEqual({ text: 'hello', opacity: 1 });
    expect(c.zIndex).toBe(99);
    expect(c.queue).toHaveLength(0);
    expect(c.action).toBeNull();
  });

  it('an instant action before a timed action does not consume the timed action', () => {
    const c = mk();
    c.setPose('cast');
    c.walkTo({ x: 100, y: 0, duration: 200 });
    tickCharacter(c, 0);
    expect(c.pose).toBe('cast');
    expect(c.action?.type).toBe(ACTION_TYPES.WALK_TO);
  });
});

describe('interrupt and teleport', () => {
  it('interrupt freezes position in place and clears queue', () => {
    const c = mk({ position: { x: 0, y: 100 } });
    c.walkTo({ x: 1000, y: 100, duration: 1000 });
    c.walkTo({ x: 2000, y: 100, duration: 1000 });
    tickCharacter(c, 0);
    tickCharacter(c, 250);
    const frozenX = c.position.x;
    interrupt(c);
    expect(c.action).toBeNull();
    expect(c.queue).toEqual([]);
    tickCharacter(c, 500);
    expect(c.position.x).toBe(frozenX); // no movement after interrupt
  });

  it('teleport clears action and jumps to target', () => {
    const c = mk({ position: { x: 0, y: 100 } });
    c.walkTo({ x: 500, y: 100, duration: 1000 });
    tickCharacter(c, 0);
    teleport(c, { x: 999, y: 50 });
    expect(c.position).toEqual({ x: 999, y: 50 });
    expect(c.action).toBeNull();
    expect(c.queue).toEqual([]);
  });
});

describe('callback action', () => {
  it('invokes fn with the character and completes immediately', () => {
    const c = mk();
    let seen = null;
    c.callback((ch) => {
      seen = ch.id;
    });
    tickCharacter(c, 0);
    expect(seen).toBe('t');
    expect(c.action).toBeNull();
  });

  it('callback errors do not wedge the queue', () => {
    const c = mk();
    c.callback(() => {
      throw new Error('boom');
    });
    c.setPose('cast');
    tickCharacter(c, 0);
    expect(c.pose).toBe('cast');
  });
});

describe('onStart / onDone hooks', () => {
  it('onStart fires when an action begins; onDone when it completes', () => {
    const c = mk();
    const calls = [];
    c.walkTo({
      x: 100,
      y: 0,
      duration: 100,
      onStart: () => calls.push('start'),
      onDone: () => calls.push('done'),
    });
    tickCharacter(c, 0);
    expect(calls).toEqual(['start']);
    tickCharacter(c, 100);
    expect(calls).toEqual(['start', 'done']);
  });
});

describe('tickAll', () => {
  it('advances every character in a Map', () => {
    const a = createCharacter({ id: 'a', sprite: 'pm', position: { x: 0, y: 0 } });
    const b = createCharacter({ id: 'b', sprite: 'player', position: { x: 100, y: 0 } });
    a.walkTo({ x: 200, y: 0, duration: 1000 });
    b.walkTo({ x: 0, y: 0, duration: 1000 });
    const map = new Map([
      ['a', a],
      ['b', b],
    ]);
    tickAll(map, 0);
    tickAll(map, 1000);
    expect(a.position).toEqual({ x: 200, y: 0 });
    expect(b.position).toEqual({ x: 0, y: 0 });
  });
});
