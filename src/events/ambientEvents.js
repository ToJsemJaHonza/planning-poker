// @refresh reset
// ============================================================================
// Ambient event registry
// ----------------------------------------------------------------------------
// Ambient events are leader-only, low-frequency Firebase emitters that produce
// the "background life" of a room: dev quotes that pop up randomly, the fuk-
// eyes peeking pose, the post-reveal Alan coffee gag, and Richard's hungry
// late-night quotes.
//
// Like `entranceEvents.js`, this file is pure data + helpers. The driver
// hook (`useAmbientEvents`) walks the registry and calls each producer on
// the appropriate trigger. Adding a new ambient producer is one entry here
// — no other code needs to change.
//
// Producer shape:
//   {
//     name: string,
//     trigger:
//         | { kind: 'phase', when?: (ctx) => boolean }
//         | { kind: 'interval', intervalMs: number },
//     requires?: (ctx) => boolean,   // gating evaluated by the driver hook
//     run: (ctx) => void,            // produces 0+ fireSyncedEvent calls
//   }
//
// `ctx` shape (built once per render by the driver):
//   {
//     playerEntries:  [string, object][],   // sorted player entries
//     phase:          'voting' | 'revealed',
//     isLeader:       boolean,
//     syncedEvent:    object | null,
//     fireSyncedEvent: (payload, ttlMs) => void,
//     createdAt:      number,               // room creation timestamp
//   }
// ============================================================================

import {
  isRichardName,
  FUKNAMES,
  RICHARD_HUNGER_QUOTES,
  shouldRichardSpeakHunger,
} from '../components/playerList.utils';

export const DEV_QUOTES = Object.freeze([
  "It works on my machine",
  "It's not a bug, it's a feature",
  "Have you tried turning it off and on?",
  "// TODO: fix this later",
  "99 bugs in the code... fix one... 127 bugs in the code",
  "There's no place like 127.0.0.1",
  "I don't always test my code, but when I do, I do it in production",
  "git commit -m 'fixed stuff'",
  "Stackoverflow said so",
  "Works on my machine ¯\\_(ツ)_/¯",
  "sudo make me a sandwich",
  "!false — it's funny because it's true",
  "There are 10 types of people...",
  "It compiled! Ship it!",
  "My code doesn't have bugs, it has features",
  "Sleep is for the weak. We have coffee",
  "Real programmers count from 0",
  "The code is self-documenting",
  "I'll refactor this later...",
  "Who needs tests anyway?",
  "Tabs > Spaces. Fight me",
  "In my defense, it passed CI",
  "Can't reproduce. Closing ticket",
  "That's a layer 8 problem",
  "rm -rf node_modules && npm i",
  "Hello world!",
  "null pointer? I barely know her!",
  "Merge conflict. Again.",
  "LGTM 👍",
  "This should be a 2-pointer, right?",
]);

export const AMBIENT_TRIGGER = Object.freeze({
  PHASE: 'phase',
  INTERVAL: 'interval',
});

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const AMBIENT_PRODUCERS = Object.freeze([
  {
    // Leader rolls fuk-eyes per matching player on every phase change.
    // 10% chance per matching name; the resulting names list rides the
    // shared syncedEvent slot for 60s.
    name: 'fukEyes',
    trigger: { kind: AMBIENT_TRIGGER.PHASE },
    run: ({ playerEntries, fireSyncedEvent }) => {
      const fuk = [];
      playerEntries.forEach(([, data]) => {
        const displayName = data?.name || '';
        if (FUKNAMES.has(displayName.toLowerCase()) && Math.random() < 0.1) {
          fuk.push(displayName);
        }
      });
      if (fuk.length > 0) {
        fireSyncedEvent?.({ type: 'fukEyes', names: fuk }, 60000);
      }
    },
  },
  {
    // Alan coffee gag: when phase flips to revealed and Alan voted ☕,
    // 10% chance to make him say "Fullstack FE developer" 1.5s later.
    name: 'alanCoffee',
    trigger: {
      kind: AMBIENT_TRIGGER.PHASE,
      when: ({ phase }) => phase === 'revealed',
    },
    run: ({ playerEntries, fireSyncedEvent }) => {
      playerEntries.forEach(([, data]) => {
        const displayName = data?.name || '';
        if (
          displayName.toLowerCase() === 'alan'
          && data?.vote === '☕'
          && Math.random() < 0.1
        ) {
          setTimeout(() => {
            fireSyncedEvent?.(
              { type: 'devQuote', name: displayName, text: 'Fullstack FE developer' },
              4000,
            );
          }, 1500);
        }
      });
    },
  },
  {
    // Dev quote roulette — every 3s, 2% chance a random player drops an
    // IT joke into the shared bubble slot.
    name: 'devQuotes',
    trigger: { kind: AMBIENT_TRIGGER.INTERVAL, intervalMs: 3000 },
    run: ({ playerEntries, syncedEvent, fireSyncedEvent }) => {
      if (syncedEvent) return;
      const names = playerEntries.map(([, data]) => data?.name).filter(Boolean);
      if (names.length === 0) return;
      if (Math.random() >= 0.02) return;
      const name = pick(names);
      const text = pick(DEV_QUOTES);
      fireSyncedEvent?.({ type: 'devQuote', name, text }, 3000);
    },
  },
  {
    // Richard hunger quotes — only kicks in once the room is at least 1h
    // old (gating done by `shouldRichardSpeakHunger`). 40% chance per
    // 15s tick.
    name: 'richardHunger',
    trigger: { kind: AMBIENT_TRIGGER.INTERVAL, intervalMs: 15000 },
    requires: ({ createdAt }) => typeof createdAt === 'number' && createdAt > 0,
    run: ({ playerEntries, syncedEvent, fireSyncedEvent, createdAt }) => {
      if (syncedEvent) return;
      const richardEntry = playerEntries.find(([, data]) => isRichardName(data?.name));
      if (!richardEntry) return;
      const now = Date.now();
      if (!shouldRichardSpeakHunger({
        hasRichard: true,
        roomAgeMs: now - createdAt,
        now,
        syncedEvent,
      })) return;
      if (Math.random() >= 0.4) return;
      const text = pick(RICHARD_HUNGER_QUOTES);
      fireSyncedEvent?.({ type: 'devQuote', name: richardEntry[1].name, text }, 4000);
    },
  },
]);

/**
 * Pure derivation: which fuk-eyes names are currently active given the
 * Firebase-synced event slot. Exposed so the player-models hook (and tests)
 * can compute the set without owning the registry knowledge.
 */
export function deriveFukEyesSet(syncedEvent) {
  return new Set(syncedEvent?.type === 'fukEyes' ? syncedEvent.names : []);
}

/**
 * Pure derivation: the currently-rendered dev-quote payload, or null.
 */
export function deriveActiveQuote(syncedEvent) {
  return syncedEvent?.type === 'devQuote' ? syncedEvent : null;
}
