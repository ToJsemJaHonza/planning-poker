import { describe, it, expect, vi } from 'vitest';
import { generateRoomCode } from '../hooks/useRoom';
import {
  isRichardName,
  isTomasName,
  hashDir,
  RICHARD_HUNGER_QUOTES,
  RICHARD_HUNGER_THRESHOLD_MS,
  shouldRichardSpeakHunger,
} from '../components/playerList.utils';
import { computeStats } from '../components/resultModal.utils';

// We have to mock firebase before any module that imports it (useRoom does).
vi.mock('../firebase.js', () => import('./firebase-mock.js'));

describe('generateRoomCode', () => {
  it('produces a 6-char upper-case code', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    }
  });

  it('avoids ambiguous characters (0, 1, I, O)', () => {
    const seen = new Set();
    for (let i = 0; i < 500; i++) seen.add(generateRoomCode());
    const joined = Array.from(seen).join('');
    expect(joined).not.toMatch(/[01IO]/);
  });

  it('generates unique codes most of the time', () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) codes.add(generateRoomCode());
    // With ~31^6 ≈ 887M possibilities, 100 codes should basically never collide
    expect(codes.size).toBeGreaterThan(95);
  });
});

describe('isRichardName', () => {
  it('matches canonical "Richard"', () => {
    expect(isRichardName('Richard')).toBe(true);
    expect(isRichardName('RICHARD')).toBe(true);
    expect(isRichardName('richard')).toBe(true);
  });

  it('matches spanish variants', () => {
    expect(isRichardName('Ricardo')).toBe(true);
    expect(isRichardName('ricardino')).toBe(true);
    expect(isRichardName('ricardito')).toBe(true);
    expect(isRichardName('ricardinho')).toBe(true);
  });

  it('matches dotted variants like "R.I.C.H.A.R.D"', () => {
    expect(isRichardName('R.I.C.H.A.R.D')).toBe(true);
    expect(isRichardName('r.i.c.a.r.d.o')).toBe(true);
  });

  it('rejects non-Richards', () => {
    expect(isRichardName('Honza')).toBe(false);
    expect(isRichardName('Rick')).toBe(false);
    expect(isRichardName('')).toBe(false);
    expect(isRichardName(null)).toBe(false);
    expect(isRichardName(undefined)).toBe(false);
  });
});

describe('hashDir', () => {
  it('is deterministic for the same name', () => {
    const a = hashDir('Honza');
    const b = hashDir('Honza');
    expect(a).toEqual(b);
  });

  it('returns either "left" or "right"', () => {
    const names = ['Alan', 'Honza', 'Richard', 'Pepa', 'Anna', 'Bob', 'Fanda', 'Jakub'];
    for (const n of names) {
      expect(['left', 'right']).toContain(hashDir(n).dir);
    }
  });

  it('duration is at least 2.6s — long enough to look like walking', () => {
    const names = ['Alan', 'Honza', 'Pepa', 'Anna', 'Bob', 'Fanda', 'Jakub', 'Karel', 'Lucie', 'Martin'];
    for (const n of names) {
      const { duration } = hashDir(n);
      expect(duration).toBeGreaterThanOrEqual(2.6);
      expect(duration).toBeLessThan(4.0);
    }
  });
});

describe('computeStats', () => {
  it('returns "No votes" for empty list', () => {
    const s = computeStats([]);
    expect(s.verdict).toBe('No votes');
    expect(s.avg).toBe('-');
    expect(s.spread).toBe(0);
  });

  it('returns "Perfect match!" when all votes identical', () => {
    const s = computeStats([
      { name: 'A', vote: '3' }, { name: 'B', vote: '3' }, { name: 'C', vote: '3' },
    ]);
    expect(s.verdict).toBe('Perfect match!');
    expect(s.avg).toBe('3.0');
    expect(s.spread).toBe(0);
  });

  it('returns "Good match" when spread ≤ 2', () => {
    const s = computeStats([
      { name: 'A', vote: '3' }, { name: 'B', vote: '5' },
    ]);
    expect(s.verdict).toBe('Good match');
    expect(s.spread).toBe(2);
  });

  it('returns "Some spread" when spread 3-5', () => {
    const s = computeStats([
      { name: 'A', vote: '3' }, { name: 'B', vote: '8' },
    ]);
    expect(s.verdict).toBe('Some spread');
    expect(s.spread).toBe(5);
  });

  it('returns "Big spread!" when spread > 5', () => {
    const s = computeStats([
      { name: 'A', vote: '1' }, { name: 'B', vote: '13' },
    ]);
    expect(s.verdict).toBe('Big spread!');
    expect(s.spread).toBe(12);
  });

  it('separates coffee/question marks into special bucket', () => {
    const s = computeStats([
      { name: 'A', vote: '5' },
      { name: 'B', vote: '☕' },
      { name: 'C', vote: '?' },
    ]);
    expect(s.special).toHaveLength(2);
    expect(s.avg).toBe('5.0');
  });

  it('computes correct average for Fibonacci votes', () => {
    const s = computeStats([
      { name: 'A', vote: '1' },
      { name: 'B', vote: '3' },
      { name: 'C', vote: '5' },
      { name: 'D', vote: '8' },
    ]);
    expect(s.avg).toBe('4.3'); // (1+3+5+8)/4 = 4.25 → "4.3" rounded
  });

  it('builds a distribution histogram', () => {
    const s = computeStats([
      { name: 'A', vote: '3' }, { name: 'B', vote: '3' }, { name: 'C', vote: '5' },
    ]);
    expect(s.distribution['3']).toBe(2);
    expect(s.distribution['5']).toBe(1);
    expect(s.maxCount).toBe(2);
  });
});

