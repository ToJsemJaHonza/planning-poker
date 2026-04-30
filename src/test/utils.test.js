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
import { computeStats, computeMedian, roundToCard, DECK } from '../components/resultModal.utils';

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
    expect(s.median).toBe('-');
    expect(s.spread).toBe(0);
  });

  it('returns "Perfect match!" when all votes identical', () => {
    const s = computeStats([
      { name: 'A', vote: '3' }, { name: 'B', vote: '3' }, { name: 'C', vote: '3' },
    ]);
    expect(s.verdict).toBe('Perfect match!');
    expect(s.median).toBe('3.0');
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
    expect(s.median).toBe('5.0');
  });

  it('computes correct median for Fibonacci votes', () => {
    const s = computeStats([
      { name: 'A', vote: '1' },
      { name: 'B', vote: '3' },
      { name: 'C', vote: '5' },
      { name: 'D', vote: '8' },
    ]);
    // sorted [1,3,5,8] → median = (3+5)/2 = 4.0
    expect(s.median).toBe('4.0');
  });

  // The modal no longer shows the raw fractional average; it shows the
  // rounded card so the room commits to a concrete estimate. These tests
  // guard the `result` field that the modal renders.
  it('result is the rounded card for numeric votes', () => {
    // avg=4.25 → closer to 5 than to 3 (dist 0.75 vs 1.25) → "5"
    const s = computeStats([
      { name: 'A', vote: '1' },
      { name: 'B', vote: '3' },
      { name: 'C', vote: '5' },
      { name: 'D', vote: '8' },
    ]);
    expect(s.result).toBe('5');
  });

  it('result rounds UP on exact ties', () => {
    // avg=4 → equidistant from 3 and 5, pessimistic round UP → "5"
    const s = computeStats([
      { name: 'A', vote: '3' },
      { name: 'B', vote: '5' },
    ]);
    expect(s.result).toBe('5');
  });

  it('result is "-" when nobody voted numerically', () => {
    expect(computeStats([]).result).toBe('-');
    expect(computeStats([{ name: 'A', vote: '?' }]).result).toBe('-');
  });

  it('result matches the winning card on perfect match', () => {
    const s = computeStats([
      { name: 'A', vote: '8' },
      { name: 'B', vote: '8' },
      { name: 'C', vote: '8' },
    ]);
    expect(s.result).toBe('8');
  });

  it('builds a distribution histogram', () => {
    const s = computeStats([
      { name: 'A', vote: '3' }, { name: 'B', vote: '3' }, { name: 'C', vote: '5' },
    ]);
    expect(s.distribution['3']).toBe(2);
    expect(s.distribution['5']).toBe(1);
    expect(s.maxCount).toBe(2);
  });

  // Regression: ? and ☕ are abstain cards (per planning-poker convention)
  // and must not pollute the histogram OR shrink the bar-height denominator.
  // Without these guards, 3-of-3 numeric consensus + 1× ☕ rendered as a
  // 75%-height bar, breaking "full bar = 100% agreement".
  describe('special votes do not influence histogram or totalVotes', () => {
    it('excludes ? and ☕ from the distribution', () => {
      const s = computeStats([
        { name: 'A', vote: '5' },
        { name: 'B', vote: '5' },
        { name: 'C', vote: '☕' },
        { name: 'D', vote: '?' },
      ]);
      expect(s.distribution['5']).toBe(2);
      expect(s.distribution['☕']).toBeUndefined();
      expect(s.distribution['?']).toBeUndefined();
    });

    it('totalVotes counts only numeric voters (denominator for bar height)', () => {
      const s = computeStats([
        { name: 'A', vote: '5' }, { name: 'B', vote: '5' }, { name: 'C', vote: '5' },
        { name: 'D', vote: '☕' },
      ]);
      // 3 of 3 numeric voters agreed → denom must be 3, not 4, so the bar
      // renders at full height (100% agreement among real voters).
      expect(s.totalVotes).toBe(3);
      expect(s.distribution['5']).toBe(3);
    });

    it('maxCount ignores special votes', () => {
      // Without the fix, 3× ☕ would set maxCount=3 even though no numeric
      // bar reaches that count.
      const s = computeStats([
        { name: 'A', vote: '5' }, { name: 'B', vote: '8' },
        { name: 'C', vote: '☕' }, { name: 'D', vote: '☕' }, { name: 'E', vote: '☕' },
      ]);
      expect(s.maxCount).toBe(1);
    });
  });
});

