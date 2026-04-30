// Pure stats computation for ResultModal — extracted so ResultModal.jsx can
// keep a single default component export (needed for Vite Fast Refresh).

// Planning-poker deck (numeric cards only, skipping '?' and '☕'). The order
// matters: roundToCard walks it to find the nearest value.
export const DECK = [1, 2, 3, 5, 8, 13, 21];

// Round a numeric average to the closest card in DECK. On an exact tie
// (e.g. avg=4 between 3 and 5, or avg=1.5 between 1 and 2) we round UP —
// the pessimistic choice favored by most grooming sessions. Returns null
// for null/NaN input so callers can decide whether to render anything.
export function roundToCard(avg) {
  const n = Number(avg);
  if (avg == null || Number.isNaN(n)) return null;
  if (n <= DECK[0]) return DECK[0];
  if (n >= DECK[DECK.length - 1]) return DECK[DECK.length - 1];
  let best = DECK[0];
  let bestDist = Infinity;
  for (const card of DECK) {
    const dist = Math.abs(card - n);
    // Strict < means the first (lower) card wins when it's closer; equal
    // distance falls through and the HIGHER card (seen later in DECK)
    // overwrites — the "round up on tie" behavior.
    if (dist < bestDist || (dist === bestDist && card > best)) {
      best = card;
      bestDist = dist;
    }
  }
  return best;
}

// Median of a numeric array. For odd length, the middle element. For even
// length, the average of the two middle elements (the standard statistical
// median — kept this way so the existing roundToCard tie-break still does
// useful work when two voters disagree, e.g. [5,8] → 6.5 → 8). Returns null
// for an empty input.
//
// We use the median (not the mean) on the recommendation of Mike Cohn —
// see https://www.mountaingoatsoftware.com/blog/dont-average-during-planning-poker
// The mean lets a single outlier (one person voting 21 against a cluster
// of 5s) drag the team's committed estimate up; the median keeps the
// estimate where the majority actually is. Spread/verdict still surface
// the outlier so the discussion isn't suppressed.
export function computeMedian(nums) {
  if (!nums || nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function computeStats(voteList) {
  const numeric = voteList.filter(v => !isNaN(Number(v.vote))).map(v => Number(v.vote));
  const special = voteList.filter(v => isNaN(Number(v.vote)));

  // `median` is the raw statistical median displayed as a 1-decimal string
  // (or '-' when there are no numeric votes). The field name is `median`
  // — not `avg` — because that is what it actually is, per the rationale
  // above. `result` is the median snapped to the nearest deck card.
  const rawMedian = computeMedian(numeric);
  const median = rawMedian == null ? '-' : rawMedian.toFixed(1);
  const result = rawMedian == null ? '-' : String(roundToCard(rawMedian));

  const spread = numeric.length > 0
    ? Math.max(...numeric) - Math.min(...numeric)
    : 0;

  let emoji, verdict, color;
  if (numeric.length === 0) {
    emoji = '🤷'; verdict = 'No votes'; color = '#999';
  } else if (spread === 0) {
    emoji = '🎯'; verdict = 'Perfect match!'; color = '#4caf50';
  } else if (spread <= 2) {
    emoji = '✅'; verdict = 'Good match'; color = '#8bc34a';
  } else if (spread <= 5) {
    emoji = '💬'; verdict = 'Some spread'; color = '#d4a853';
  } else {
    emoji = '🔥'; verdict = 'Big spread!'; color = '#e53935';
  }

  // Histogram and bar-height denominator must reflect only real estimates.
  // ? and ☕ are abstain cards (per planning-poker convention: "need info"
  // / "need a break") — they shouldn't shrink the numeric bars or appear
  // as gray bars duplicating what's already in the `specials` row below.
  // Without this filter, 3-of-3 consensus + 1× ☕ rendered as a 75%-height
  // bar, breaking the "full bar = 100% agreement" invariant.
  const distribution = {};
  numeric.forEach(n => { const k = String(n); distribution[k] = (distribution[k] || 0) + 1; });
  const maxCount = Math.max(...Object.values(distribution), 1);
  const totalVotes = numeric.length;

  return { median, result, spread, emoji, verdict, color, distribution, maxCount, totalVotes, special };
}
