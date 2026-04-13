import { describe, it, expect } from 'vitest';
import { shallowEqual } from './shallowEqual';

describe('shallowEqual', () => {
  it('same reference returns true', () => {
    const obj = { a: 1 };
    expect(shallowEqual(obj, obj)).toBe(true);
  });

  it('equal primitives returns true', () => {
    expect(shallowEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true);
  });

  it('different values returns false', () => {
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('different key count returns false', () => {
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('null vs object returns false', () => {
    expect(shallowEqual(null, { a: 1 })).toBe(false);
  });

  it('handles nested arrays (one level)', () => {
    const a = { items: [{ x: 1 }, { x: 2 }] };
    const b = { items: [{ x: 1 }, { x: 2 }] };
    expect(shallowEqual(a, b)).toBe(true);
  });

  it('detects nested array differences', () => {
    const a = { items: [{ x: 1 }] };
    const b = { items: [{ x: 2 }] };
    expect(shallowEqual(a, b)).toBe(false);
  });

  it('handles nested objects (one level)', () => {
    const a = { pos: { x: 10, y: 20 } };
    const b = { pos: { x: 10, y: 20 } };
    expect(shallowEqual(a, b)).toBe(true);
  });

  it('detects nested object differences', () => {
    const a = { pos: { x: 10, y: 20 } };
    const b = { pos: { x: 10, y: 30 } };
    expect(shallowEqual(a, b)).toBe(false);
  });

  it('array length mismatch returns false', () => {
    const a = { items: [1, 2] };
    const b = { items: [1] };
    expect(shallowEqual(a, b)).toBe(false);
  });
});