describe('computeMedian', () => {
  it('returns null for empty/null/undefined', () => {
    expect(computeMedian([])).toBeNull();
    expect(computeMedian(null)).toBeNull();
    expect(computeMedian(undefined)).toBeNull();
  });

  it('odd length: returns the middle element of the sorted array', () => {
    expect(computeMedian([5])).toBe(5);
    expect(computeMedian([3, 5, 8])).toBe(5);
    // Already-sorted vs out-of-order must yield the same result.
    expect(computeMedian([8, 3, 5])).toBe(5);
    expect(computeMedian([1, 3, 5, 8, 13])).toBe(5);
  });

  it('even length: returns the mean of the two middle elements', () => {
    expect(computeMedian([3, 5])).toBe(4);
    expect(computeMedian([5, 8])).toBe(6.5);
    expect(computeMedian([1, 3, 5, 8])).toBe(4);
    expect(computeMedian([3, 5, 8, 13])).toBe(6.5);
  });

  it('does not mutate the input array', () => {
    const input = [13, 3, 8, 5, 1];
    const snapshot = [...input];
    computeMedian(input);
    expect(input).toEqual(snapshot);
  });
});

// Median's whole reason for being chosen over mean: a single outlier
// shouldn't drag the team's committed estimate. These tests pin the
// behavior down so a future "let's go back to mean" can't sneak in
// without breaking visible expectations.
describe('computeStats — median outlier resistance (vs old mean)', () => {
  it('one high outlier does not drag the result up', () => {
    // [3,5,5,5,21] — sorted middle = 5. Mean would be 7.8 → 8.
    const s = computeStats([
      { name: 'A', vote: '3' },
      { name: 'B', vote: '5' },
      { name: 'C', vote: '5' },
      { name: 'D', vote: '5' },
      { name: 'E', vote: '21' },
    ]);
    expect(s.result).toBe('5');
    expect(s.median).toBe('5.0');
    // Spread still surfaces the disagreement so the team discusses it.
    expect(s.spread).toBe(18);
    expect(s.verdict).toBe('Big spread!');
  });

  it('one low outlier does not drag the result down', () => {
    // [3,8,8,8] — sorted middle = (8+8)/2 = 8. Mean would be 6.75 → 8 too,
    // but [3,5,8,8] picks the difference up: median = (5+8)/2 = 6.5 → 8,
    // mean = 6 → 5. We assert the median path.
    const s = computeStats([
      { name: 'A', vote: '3' },
      { name: 'B', vote: '5' },
      { name: 'C', vote: '8' },
      { name: 'D', vote: '8' },
    ]);
    expect(s.result).toBe('8');
    expect(s.median).toBe('6.5');
  });

  it('majority cluster wins over a single high outlier (cohn scenario)', () => {
    // [3,3,3,13] — median = (3+3)/2 = 3. Mean would be 5.5 → 5.
    // The team voted 3 three times — the result must be 3.
    const s = computeStats([
      { name: 'A', vote: '3' },
      { name: 'B', vote: '3' },
      { name: 'C', vote: '3' },
      { name: 'D', vote: '13' },
    ]);
    expect(s.result).toBe('3');
    expect(s.median).toBe('3.0');
  });

  it('specials (?, ☕) are still excluded from the median', () => {
    // The full scenario from the design discussion: kafe, kafe, ?, 13, 13,
    // 21, 21, 21. Numeric = [13,13,21,21,21] (5 items, sorted middle = 21).
    const s = computeStats([
      { name: 'A', vote: '☕' },
      { name: 'B', vote: '☕' },
      { name: 'C', vote: '?' },
      { name: 'D', vote: '13' },
      { name: 'E', vote: '13' },
      { name: 'F', vote: '21' },
      { name: 'G', vote: '21' },
      { name: 'H', vote: '21' },
    ]);
    expect(s.result).toBe('21');
    expect(s.median).toBe('21.0');
    expect(s.special).toHaveLength(3);
    // Total numeric voters — denominator for histogram bars.
    expect(s.totalVotes).toBe(5);
  });

  it('two-voter even split rounds via roundToCard tie-break', () => {
    // [3,5] → median = 4 → tie 3↔5 → roundToCard rounds UP → 5.
    const s = computeStats([
      { name: 'A', vote: '3' }, { name: 'B', vote: '5' },
    ]);
    expect(s.result).toBe('5');
    expect(s.median).toBe('4.0');

    // [5,8] → median = 6.5 → tie 5↔8 → 8.
    const s2 = computeStats([
      { name: 'A', vote: '5' }, { name: 'B', vote: '8' },
    ]);
    expect(s2.result).toBe('8');
    expect(s2.median).toBe('6.5');
  });
});

