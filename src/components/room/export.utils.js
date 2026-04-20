// Chat-friendly plaintext export for the grooming backlog.
//
// The previous TSV design forced users into a spreadsheet workflow and
// confused mixed split/non-split sessions with extra FE/BE columns. The
// new format is designed to paste straight into Slack / Teams / a pull
// request description:
//
//   Login page — https://jira/1 — 5
//   Signup form — 5
//   Password reset — https://jira/3
//   Payment flow-FE — https://jira/7 — 3
//   Payment flow-BE — https://jira/7 — 5
//
// Rules:
//   - one line per scoring outcome — split tasks emit TWO lines, one
//     suffixed `-FE` and one suffixed `-BE`, so readers see both numbers
//     without needing a second column
//   - columns (title, url, score) are joined by " — " (em-dash) and any
//     piece that's missing is simply omitted — no dangling separators
//   - ungroomed tasks still show up (title + url) so the reader sees
//     what was left unfinished
//   - output ends with a trailing newline so pasted blocks compose
//     cleanly with surrounding lines

const SEPARATOR = ' — ';

function cleanCell(value) {
  if (value == null) return '';
  // A newline in a title would break our one-line-per-row contract. Fold
  // any whitespace run into a single space — readers would do this
  // mentally anyway.
  return String(value).replace(/\s+/g, ' ').trim();
}

function joinParts(title, url, score) {
  const parts = [title];
  if (url) parts.push(url);
  if (score != null && score !== '') parts.push(String(score));
  return parts.join(SEPARATOR);
}

/**
 * Build the plaintext export from a task-list items object or ordered
 * array. Split-scored tasks expand to two lines (-FE / -BE).
 *
 * @param {object|Array} items  Firebase items map OR an ordered array
 * @returns {string} plaintext, one task-line per row, trailing newline
 */
export function buildTaskText(items) {
  const list = Array.isArray(items)
    ? items.slice()
    : Object.entries(items || {}).map(([id, it]) => ({ id, ...(it || {}) }));
  list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const lines = [];
  for (const item of list) {
    const title = cleanCell(item.title) || 'Untitled';
    const url = item.url ? cleanCell(item.url) : '';
    const hasSplit = item.scoreFe != null || item.scoreBe != null;

    if (hasSplit) {
      // Only emit a side-row if we actually have a score for that side.
      // Edge case: one side had zero voters → that side's score is null,
      // so we just skip its line rather than printing "-FE" with nothing.
      if (item.scoreFe != null) {
        lines.push(joinParts(`${title}-FE`, url, item.scoreFe));
      }
      if (item.scoreBe != null) {
        lines.push(joinParts(`${title}-BE`, url, item.scoreBe));
      }
    } else {
      lines.push(joinParts(title, url, item.score));
    }
  }
  return lines.join('\n') + '\n';
}

/**
 * Trigger a browser download of the given content as a .txt file.
 * No-op in environments without `document` (e.g. pure Node tests).
 */
export function triggerDownload(filename, content) {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Free the blob URL; revoke is safe to call even if the anchor's click
  // is still propagating.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Best-effort copy to clipboard. Returns a Promise<boolean> — `false` when
 * no clipboard API is available (older Safari / non-HTTPS) so the caller
 * can still show a fallback UI if they care.
 */
export async function copyToClipboard(content) {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
}
