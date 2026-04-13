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
 *   1. Derives which player (by stable ID), if any, is currently being
 *      "taken over" by a cinematic (so PlayerList can hide them from the
 *      grid). Keying by ID — not display name — means two "Richards" with
 *      different session IDs each get their own shot at the train.
 *   2. Watches the player list and, on the leader's client, fires a
 *      Firebase syncedEvent when a matching newly-joined player rolls
 *      their entrance.
 *   3. Enforces cinematic mutual exclusion: if another entrance is already
 *      on screen, it refuses to fire a second one.
 *   4. Exposes an `arrivedPlayers` Set and a `markArrived(id)` callback.
 *      When the cinematic component finishes its handoff (figure is sitting
 *      exactly over the grid slot), it calls `markArrived(id)`. This
 *      flips the target player from "hidden placeholder" to "visible" on
 *      the current client immediately, independent of Firebase latency —
 *      which is what the handoff animation needs to avoid flicker.
 *
 * Return value:
 *   {
 *     activeEntrance: { event, payload } | null
 *     hiddenPlayers:  Set<string>   // player IDs being taken over right now
 *     markArrived:    (id: string) => void
 *     recentArrivals: Set<string>   // IDs that arrived within the last ~1s
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
  // Tracks which player IDs we've already rolled for — so re-renders don't
  // keep re-rolling the same player every tick, AND two same-named players
  // each get their own independent chance.
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
  // which player it's replacing via `getHiddenPlayer` (returning the ID).
  // A locally-tracked "arrivedPlayers" override immediately un-hides them
  // once the cinematic hands off, so we don't wait for Firebase to clear.
  const hiddenPlayers = new Set();
  if (activeEntrance) {
    const id = activeEntrance.event.getHiddenPlayer?.(activeEntrance.payload);
    if (id && !arrivedPlayers.has(id)) hiddenPlayers.add(id);
  }

  const markArrived = useCallback((id) => {
    if (!id) return;
    setArrivedPlayers((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setRecentArrivals((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    // Clear the "recent" marker after ~1s so the pulse animation can play
    // once per arrival. Any existing timer for this ID is reset.
    const existing = recentTimersRef.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setRecentArrivals((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      recentTimersRef.current.delete(id);
    }, 1000);
    recentTimersRef.current.set(id, timer);
  }, []);

  // Cleanup any pending recency timers on unmount so tests using fake
  // timers don't warn about leaks.
  useEffect(() => {
    const timers = recentTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  // Fire triggers on new arrivals (leader only). We depend on a stable
  // string of player IDs so the effect only runs when the set changes.
  const idsKey = playerEntries.map(([id]) => id).join(',');

  useEffect(() => {
    if (!isLeader) return;

    // Another cinematic already on screen? No new one can start this tick.
    let cinematicClaimedThisTick = !!activeEntrance;

    for (const [id, data] of playerEntries) {
      if (triggeredRef.current.has(id)) continue;

      const displayName = data?.name || '';
      const match = findEntranceForName(displayName);
      if (!match) continue;

      // Mark this ID processed so we don't re-roll on every re-render.
      triggeredRef.current.add(id);

      if (cinematicClaimedThisTick) continue;
      const roll = Math.random();
      if (roll >= ENTRANCE_CHANCE) continue;

      const payload = match.buildPayload(id, displayName);
      const fired = fireSyncedEvent?.(payload, match.duration);
      // fireSyncedEvent is now async — it returns a promise. Treat any
      // non-`false` value (including a pending promise) as "fired" so we
      // still claim the tick and stop rolling on subsequent names.
      if (fired !== false) {
        cinematicClaimedThisTick = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, isLeader]);

  // Expose the registry so PlayerList / Room can iterate if they need to.
  return {
    activeEntrance,
    hiddenPlayers,
    markArrived,
    recentArrivals,
    ENTRANCE_EVENTS,
  };
}
