/**
 * useAmbientEvents — leader-only periodic event producers.
 *
 * Thin driver over the `AMBIENT_PRODUCERS` registry in
 * `events/ambientEvents.js`. The registry owns *which* ambient events
 * exist and *when* they fire; this hook only handles the React plumbing:
 *   - Phase-trigger producers run inside a useEffect keyed on phase.
 *   - Interval-trigger producers all share a single 1s MotionRuntime tick.
 *     Each producer carries its own `intervalMs`; the dispatcher tracks
 *     each producer's last-fired timestamp and invokes it when due.
 *
 * One shared ticker means we replace four scattered setIntervals with a
 * single rAF-driven 1Hz heartbeat that the rest of the engine already pays
 * for. The hook returns `{ fukEyesSet, activeQuote }` unchanged.
 */

import { useEffect, useRef } from 'react';
import { useFrameTicker } from '../engine/useFrameTicker';
import {
  AMBIENT_PRODUCERS,
  AMBIENT_TRIGGER,
  deriveActiveQuote,
  deriveFukEyesSet,
} from '../events/ambientEvents';

const INTERVAL_PRODUCERS = AMBIENT_PRODUCERS.filter(
  (p) => p.trigger.kind === AMBIENT_TRIGGER.INTERVAL,
);
const PHASE_PRODUCERS = AMBIENT_PRODUCERS.filter(
  (p) => p.trigger.kind === AMBIENT_TRIGGER.PHASE,
);

// Coarsest tick we need to honour any interval producer (1s here).
// All producers happen to be multiples of 1000ms; if a sub-second producer
// is ever added, drop this constant — the dispatcher already handles
// arbitrary intervalMs values via per-producer "last fired" timestamps.
const DISPATCH_TICK_MS = 1000;

export function useAmbientEvents({
  playerEntries,
  phase,
  isLeader,
  syncedEvent,
  fireSyncedEvent,
  createdAt,
}) {
  // Stash the latest ctx so the shared ticker callback always sees fresh
  // state without re-subscribing to the runtime on every render.
  const ctxRef = useRef(null);
  ctxRef.current = {
    playerEntries,
    phase,
    isLeader,
    syncedEvent,
    fireSyncedEvent,
    createdAt,
  };

  // Per-producer "last fired" timestamps (Map<name, ms>). Mounted once.
  const lastFiredRef = useRef(new Map());

  // Phase-trigger producers fire whenever phase or leadership flips.
  useEffect(() => {
    if (!isLeader) return;
    const ctx = ctxRef.current;
    for (const p of PHASE_PRODUCERS) {
      if (p.requires && !p.requires(ctx)) continue;
      if (p.trigger.when && !p.trigger.when(ctx)) continue;
      p.run(ctx);
    }
    // Producers read the rest of ctx via ctxRef; phase + isLeader are the
    // only edges we want to fire on.
  }, [phase, isLeader]);

  // Reset per-producer timestamps to "now" whenever leadership changes so
  // a freshly-promoted leader doesn't accidentally fire every producer on
  // its first dispatch tick (preserves the old setInterval semantics: wait
  // intervalMs before the first fire).
  useEffect(() => {
    if (!isLeader) {
      lastFiredRef.current.clear();
      return;
    }
    const now = Date.now();
    for (const p of INTERVAL_PRODUCERS) {
      lastFiredRef.current.set(p.name, now);
    }
  }, [isLeader]);

  // Single shared ticker for every interval producer. Disabled entirely
  // when we're not the leader so non-leader clients pay nothing.
  useFrameTicker(
    DISPATCH_TICK_MS,
    () => {
      const ctx = ctxRef.current;
      if (!ctx.isLeader) return;
      const now = Date.now();
      for (const p of INTERVAL_PRODUCERS) {
        if (p.requires && !p.requires(ctx)) continue;
        const last = lastFiredRef.current.get(p.name) ?? now;
        if (now - last < p.trigger.intervalMs) continue;
        lastFiredRef.current.set(p.name, now);
        p.run(ctx);
      }
    },
    isLeader,
  );

  return {
    fukEyesSet: deriveFukEyesSet(syncedEvent),
    activeQuote: deriveActiveQuote(syncedEvent),
  };
}
