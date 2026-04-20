import { describe, it, expect } from 'vitest';
import { normalizeTaskRows } from './landing.utils';

describe('normalizeTaskRows', () => {
  it('keeps a row with title and a valid https url', () => {
    expect(normalizeTaskRows([{ title: 'RAFSL-1', url: 'https://x' }])).toEqual([
      { title: 'RAFSL-1', url: 'https://x' },
    ]);
  });

  it('drops rows where the title is empty after trim', () => {
    expect(normalizeTaskRows([{ title: '  ', url: 'https://x' }])).toEqual([]);
    expect(normalizeTaskRows([{ title: '', url: 'https://x' }])).toEqual([]);
  });

  it('keeps the row but nulls a non-url string', () => {
    expect(normalizeTaskRows([{ title: 'RAFSL-1', url: 'not a url' }])).toEqual([
      { title: 'RAFSL-1', url: null },
    ]);
    // javascript: href must be rejected — this is the injection guard
    expect(normalizeTaskRows([{ title: 'x', url: 'javascript:alert(1)' }])).toEqual([
      { title: 'x', url: null },
    ]);
  });

  it('accepts bare domains and prepends https://', () => {
    expect(normalizeTaskRows([
      { title: 'A', url: 'seznam.cz' },
      { title: 'B', url: 'www.seznam.cz/path' },
      { title: 'C', url: 'jira.acme.com/FOO-1' },
    ])).toEqual([
      { title: 'A', url: 'https://seznam.cz' },
      { title: 'B', url: 'https://www.seznam.cz/path' },
      { title: 'C', url: 'https://jira.acme.com/FOO-1' },
    ]);
  });

  it('trims both title and url', () => {
    expect(normalizeTaskRows([{ title: ' RAFSL-1 ', url: '  https://x  ' }])).toEqual([
      { title: 'RAFSL-1', url: 'https://x' },
    ]);
  });

  it('handles an empty url (no url provided at all) as null', () => {
    expect(normalizeTaskRows([{ title: 'foo', url: '' }])).toEqual([
      { title: 'foo', url: null },
    ]);
    expect(normalizeTaskRows([{ title: 'bar' }])).toEqual([
      { title: 'bar', url: null },
    ]);
  });

  it('preserves row order and skips invalid entries in place', () => {
    const rows = [
      { title: 'A', url: 'https://a.com' },
      { title: '', url: 'https://skip' },
      { title: 'B', url: 'not a url' },
      { title: 'C', url: 'https://c.com' },
    ];
    expect(normalizeTaskRows(rows)).toEqual([
      { title: 'A', url: 'https://a.com' },
      { title: 'B', url: null },
      { title: 'C', url: 'https://c.com' },
    ]);
  });

  it('accepts http:// too', () => {
    expect(normalizeTaskRows([{ title: 'foo', url: 'http://example.com' }])).toEqual([
      { title: 'foo', url: 'http://example.com' },
    ]);
  });

  it('returns [] for non-array inputs', () => {
    expect(normalizeTaskRows(null)).toEqual([]);
    expect(normalizeTaskRows(undefined)).toEqual([]);
    expect(normalizeTaskRows('x')).toEqual([]);
  });

  it('skips non-object entries inside the array', () => {
    expect(normalizeTaskRows([null, { title: 'A' }, 'x'])).toEqual([
      { title: 'A', url: null },
    ]);
  });
});
