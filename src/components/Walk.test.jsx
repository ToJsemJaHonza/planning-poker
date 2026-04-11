import { describe, it, expect } from 'vitest';
import { computePlayerShadow } from './PlayerFigure';

// ---------------------------------------------------------------------------
// Locked-in walking-animation contract.
//
// The user approved the current walk animation ("chůze ted vypdá super").
// These tests pin down the exact guarantees we rely on so the feel never
// silently regresses:
//
//   1. Frame 0 and frame 1 sprites must differ — otherwise the figure is
//      standing still.
//   2. BOTH walk frames must differ from the idle sprite — otherwise the
//      override is a no-op and we're just rendering the neutral stance
//      while pretending to walk.
//   3. The two walk frames are mirror-symmetric in terms of "pose size"
//      (roughly the same number of painted pixels per frame) so the figure
//      doesn't pulse in silhouette area.
//   4. Only the legs/feet region changes — head, torso and arms should be
//      identical between frame 0 and frame 1, matching the PM (Wizard) style
//      the user explicitly asked for.
// ---------------------------------------------------------------------------

function shadowSegments(str) {
  // Each "x y 0 px color" segment is comma-separated
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

function segmentsByY(str) {
  // Bucket shadow segments by their Y coordinate (the second pixel offset).
  // A sprite row at grid Y = r contributes segments with style "Xpx (r*5)px ..."
  const map = new Map();
  for (const seg of shadowSegments(str)) {
    const m = seg.match(/^(-?\d+)px\s+(-?\d+)px/);
    if (!m) continue;
    const y = Number(m[2]);
    if (!map.has(y)) map.set(y, []);
    map.get(y).push(seg);
  }
  return map;
}

describe('Walking animation contract (user approved)', () => {
  const names = ['Alice', 'Bob', 'Honza', 'Richard', 'Tomáš', 'Tomas'];

  it('frame 0 ≠ frame 1 for every tested name', () => {
    for (const n of names) {
      const a = computePlayerShadow(n, { walkFrame: 0 });
      const b = computePlayerShadow(n, { walkFrame: 1 });
      expect(a, `${n} frame 0 vs 1`).not.toBe(b);
    }
  });

  it('both walk frames differ from the idle sprite', () => {
    for (const n of names) {
      const idle = computePlayerShadow(n);
      const f0 = computePlayerShadow(n, { walkFrame: 0 });
      const f1 = computePlayerShadow(n, { walkFrame: 1 });
      expect(f0, `${n} idle vs f0`).not.toBe(idle);
      expect(f1, `${n} idle vs f1`).not.toBe(idle);
    }
  });

  it('walk frames change ONLY rows in the leg region (not head/torso/arms)', () => {
    // Pixel grid is 14 rows tall, each row is 5 px high. Head/torso/arms live
    // in rows 0–10 (Y pixel offsets 0..50). Legs/shoes live in rows 11–13
    // (Y pixel offsets 55..65). This test enforces that only the bottom
    // region actually changes — matching the Wizard pose style.
    for (const n of names) {
      const f0 = segmentsByY(computePlayerShadow(n, { walkFrame: 0 }));
      const f1 = segmentsByY(computePlayerShadow(n, { walkFrame: 1 }));
      for (let y = 0; y <= 50; y += 5) {
        const a = (f0.get(y) || []).sort().join('|');
        const b = (f1.get(y) || []).sort().join('|');
        expect(a, `${n} row y=${y}`).toBe(b);
      }
      // And at least one of the leg rows MUST differ
      let legDiffers = false;
      for (let y = 55; y <= 65; y += 5) {
        const a = (f0.get(y) || []).sort().join('|');
        const b = (f1.get(y) || []).sort().join('|');
        if (a !== b) { legDiffers = true; break; }
      }
      expect(legDiffers, `${n} leg rows must animate`).toBe(true);
    }
  });

  it('silhouette size stays within 15% between frames (no pulsing)', () => {
    for (const n of names) {
      const a = shadowSegments(computePlayerShadow(n, { walkFrame: 0 })).length;
      const b = shadowSegments(computePlayerShadow(n, { walkFrame: 1 })).length;
      const diff = Math.abs(a - b) / Math.max(a, b);
      expect(diff, `${n} silhouette diff`).toBeLessThan(0.15);
    }
  });

  it('walk cycle is deterministic — same name + frame = same shadow', () => {
    for (const n of names) {
      expect(computePlayerShadow(n, { walkFrame: 0 })).toBe(computePlayerShadow(n, { walkFrame: 0 }));
      expect(computePlayerShadow(n, { walkFrame: 1 })).toBe(computePlayerShadow(n, { walkFrame: 1 }));
    }
  });
});