describe('isTomasName (GH issue #2)', () => {
  it('matches canonical Czech and English spellings', () => {
    expect(isTomasName('Tomáš')).toBe(true);
    expect(isTomasName('Tomas')).toBe(true);
    expect(isTomasName('Tom')).toBe(true);
    expect(isTomasName('Tommy')).toBe(true);
    expect(isTomasName('Tomik')).toBe(true);
    expect(isTomasName('Tomík')).toBe(true);
  });

  it('is case-insensitive and strips dots', () => {
    expect(isTomasName('TOMÁŠ')).toBe(true);
    expect(isTomasName('t.o.m.a.s')).toBe(true);
  });

  it('rejects other names', () => {
    expect(isTomasName('Richard')).toBe(false);
    expect(isTomasName('Honza')).toBe(false);
    expect(isTomasName('')).toBe(false);
    expect(isTomasName(null)).toBe(false);
  });
});

describe('Richard hunger (GH issue #1)', () => {
  it('threshold is one hour', () => {
    expect(RICHARD_HUNGER_THRESHOLD_MS).toBe(60 * 60 * 1000);
  });

  it('has a non-empty quote pool', () => {
    expect(Array.isArray(RICHARD_HUNGER_QUOTES)).toBe(true);
    expect(RICHARD_HUNGER_QUOTES.length).toBeGreaterThanOrEqual(5);
    for (const q of RICHARD_HUNGER_QUOTES) {
      expect(typeof q).toBe('string');
      expect(q.length).toBeGreaterThan(0);
    }
  });

  it('shouldRichardSpeakHunger returns false when room is younger than 1 hour', () => {
    expect(shouldRichardSpeakHunger({
      hasRichard: true,
      roomAgeMs: 30 * 60 * 1000, // 30 min
      now: Date.now(),
      syncedEvent: null,
    })).toBe(false);
  });

  it('shouldRichardSpeakHunger returns true when all conditions are met', () => {
    expect(shouldRichardSpeakHunger({
      hasRichard: true,
      roomAgeMs: 2 * 60 * 60 * 1000, // 2 hours
      now: Date.now(),
      syncedEvent: null,
    })).toBe(true);
  });

  it('shouldRichardSpeakHunger returns false when there is no Richard', () => {
    expect(shouldRichardSpeakHunger({
      hasRichard: false,
      roomAgeMs: 2 * 60 * 60 * 1000,
      now: Date.now(),
      syncedEvent: null,
    })).toBe(false);
  });

  it('shouldRichardSpeakHunger does not steal focus from important events', () => {
    for (const important of ['train', 'chicken', 'dbbPipeline']) {
      expect(shouldRichardSpeakHunger({
        hasRichard: true,
        roomAgeMs: 2 * 60 * 60 * 1000,
        now: Date.now(),
        syncedEvent: { type: important },
      })).toBe(false);
    }
  });
});

describe('name sanitization (NamePrompt rules)', () => {
  // NamePrompt strips . $ # [ ] / — we test the regex directly
  const sanitize = (name) => String(name).trim().replace(/[.$#\[\]/]/g, '');

  it('strips Firebase-unsafe characters', () => {
    expect(sanitize('R.I.C.H.A.R.D')).toBe('RICHARD');
    expect(sanitize('hello$world')).toBe('helloworld');
    expect(sanitize('a[b]c')).toBe('abc');
    expect(sanitize('x/y#z')).toBe('xyz');
  });

  it('preserves normal Unicode letters/spaces', () => {
    expect(sanitize('Honza Novák')).toBe('Honza Novák');
    expect(sanitize('  Pepa  ')).toBe('Pepa');
  });

  it('rejects names that are empty after sanitization', () => {
    expect(sanitize('...')).toBe('');
    expect(sanitize('$$$')).toBe('');
  });
});