describe('roundToCard — reveal background display rule', () => {
  // Baseline: the deck the app actually ships.
  it('deck matches the numeric planning-poker cards', () => {
    expect(DECK).toEqual([1, 2, 3, 5, 8, 13, 21]);
  });

  // Exact matches are trivially themselves.
  it('returns the exact card when avg hits one', () => {
    expect(roundToCard(1)).toBe(1);
    expect(roundToCard(2)).toBe(2);
    expect(roundToCard(3)).toBe(3);
    expect(roundToCard(5)).toBe(5);
    expect(roundToCard(8)).toBe(8);
    expect(roundToCard(13)).toBe(13);
    expect(roundToCard(21)).toBe(21);
  });

  // The screenshot the user reported: 2 and 5 → avg 3.5, closer to 3 than
  // to 5 by a full point, so the background should say "3".
  it('rounds avg 3.5 to 3 (closer neighbor)', () => {
    expect(roundToCard(3.5)).toBe(3);
  });

  // Same bug report: 2 and 13 → avg 7.5, closer to 8 than to 5.
  it('rounds avg 7.5 to 8 (closer neighbor)', () => {
    expect(roundToCard(7.5)).toBe(8);
  });

  // Tie-break rule: equidistant averages round UP (pessimistic).
  it('rounds a 3↔5 tie (avg 4) UP to 5', () => {
    expect(roundToCard(4)).toBe(5);
  });
  it('rounds a 1↔2 tie (avg 1.5) UP to 2', () => {
    expect(roundToCard(1.5)).toBe(2);
  });
  it('rounds a 5↔8 tie (avg 6.5) UP to 8', () => {
    expect(roundToCard(6.5)).toBe(8);
  });
  it('rounds a 13↔21 tie (avg 17) UP to 21', () => {
    expect(roundToCard(17)).toBe(21);
  });

  // Everything below the smallest card clamps to 1; everything above the
  // largest clamps to 21 — the background never shows an off-deck number.
  it('clamps below the deck to 1', () => {
    expect(roundToCard(0)).toBe(1);
    expect(roundToCard(0.5)).toBe(1);
    expect(roundToCard(-3)).toBe(1);
  });
  it('clamps above the deck to 21', () => {
    expect(roundToCard(21.5)).toBe(21);
    expect(roundToCard(100)).toBe(21);
  });

  // Nulls and NaN must propagate as null so the caller can skip rendering.
  it('returns null for null/undefined/NaN input', () => {
    expect(roundToCard(null)).toBeNull();
    expect(roundToCard(undefined)).toBeNull();
    expect(roundToCard(NaN)).toBeNull();
    expect(roundToCard('abc')).toBeNull();
  });

  // String numerics are coerced because computeDisplayCard passes through
  // Number() already, but defend against callers that forget.
  it('coerces numeric strings', () => {
    expect(roundToCard('3.5')).toBe(3);
    expect(roundToCard('7.5')).toBe(8);
  });

  // Several Fibonacci averages that came up in grooming sessions.
  it('handles common 3-player averages', () => {
    // (1+2+3)/3 = 2 → 2
    expect(roundToCard(2)).toBe(2);
    // (2+3+5)/3 ≈ 3.33 → 3
    expect(roundToCard(10 / 3)).toBe(3);
    // (3+5+8)/3 ≈ 5.33 → 5
    expect(roundToCard(16 / 3)).toBe(5);
    // (5+8+13)/3 ≈ 8.67 → 8 (|8-8.67|=0.67, |13-8.67|=4.33)
    expect(roundToCard(26 / 3)).toBe(8);
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
  const sanitize = (name) => String(name).trim().replace(/[.$#[\]/]/g, '');

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
