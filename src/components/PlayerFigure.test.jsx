import { describe, it, expect } from 'vitest';
import { computePlayerShadow, hashName } from './PlayerFigure';

// We test the pure sprite-string builder directly rather than going through
// React render + DOM introspection — jsdom silently discards very long
// box-shadow values when read back via CSSStyleDeclaration, which made
// DOM-based assertions impossible.

describe('computePlayerShadow — walk cycle frames', () => {
  it('produces a non-empty string for the idle sprite', () => {
    const s = computePlayerShadow('Alice');
    expect(typeof s).toBe('string');
    expect(s.length).toBeGreaterThan(100);
  });

  it('walkFrame=0 and walkFrame=1 produce DIFFERENT sprites', () => {
    const a = computePlayerShadow('Alice', { walkFrame: 0 });
    const b = computePlayerShadow('Alice', { walkFrame: 1 });
    expect(a).not.toBe(b);
  });

  it('walk frames differ from the idle sprite (override actually fires)', () => {
    const idle = computePlayerShadow('Alice');
    const frame0 = computePlayerShadow('Alice', { walkFrame: 0 });
    const frame1 = computePlayerShadow('Alice', { walkFrame: 1 });
    expect(idle).not.toBe(frame0);
    expect(idle).not.toBe(frame1);
  });

  it('is deterministic for the same name and opts', () => {
    expect(computePlayerShadow('Alice')).toBe(computePlayerShadow('Alice'));
    expect(computePlayerShadow('Alice', { walkFrame: 0 })).toBe(
      computePlayerShadow('Alice', { walkFrame: 0 })
    );
  });

  it('different names produce different sprites', () => {
    expect(computePlayerShadow('Alice')).not.toBe(computePlayerShadow('Bob'));
  });

  it('holdingCard=true modifies the arm rows', () => {
    const normal = computePlayerShadow('Alice');
    const holding = computePlayerShadow('Alice', { holdingCard: true });
    expect(normal).not.toBe(holding);
  });

  it('fukEyes renders a strictly smaller sprite (nose-up only)', () => {
    const normal = computePlayerShadow('Alice');
    const fuk = computePlayerShadow('Alice', { fukEyes: true });
    expect(normal).not.toBe(fuk);
    // fuk sprite has far fewer shadow segments than the full-body one
    expect(fuk.split(',').length).toBeLessThan(normal.split(',').length);
  });
});

describe('computePlayerShadow — walk frames across many names', () => {
  const sampleNames = ['Alice', 'Bob', 'Honza', 'Tomáš', 'Ricardo', 'Fanda', 'Alan'];

  it('every name has distinct walk frame 0 vs 1', () => {
    for (const n of sampleNames) {
      const a = computePlayerShadow(n, { walkFrame: 0 });
      const b = computePlayerShadow(n, { walkFrame: 1 });
      expect(a, `${n} frame 0 vs 1`).not.toBe(b);
    }
  });

  it('every name has walk frame 0 distinct from idle', () => {
    for (const n of sampleNames) {
      const idle = computePlayerShadow(n);
      const f0 = computePlayerShadow(n, { walkFrame: 0 });
      expect(f0, `${n} idle vs frame 0`).not.toBe(idle);
    }
  });
});

describe('hashName (P4 — FNV-1a + mix)', () => {
  it('single-character difference produces different hash', () => {
    expect(hashName('Bob')).not.toBe(hashName('Boa'));
  });

  it('ordering matters (anagrams hash differently)', () => {
    expect(hashName('Bob')).not.toBe(hashName('oBb'));
  });

  it('is deterministic for the same input', () => {
    expect(hashName('Alice')).toBe(hashName('Alice'));
  });

  it('returns a non-negative 32-bit integer', () => {
    const h = hashName('Alice');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});
