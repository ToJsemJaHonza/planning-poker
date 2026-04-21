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

export function computeStats(voteList) {
  const numeric = voteList.filter(v => !isNaN(Number(v.vote))).map(v => Number(v.vote));
  const special = voteList.filter(v => isNaN(Number(v.vote)));

  const avg = numeric.length > 0
    ? (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1)
    : '-';

  // The rounded result is what the room actually commits to after the
  // discussion — the nearest card in DECK, with ties rounding UP. We show
  // only this in the modal (the raw fractional average tends to invite
  // bikeshedding about whether "4.3" means 3 or 5, which is the opposite
  // of what planning-poker's deck gaps are designed to force a decision on).
  const result = numeric.length > 0 ? String(roundToCard(
    numeric.reduce((a, b) => a + b, 0) / numeric.length,
  )) : '-';

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

  const distribution = {};
  voteList.forEach(v => { distribution[v.vote] = (distribution[v.vote] || 0) + 1; });
  const maxCount = Math.max(...Object.values(distribution), 1);
  // totalVotes is the reference jmenovatel for bar heights in split mode:
  // scaling by local maxCount makes a single-vote bar look identical to a
  // full-consensus bar, which is misleading when the Frontend section
  // reached consensus but Backend didn't (or vice versa). Scaling by the
  // number of voters means a full bar = 100% agreement, 1/2 bar = half the
  // team picked this card, etc. — directly comparable across FE/BE.
  const totalVotes = voteList.length;

  return { avg, result, spread, emoji, verdict, color, distribution, maxCount, totalVotes, special };
}
