// Pure stats computation for ResultModal — extracted so ResultModal.jsx can
// keep a single default component export (needed for Vite Fast Refresh).

export function computeStats(voteList) {
  const numeric = voteList.filter(v => !isNaN(Number(v.vote))).map(v => Number(v.vote));
  const special = voteList.filter(v => isNaN(Number(v.vote)));

  const avg = numeric.length > 0
    ? (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1)
    : '-';

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

  return { avg, spread, emoji, verdict, color, distribution, maxCount, special };
}
