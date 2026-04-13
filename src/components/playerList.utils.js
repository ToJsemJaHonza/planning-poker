// Pure utilities used by PlayerList.
// Kept in a separate module so PlayerList.jsx only exports a default
// React component — that satisfies Vite's Fast Refresh rules and keeps
// HMR updates surgical (editing PlayerList doesn't force a full reload).

const ENTER_DIRECTIONS = ['left', 'right'];

const RICHARD_ALIASES = new Set([
  'richard',
  'ricardo',
  'ricardino',
  'ricardito',
  'ricardinho',
]);

export function isRichardName(name) {
  if (!name) return false;
  const clean = String(name).toLowerCase().replace(/\./g, '');
  return RICHARD_ALIASES.has(clean);
}

export function hashDir(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  const abs = Math.abs(h);
  return {
    dir: ENTER_DIRECTIONS[abs % 2],
    // 2.6s to 3.95s — long enough to see them actually walking in
    duration: 2.6 + (abs % 10) * 0.15,
  };
}

export const FUKNAMES = new Set(['františek', 'fanda']);

// Tomáš variants — matches "Tomáš", "Tomas", "Tom", "Tomi", "Tomik", "Tommy"
// and their lowercase/uppercase/accented spellings.
const TOMAS_ALIASES = new Set([
  'tomas', 'tomáš', 'tomik', 'tomík', 'tomi',
  'tom', 'tommy', 'tomasz', 'tomaš',
]);

export function isTomasName(name) {
  if (!name) return false;
  const clean = String(name).toLowerCase().replace(/\./g, '');
  return TOMAS_ALIASES.has(clean);
}

// Quotes Richard cycles through when a room has been open for more than an
// hour and he's clearly starving.
export const RICHARD_HUNGER_QUOTES = [
  "Guys, I'm hungry",
  "Is it lunch time yet?",
  "My stomach is doing merge conflicts",
  "Can we wrap this up? I need food",
  "I'd estimate this ticket as 'pizza points'",
  "Someone order sushi already",
  "This sprint is longer than my fast",
  "RAM is full, tummy is empty",
  "I can't vote, my brain ran out of calories",
  "☕ is not food. Please send food",
  "Richard.exe needs snacks",
  "Who wants to refactor lunch?",
];

// Room-age threshold after which Richard starts demanding food (ms). 1 hour.
export const RICHARD_HUNGER_THRESHOLD_MS = 60 * 60 * 1000;

/**
 * Decide if Richard should speak a hunger quote this tick.
 * Pure helper so it's trivially testable.
 */
export function shouldRichardSpeakHunger({ hasRichard, roomAgeMs, now, syncedEvent }) {
  if (!hasRichard) return false;
  if (roomAgeMs < RICHARD_HUNGER_THRESHOLD_MS) return false;
  // Don't steal the spotlight from important events
  if (syncedEvent && (syncedEvent.type === 'train' || syncedEvent.type === 'chicken' || syncedEvent.type === 'dbbPipeline')) {
    return false;
  }
  // Deterministic-ish: pick a quote based on a slow time bucket so every
  // client agrees (we want global sync per CLAUDE.md rule) but it doesn't
  // need a Firebase round trip. Caller still decides via the leader to
  // write to `syncedEvent` for true consistency.
  return typeof now === 'number';
}

