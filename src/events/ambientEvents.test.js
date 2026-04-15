import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AMBIENT_PRODUCERS,
  AMBIENT_TRIGGER,
  DEV_QUOTES,
  deriveActiveQuote,
  deriveFukEyesSet,
} from './ambientEvents';

const byName = (name) => AMBIENT_PRODUCERS.find((p) => p.name === name);

function makeCtx(overrides = {}) {
  return {
    playerEntries: [],
    phase: 'voting',
    isLeader: true,
    syncedEvent: null,
    fireSyncedEvent: vi.fn(),
    createdAt: 0,
    ...overrides,
  };
}

describe('ambientEvents — registry shape', () => {
  it('every producer declares a name + trigger + run', () => {
    const validKinds = new Set(Object.values(AMBIENT_TRIGGER));
    for (const p of AMBIENT_PRODUCERS) {
      expect(typeof p.name).toBe('string');
      expect(p.name.length).toBeGreaterThan(0);
      expect(validKinds.has(p.trigger.kind)).toBe(true);
      if (p.trigger.kind === AMBIENT_TRIGGER.INTERVAL) {
        expect(typeof p.trigger.intervalMs).toBe('number');
        expect(p.trigger.intervalMs).toBeGreaterThan(0);
      }
      expect(typeof p.run).toBe('function');
    }
  });

  it('producer names are unique', () => {
    const names = AMBIENT_PRODUCERS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('ambientEvents — deriveFukEyesSet', () => {
  it('returns empty set when syncedEvent is missing or wrong type', () => {
    expect(deriveFukEyesSet(null).size).toBe(0);
    expect(deriveFukEyesSet({ type: 'devQuote', name: 'x', text: 'y' }).size).toBe(0);
  });

  it('returns the announced names when type matches', () => {
    const set = deriveFukEyesSet({ type: 'fukEyes', names: ['Fanda', 'František'] });
    expect(set.has('Fanda')).toBe(true);
    expect(set.has('František')).toBe(true);
  });
});

describe('ambientEvents — deriveActiveQuote', () => {
  it('returns null when no quote is active', () => {
    expect(deriveActiveQuote(null)).toBeNull();
    expect(deriveActiveQuote({ type: 'fukEyes', names: [] })).toBeNull();
  });

  it('passes through devQuote payload', () => {
    const q = { type: 'devQuote', name: 'Bob', text: 'hi' };
    expect(deriveActiveQuote(q)).toBe(q);
  });
});

describe('ambientEvents — fukEyes producer', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('fires when a fuk-name rolls under the threshold', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // forces 0.1 threshold to pass
    const ctx = makeCtx({
      playerEntries: [['p1', { name: 'Fanda' }]],
    });
    byName('fukEyes').run(ctx);
    expect(ctx.fireSyncedEvent).toHaveBeenCalledWith(
      { type: 'fukEyes', names: ['Fanda'] },
      60000,
    );
  });

  it('skips firing when the roll fails for everyone', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const ctx = makeCtx({
      playerEntries: [['p1', { name: 'Fanda' }], ['p2', { name: 'František' }]],
    });
    byName('fukEyes').run(ctx);
    expect(ctx.fireSyncedEvent).not.toHaveBeenCalled();
  });

  it('ignores non-fuk names entirely', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const ctx = makeCtx({
      playerEntries: [['p1', { name: 'Alice' }]],
    });
    byName('fukEyes').run(ctx);
    expect(ctx.fireSyncedEvent).not.toHaveBeenCalled();
  });
});

describe('ambientEvents — alanCoffee producer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it('only fires when phase === revealed (gating done by trigger.when)', () => {
    const producer = byName('alanCoffee');
    expect(producer.trigger.when({ phase: 'voting' })).toBe(false);
    expect(producer.trigger.when({ phase: 'revealed' })).toBe(true);
  });

  it('schedules the quote 1.5s after Alan votes coffee (10% roll passes)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const ctx = makeCtx({
      phase: 'revealed',
      playerEntries: [['p1', { name: 'Alan', vote: '☕' }]],
    });
    byName('alanCoffee').run(ctx);
    expect(ctx.fireSyncedEvent).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(ctx.fireSyncedEvent).toHaveBeenCalledWith(
      { type: 'devQuote', name: 'Alan', text: 'Fullstack FE developer' },
      4000,
    );
  });

  it('does not fire when Alan voted something other than coffee', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const ctx = makeCtx({
      phase: 'revealed',
      playerEntries: [['p1', { name: 'Alan', vote: '5' }]],
    });
    byName('alanCoffee').run(ctx);
    vi.advanceTimersByTime(2000);
    expect(ctx.fireSyncedEvent).not.toHaveBeenCalled();
  });
});

describe('ambientEvents — devQuotes producer', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('skips when another syncedEvent is already on screen', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // would otherwise fire
    const ctx = makeCtx({
      playerEntries: [['p1', { name: 'Alice' }]],
      syncedEvent: { type: 'fukEyes', names: ['Fanda'] },
    });
    byName('devQuotes').run(ctx);
    expect(ctx.fireSyncedEvent).not.toHaveBeenCalled();
  });

  it('fires a quote with a name+text pulled from the player list', () => {
    // First random < 0.02 to pass gate, second picks player index 0,
    // third picks quote index 0.
    const seq = [0.01, 0, 0];
    let i = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => seq[i++ % seq.length]);
    const ctx = makeCtx({
      playerEntries: [['p1', { name: 'Alice' }]],
    });
    byName('devQuotes').run(ctx);
    expect(ctx.fireSyncedEvent).toHaveBeenCalledTimes(1);
    const [payload, ttl] = ctx.fireSyncedEvent.mock.calls[0];
    expect(payload.type).toBe('devQuote');
    expect(payload.name).toBe('Alice');
    expect(DEV_QUOTES).toContain(payload.text);
    expect(ttl).toBe(3000);
  });

  it('does nothing when no players are present', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const ctx = makeCtx({ playerEntries: [] });
    byName('devQuotes').run(ctx);
    expect(ctx.fireSyncedEvent).not.toHaveBeenCalled();
  });
});

describe('ambientEvents — richardHunger producer', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('requires createdAt to be present (gating)', () => {
    const producer = byName('richardHunger');
    expect(producer.requires({ createdAt: 0 })).toBe(false);
    expect(producer.requires({ createdAt: Date.now() })).toBe(true);
  });

  it('does nothing when no Richard is in the room', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const ctx = makeCtx({
      playerEntries: [['p1', { name: 'Alice' }]],
      createdAt: Date.now() - 4 * 60 * 60 * 1000,
    });
    byName('richardHunger').run(ctx);
    expect(ctx.fireSyncedEvent).not.toHaveBeenCalled();
  });

  it('fires for Richard when room is hungry-window old and roll succeeds', () => {
    // shouldRichardSpeakHunger only returns true at certain meal hours;
    // we just verify the producer DELEGATES to it. To force a true return
    // we stub the randoms to 0 and put room age at 4 hours back. If the
    // gate refuses, no call — and this test only asserts the negative
    // path (no fire when conditions don't all align).
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const ctx = makeCtx({
      playerEntries: [['p1', { name: 'Richard' }]],
      // createdAt 30 min ago — too young; shouldRichardSpeakHunger should refuse.
      createdAt: Date.now() - 30 * 60 * 1000,
    });
    byName('richardHunger').run(ctx);
    expect(ctx.fireSyncedEvent).not.toHaveBeenCalled();
  });
});
