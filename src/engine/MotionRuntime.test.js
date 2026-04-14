import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { subscribe, subscriberCount, __testing__ } from './MotionRuntime';

// jsdom doesn't ship a real raf scheduler — install a deterministic one.
let rafQueue = [];
let rafCounter = 0;

function installRaf() {
  rafQueue = [];
  rafCounter = 0;
  globalThis.requestAnimationFrame = (cb) => {
    rafCounter += 1;
    const id = rafCounter;
    rafQueue.push({ id, cb });
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    rafQueue = rafQueue.filter((entry) => entry.id !== id);
  };
}

function flushFrame() {
  // Drain a single frame's worth of callbacks.
  const queued = rafQueue;
  rafQueue = [];
  for (const entry of queued) entry.cb(performance.now());
}

describe('MotionRuntime', () => {
  beforeEach(() => {
    installRaf();
    __testing__.reset();
  });

  afterEach(() => {
    __testing__.reset();
  });

  it('starts a single rAF the first time anyone subscribes', () => {
    expect(__testing__.isRunning()).toBe(false);
    subscribe(() => {});
    expect(__testing__.isRunning()).toBe(true);
    expect(rafQueue.length).toBe(1);
  });

  it('uses one rAF per frame regardless of subscriber count', () => {
    subscribe(() => {});
    subscribe(() => {});
    subscribe(() => {});
    expect(rafQueue.length).toBe(1);
    flushFrame();
    // After the frame fires, exactly one new frame should be queued.
    expect(rafQueue.length).toBe(1);
  });

  it('fires every subscriber once per frame', () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribe(a);
    subscribe(b);

    flushFrame();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    flushFrame();
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('passes the same timestamp to every subscriber in one frame', () => {
    let aTime = 0;
    let bTime = 0;
    subscribe((t) => { aTime = t; });
    subscribe((t) => { bTime = t; });
    flushFrame();
    expect(aTime).toBe(bTime);
    expect(aTime).toBeGreaterThan(0);
  });

  it('stops the loop when the last subscriber unsubscribes', () => {
    const off = subscribe(() => {});
    expect(__testing__.isRunning()).toBe(true);
    off();
    expect(__testing__.isRunning()).toBe(false);
    expect(subscriberCount()).toBe(0);
  });

  it('isolates one throwing subscriber from the rest', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const survivor = vi.fn();
    subscribe(() => { throw new Error('bad subscriber'); });
    subscribe(survivor);

    flushFrame();
    expect(survivor).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('supports a subscriber unsubscribing itself mid-tick', () => {
    const log = [];
    let off1;
    off1 = subscribe(() => { log.push('a'); off1(); });
    subscribe(() => { log.push('b'); });

    flushFrame();
    expect(log).toEqual(['a', 'b']);
    log.length = 0;

    flushFrame();
    expect(log).toEqual(['b']);
  });
});
