/**
 * useAmbientEvents — leader-only periodic event producers.
 *
 * Extracted from PlayerList so the grid component stays a pure renderer.
 * The leader client rolls for fuk eyes, dev quotes, Alan coffee, and
 * Richard hunger quotes; all results are synced to Firebase and consumed
 * by every client via the returned derived state.
 */

import { useEffect, useMemo } from 'react';
import {
  isRichardName,
  FUKNAMES,
  RICHARD_HUNGER_QUOTES,
  shouldRichardSpeakHunger,
} from '../components/playerList.utils';

const DEV_QUOTES = [
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
];

/**
 * @param {object} opts
 * @param {[string, object][]} opts.playerEntries - sorted player entries
 * @param {string} opts.phase - 'voting' | 'revealed'
 * @param {boolean} opts.isLeader
 * @param {object|null} opts.syncedEvent - current synced event from Firebase
 * @param {function} opts.fireSyncedEvent
 * @param {number} opts.createdAt - room creation timestamp
 * @returns {{ fukEyesSet: Set<string>, activeQuote: object|null }}
 */
export function useAmbientEvents({
  playerEntries,
  phase,
  isLeader,
  syncedEvent,
  fireSyncedEvent,
  createdAt,
}) {
  // Fuk eyes — leader decides on phase change
  useEffect(() => {
    if (!isLeader) return;
    const fuk = [];
    playerEntries.forEach(([, data]) => {
      const displayName = data.name || '';
      if (FUKNAMES.has(displayName.toLowerCase()) && Math.random() < 0.1) {
        fuk.push(displayName);
      }
    });
    if (fuk.length > 0) {
      fireSyncedEvent?.({ type: 'fukEyes', names: fuk }, 60000);
    }
  }, [phase, isLeader]);

  // Alan coffee — leader fires on reveal
  useEffect(() => {
    if (!isLeader || phase !== 'revealed') return;
    playerEntries.forEach(([, data]) => {
      const displayName = data.name || '';
      if (displayName.toLowerCase() === 'alan' && data.vote === '☕' && Math.random() < 0.1) {
        setTimeout(() => {
          fireSyncedEvent?.({ type: 'devQuote', name: displayName, text: 'Fullstack FE developer' }, 4000);
        }, 1500);
      }
    });
  }, [phase, isLeader]);

  // Dev quotes — leader triggers, 2% chance every 3s
  useEffect(() => {
    if (!isLeader) return;
    const names = playerEntries.map(([, data]) => data.name).filter(Boolean);
    if (names.length === 0) return;
    const interval = setInterval(() => {
      if (syncedEvent) return;
      if (Math.random() < 0.02) {
        const name = names[Math.floor(Math.random() * names.length)];
        const text = DEV_QUOTES[Math.floor(Math.random() * DEV_QUOTES.length)];
        fireSyncedEvent?.({ type: 'devQuote', name, text }, 3000);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [playerEntries.length, isLeader, syncedEvent]);

  // Richard hunger quotes — after 1 hour
  useEffect(() => {
    if (!isLeader || typeof createdAt !== 'number' || !createdAt) return;
    const richardEntry = playerEntries.find(([, data]) => isRichardName(data.name));
    if (!richardEntry) return;
    const interval = setInterval(() => {
      if (syncedEvent) return;
      const now = Date.now();
      if (!shouldRichardSpeakHunger({
        hasRichard: true,
        roomAgeMs: now - createdAt,
        now,
        syncedEvent,
      })) return;
      if (Math.random() >= 0.4) return;
      const text = RICHARD_HUNGER_QUOTES[Math.floor(Math.random() * RICHARD_HUNGER_QUOTES.length)];
      fireSyncedEvent?.({ type: 'devQuote', name: richardEntry[1].name, text }, 4000);
    }, 15000);
    return () => clearInterval(interval);
  }, [isLeader, createdAt, playerEntries.length, syncedEvent]);

  // Derived state for rendering
  const fukEyesSet = useMemo(
    () => new Set(syncedEvent?.type === 'fukEyes' ? syncedEvent.names : []),
    [syncedEvent]
  );

  const activeQuote = syncedEvent?.type === 'devQuote' ? syncedEvent : null;

  return { fukEyesSet, activeQuote };
}
