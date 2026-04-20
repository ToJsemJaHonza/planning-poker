// Pure helper for the Landing "tasks to groom" step. Extracted so Landing
// can keep a single default component export (Fast Refresh rule) and so
// the normalization rules are unit-testable without rendering React.

import { normalizeUrl } from './urls.utils';

/**
 * Normalize raw {title, url} rows collected from the Landing form into the
 * shape consumed by useRoom's initial-seed path.
 *
 * Rules:
 *   - title is trimmed; rows with an empty title (after trim) are dropped
 *   - url is passed through `normalizeUrl` — bare domains like `seznam.cz`
 *     become `https://seznam.cz`; javascript:/data:/mailto: are rejected
 *   - returns [{ title: string, url: string | null }] preserving input order
 */
export function normalizeTaskRows(rows) {
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    if (!title) continue;
    const url = normalizeUrl(row.url);
    out.push({ title, url });
  }
  return out;
}
