import { describe, it, expect } from 'vitest';
import { computePlayerShadow, hashName } from './PlayerFigure';

const pixels = shadow => shadow.split(',').map(part => {
  const [, x, y, color] = part.match(/^(\d+)px (\d+)px 0 \d+px (#[\da-f]+)$/i) || [];
  return { x: Number(x), y: Number(y), color };
});

describe('detailed pixel characters', () => {
  const names = ['Jan', 'Petra', 'Tomáš', 'Lucie', 'Martin', 'Alice', 'Bob', 'Fanda', 'René', '李雷', '😀', ...Array.from({ length: 250 }, (_, i) => `Player ${i}`)];
  it('never drops opaque torso pixels when the hash has its sign bit set', () => {
    for (const name of names) {
      const sprite = pixels(computePlayerShadow(name, { pose: 'neutral' }));
      for (const x of [20, 25, 30, 35]) {
        expect(sprite.find(p => p.x === x && p.y === 45)?.color, name).toMatch(/^#[\da-f]{3,6}$/i);
      }
    }
  });
  it('actually varies hair color instead of XORing a hash with itself', () => {
    const hairColors = new Set(names.map(name => pixels(computePlayerShadow(name, { fukEyes: true })).find(p => p.x === 20 && p.y === 45)?.color));
    expect(hairColors.size).toBeGreaterThan(8);
  });
  it('adds a restrained palette of material highlights and shadows', () => {
    for (const name of names.slice(0, 10)) {
      const colors = new Set(pixels(computePlayerShadow(name)).map(p => p.color));
      expect(colors.size, name).toBeGreaterThanOrEqual(9);
      expect(colors.size, name).toBeLessThanOrEqual(24);
    }
  });
  it('keeps every pose inside the same 12 by 14 pixel grid', () => {
    for (const name of names) for (const opts of [{}, { walkFrame: 0 }, { walkFrame: 1 }, { pose: 'hips' }, { holdingCard: true }, { fukEyes: true }, { stressStage: 5 }]) {
      const sprite = pixels(computePlayerShadow(name, opts));
      expect(sprite.every(p => p.color && p.x >= 0 && p.x <= 55 && p.y >= 0 && p.y <= 65 && p.x % 5 === 0 && p.y % 5 === 0), name).toBe(true);
      expect(sprite.some(p => p.y === 65), name).toBe(true);
    }
  });
  it('keeps the detailed head and torso identical throughout the walk cycle', () => {
    for (const name of names.slice(0, 20)) {
      const upper = frame => pixels(computePlayerShadow(name, { walkFrame: frame })).filter(p => p.y < 55);
      expect(upper(0), name).toEqual(upper(1));
    }
  });
});

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
