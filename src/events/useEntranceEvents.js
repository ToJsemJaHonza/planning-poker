// @refresh reset
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ENTRANCE_EVENTS,
  ENTRANCE_CHANCE,
  findEntranceByType,
  findEntranceForName,
} from './entranceEvents';

/**
 * The engine that runs every entrance event. Given the current room state
 * (players + the Firebase-synced event flag), it:
 *
 *   1. Derives which player name, if any, is currently being "taken over"
 *      by a cinematic (so PlayerList can hide them from the grid).
 *   2. Watches the player list and, on the leader's client, fires a
 *      Firebase syncedEvent when a matching newly-joined player rolls
 *      their entrance.
 *   3. Enforces cinematic mutual exclusion: if another entrance is already
 *      on screen, it refuses to fire a second one.
 *   4. Exposes an `arrivedPlayers` Set and a `markArrived(name)` callback.
 *      When the cinematic component finishes its handoff (figure is sitting
 *      exactly over the grid slot), it calls `markArrived(name)`. This
 *      flips the target player from "hidden placeholder" to "visible" on
 *      the current client immediately, independent of Firebase latency —
 *      which is what the handoff animation needs to avoid flicker.
 *
 * Return value:
 *   {
 *     activeEntrance: { event, payload } | null
 *     hiddenPlayers:  Set<string>
 *     markArrived:    (name: string) => void
 *     recentArrivals: Set<string>   // names that arrived within the last ~1s
 *   }
 *
 * Pure, deterministic reads from Firebase state plus a tiny local override
 * set. That means React Strict Mode's simulated unmount/remount can't
 * desync this hook from the global truth.
 */
export function useEntranceEvents({
  playerEntries,
  isLeader,
  syncedEvent,
  fireSyncedEvent,
}) {
  const triggeredRef = useRef(new Set());
  const [arrivedPlayers, setArrivedPlayers] = useState(() => new Set());
  const [recentArrivals, setRecentArrivals] = useState(() => new Set());
  const recentTimersRef = useRef(new Map());

  // Clear stale local overrides whenever the Firebase event slot is empty
  // — once the real cinematic flag has gone away, any "just arrived"
  // override can be discarded too. Without this, the override would leak
  // and prevent a future re-trigger of the same player (e.g. Richard
  // leaves and re-joins within a few minutes).
  useEffect(() => {
    if (!syncedEvent) {
      if (arrivedPlayers.size > 0) {
        setArrivedPlayers(new Set());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncedEvent]);

  // Which registry entry (if any) matches the currently-active Firebase event?
  const activeEvent = syncedEvent ? findEntranceByType(syncedEvent.type) : null;
  const activeEntrance = activeEvent
    ? { event: activeEvent, payload: syncedEvent }
    : null;

  // Build the "hide these players from the grid" set. Each event decides
  // which player it's replacing via `getHiddenPlayer`. A locally-tracked
  // "arrivedPlayers" override immediately un-hides them once the cinematic
  // hands off, so we don't wait for Firebase to clear.
  const hiddenPlayers = new Set();
  if (activeEntrance) {
    const name = activeEntrance.event.getHiddenPlayer?.(activeEntrance.payload);
    if (name && !arrivedPlayers.has(name)) hiddenPlayers.add(name);
  }

  const markArrived = useCallback((name) => {
    if (!name) return;
    setArrivedPlayers((prev) => {
      if (prev.has(name)) return prev;
      const next = new Set(prev);
      next.add(name);
      return next;
    });
    setRecentArrivals((prev) => {
      const next = new Set(prev);
      next.add(name);
      return next;
    });
    // Clear the "recent" marker after ~1s so the pulse animation can play
    // once per arrival. Any existing timer for this name is reset.
    const existing = recentTimersRef.current.get(name);
    if (existing) clearTimeout(existing);
    const id = setTimeout(() => {
      setRecentArrivals((prev) => {
        if (!prev.has(name)) return prev;
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
      recentTimersRef.current.delete(name);
    }, 1000);
    recentTimersRef.current.set(name, id);
  }, []);

  // Cleanup any pending recency timers on unmount so tests using fake
  // timers don't warn about leaks.
  useEffect(() => {
    const timers = recentTimersRef.current;
    return () => {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
    };
  }, []);

  // Fire triggers on new arrivals (leader only). We depend on a stable
  // string of player names so the effect only runs when the set changes.
  const namesKey = playerEntries.map(([n]) => n).join(',');

  useEffect(() => {
    if (!isLeader) return;

    // Another cinematic already on screen? No new one can start this tick.
    let cinematicClaimedThisTick = !!activeEntrance;

    for (const [name] of playerEntries) {
      if (triggeredRef.current.has(name)) continue;

      const match = findEntranceForName(name);
      if (!match) continue;

      // Mark this player processed so we don't re-roll on every re-render.
      triggeredRef.current.add(name);

      if (cinematicClaimedThisTick) continue;
      const roll = Math.random();
      if (roll >= ENTRANCE_CHANCE) continue;

      const payload = match.buildPayload(name);
      const fired = fireSyncedEvent?.(payload, match.duration);
      // fireSyncedEvent is now async — it returns a promise. Treat any
      // non-`false` value (including a pending promise) as "fired" so we
      // still claim the tick and stop rolling on subsequent names.
      if (fired !== false) {
        cinematicClaimedThisTick = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesKey, isLeader]);

  // Expose the registry so PlayerList / Room can iterate if they need to.
  return {
    activeEntrance,
    hiddenPlayers,
    markArrived,
    recentArrivals,
    ENTRANCE_EVENTS,
  };
}
