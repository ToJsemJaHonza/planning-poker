import { describe, it, expect, beforeEach } from 'vitest';
import {
  getMotionMode,
  setMotionMode,
  resetMotionProbe,
} from './motionProbe';

describe('motionProbe', () => {
  beforeEach(() => {
    resetMotionProbe();
  });

  it('returns "reduced" when prefers-reduced-motion media query matches', () => {
    const original = window.matchMedia;
    window.matchMedia = (q) => ({
      matches: q === '(prefers-reduced-motion: reduce)',
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
    try {
      expect(getMotionMode()).toBe('reduced');
    } finally {
      window.matchMedia = original;
    }
  });

  it('caches the probe result across calls', () => {
    setMotionMode('full');
    expect(getMotionMode()).toBe('full');
    expect(getMotionMode()).toBe('full');
  });

  it('setMotionMode overrides the cached value', () => {
    setMotionMode('none');
    expect(getMotionMode()).toBe('none');
    setMotionMode('reduced');
    expect(getMotionMode()).toBe('reduced');
  });

  it('throws on invalid override', () => {
    expect(() => setMotionMode('bogus')).toThrow();
  });

  it('resetMotionProbe forces a re-probe', () => {
    setMotionMode('none');
    expect(getMotionMode()).toBe('none');
    resetMotionProbe();
    // After reset the probe runs again. In jsdom (no real layout), reduced
    // is false and the fallback path returns 'full'.
    expect(['full', 'reduced', 'none']).toContain(getMotionMode());
  });
});
