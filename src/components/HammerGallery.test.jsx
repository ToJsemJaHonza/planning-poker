import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import HammerGallery from '../../qa/HammerGallery';
import { conceptsA } from '../../qa/hammer-concepts-a';
import { conceptsB } from '../../qa/hammer-concepts-b';
import { conceptsC } from '../../qa/hammer-concepts-c';

afterEach(cleanup);
const concepts = [...conceptsA, ...conceptsB, ...conceptsC];

describe('hammer design council preview', () => {
  it('offers ten distinct, bounded pixel designs with the same hand anchor', () => {
    expect(concepts.map(c => c.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(concepts.map(c => c.inspiration)).size).toBe(10);
    expect(new Set(concepts.map(c => JSON.stringify(c.shapes))).size).toBe(10);
    for (const c of concepts) {
      for (const r of c.shapes) {
        expect([r.x, r.y, r.w, r.h].every(Number.isInteger)).toBe(true);
        expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.w).toBeGreaterThan(0); expect(r.h).toBeGreaterThan(0);
        expect(r.x + r.w).toBeLessThanOrEqual(24); expect(r.y + r.h).toBeLessThanOrEqual(28);
      }
      expect(c.shapes.some(r => r.x <= 12 && r.x + r.w > 12 && r.y <= 24 && r.y + r.h > 24)).toBe(true);
      for (const label of c.labels) {
        expect(label.text).toMatch(/^[A-Z0-9+!/? -]+$/);
        expect(label.x + (label.text.length * 4 - 1) * label.pixel).toBeLessThanOrEqual(24);
        expect(label.y + 5 * (label.pixelY || label.pixel)).toBeLessThanOrEqual(28);
      }
    }
  });

  it('selects, enlarges and changes pose without detaching the grip; Escape restores focus', () => {
    const view = render(<HammerGallery />);
    expect(view.getAllByRole('button', { name: /^Select concept/ })).toHaveLength(10);
    expect(view.queryByRole('button', { name: 'Inspect 2×' })).toBeNull();
    fireEvent.click(view.getByRole('button', { name: 'Select concept 9: The Escape Key' }));
    const inspect = view.getByRole('button', { name: 'Inspect 2×' });
    fireEvent.click(inspect);
    const dialog = view.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Impact' }));
    const hammer = dialog.querySelector('[data-design-hammer="9"]');
    expect(hammer.style.transform).toBe('rotate(95deg)');
    expect(hammer.style.transformOrigin).toBe('60px 120px');
    expect(hammer.style.left).toBe('-25px'); expect(hammer.style.top).toBe('-80px');
    expect(hammer.querySelector('text')).toBeNull();
    expect(hammer.querySelector('[data-bitmap-label="ESC"] rect')).not.toBeNull();
    fireEvent.keyDown(within(dialog).getByRole('button', { name: 'Impact' }), { key: 'Escape' });
    expect(view.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(inspect);
  });
});
