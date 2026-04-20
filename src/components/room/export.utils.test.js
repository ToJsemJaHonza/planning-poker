import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildTaskText, triggerDownload, copyToClipboard } from './export.utils';

describe('buildTaskText', () => {
  it('emits one line per normal task with title — url — score', () => {
    const items = {
      t1: { title: 'Login page', url: 'https://j/1', score: '5', order: 0 },
      t2: { title: 'Signup form', url: null, score: '8', order: 1 },
    };
    expect(buildTaskText(items)).toBe(
      'Login page — https://j/1 — 5\n' +
      'Signup form — 8\n'
    );
  });

  it('expands split tasks to two lines with -FE / -BE suffixes', () => {
    const items = {
      t1: { title: 'Payment flow', url: 'https://j/7', scoreFe: '3', scoreBe: '5', order: 0 },
    };
    expect(buildTaskText(items)).toBe(
      'Payment flow-FE — https://j/7 — 3\n' +
      'Payment flow-BE — https://j/7 — 5\n'
    );
  });

  it('omits a split side when only one side was scored', () => {
    const items = [
      { title: 'Half', url: null, scoreFe: '3', scoreBe: null, order: 0 },
    ];
    expect(buildTaskText(items)).toBe('Half-FE — 3\n');
  });

  it('includes ungroomed rows (title only, no dangling separators)', () => {
    const items = [
      { title: 'Pending', url: null, score: null, order: 0 },
      { title: 'Has link', url: 'https://x', score: null, order: 1 },
    ];
    expect(buildTaskText(items)).toBe(
      'Pending\n' +
      'Has link — https://x\n'
    );
  });

  it('sorts items by order rather than key iteration', () => {
    const items = {
      z: { title: 'Third', score: '1', order: 2 },
      a: { title: 'First', score: '2', order: 0 },
      m: { title: 'Second', score: '3', order: 1 },
    };
    const rows = buildTaskText(items).trim().split('\n');
    expect(rows[0]).toMatch(/^First/);
    expect(rows[1]).toMatch(/^Second/);
    expect(rows[2]).toMatch(/^Third/);
  });

  it('folds whitespace in titles so one-line-per-row is preserved', () => {
    const items = [
      { title: 'has\ttab', url: null, score: '5', order: 0 },
      { title: 'has\nnewline', url: null, score: '8', order: 1 },
    ];
    const rows = buildTaskText(items).trim().split('\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe('has tab — 5');
    expect(rows[1]).toBe('has newline — 8');
  });

  it('accepts an items map OR an already-ordered array', () => {
    const mapOut = buildTaskText({ t1: { title: 'A', score: '5', order: 0 } });
    const arrOut = buildTaskText([{ title: 'A', score: '5', order: 0 }]);
    expect(mapOut).toBe(arrOut);
  });

  it('handles empty or missing input gracefully', () => {
    expect(buildTaskText({})).toBe('\n');
    expect(buildTaskText([])).toBe('\n');
    expect(buildTaskText(null)).toBe('\n');
  });
});

describe('triggerDownload', () => {
  let originalCreateElement;
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let clickSpy;

  beforeEach(() => {
    originalCreateElement = document.createElement.bind(document);
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    clickSpy = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob://fake');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return {
          set href(_) {},
          set download(_) {},
          click: clickSpy,
          nodeType: 1,
        };
      }
      return originalCreateElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('creates an anchor, clicks it, and revokes the blob URL', async () => {
    triggerDownload('tasks.txt', 'Login — 5\n');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 10));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob://fake');
  });
});

describe('copyToClipboard', () => {
  const originalClipboard = navigator.clipboard;
  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });
  });

  it('calls writeText and returns true on success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const ok = await copyToClipboard('hello');
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('returns false when writeText rejects (Safari non-HTTPS)', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    expect(await copyToClipboard('x')).toBe(false);
  });

  it('returns false when clipboard is not available at all', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    expect(await copyToClipboard('x')).toBe(false);
  });
});
