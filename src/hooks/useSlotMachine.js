/**
 * useSlotMachine — the phase machine for the PM Crowning Machine ceremony.
 *
 * Consumes a frozen ceremony payload (from Firebase `meta/pmRoulette`) and
 * exposes a single derived `phaseState` object that the visual components
 * (`SlotMachine`, `SlotReel`, `SlotMachineStage`, etc.) render from.
 *
 * Pure computation functions (computePhaseState, computeCrownRemoval,
 * computeCrownDelivery, computeReelStates) live in ../events/ceremonyPhases.js.
 * Grid position helpers live in ../engine/gridPosition.js.
 * This file owns the React hook: rAF loop, state, callbacks, key handler.
 *
 * See `.claude/pipeline-tech-design-v4.md` for the canonical spec.
 */

import { useEffect, useRef, useState } from 'react';
import {
  PHASE_TABLE_STANDARD,
  PHASE_TABLE_COMPRESSED,
  PHASE_TABLE_REDUCED,
  currentPhaseRow,
  phaseTableFor,
  totalDurationFor,
  buildReelOrder,
  placeEntryAt,
} from '../events/slotMachine';
import { shallowEqual } from '../engine/shallowEqual';
import { computePhaseState, IDLE_STATE, REEL2_CLICK_MOMENTS } from '../events/ceremonyPhases';
import { computePlayerGridPosition } from '../engine/gridPosition';

// Re-export for backward compatibility (consumed by test file and other hooks)
export { computePhaseState, computePlayerGridPosition, REEL2_CLICK_MOMENTS };

const SKIP_AFTER_MS = 2000;
const DRIFT_TOLERANCE_MS = 500;

// ---------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------

/**
 * @param {object|null} ceremony  frozen Firebase payload (or null/idle)
 * @param {object} opts
 * @param {() => void} opts.onLeaderPromote  called once at crown delivery t=1500ms
 * @param {() => void} [opts.onCeremonyComplete] called when phase reaches done
 * @returns {object} phaseState
 */
export function useSlotMachine(ceremony, { onLeaderPromote, onCeremonyComplete, ceremonyStartPos, players } = {}) {
  const [phaseState, setPhaseState] = useState(IDLE_STATE);
  const rafRef = useRef(null);
  const onLeaderPromoteRef = useRef(onLeaderPromote);
  const onCeremonyCompleteRef = useRef(onCeremonyComplete);
  const promotedRef = useRef(false);
  const completedRef = useRef(false);

  const playersRef = useRef(players);
  useEffect(() => { playersRef.current = players; }, [players]);

  useEffect(() => { onLeaderPromoteRef.current = onLeaderPromote; }, [onLeaderPromote]);
  useEffect(() => { onCeremonyCompleteRef.current = onCeremonyComplete; }, [onCeremonyComplete]);

  // Reset the "already fired" guards when a new ceremony starts.
  useEffect(() => {
    promotedRef.current = false;
    completedRef.current = false;
  }, [ceremony?.ceremonyId]);


  useEffect(() => {
    if (!ceremony) {
      setPhaseState(IDLE_STATE);
      return;
    }

    // Detect per-client reduced-motion.
    const reducedMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const table = phaseTableFor({
      wasCompressed: !!ceremony.wasCompressed,
      reducedMotion,
    });
    const totalDuration = totalDurationFor(table);

    // Clock-drift correction.
    const observedAt = Date.now();
    const clientElapsedAtObservation = observedAt - (ceremony.startedAt || observedAt);

    // Too late to play the ceremony — jump to done.
    if (clientElapsedAtObservation > totalDuration + DRIFT_TOLERANCE_MS) {
      setPhaseState({ ...IDLE_STATE, phase: 'done' });
      if (!completedRef.current) {
        completedRef.current = true;
        Promise.resolve().then(() => onCeremonyCompleteRef.current?.());
      }
      return;
    }

    const startingElapsed = Math.max(0, clientElapsedAtObservation);
    const phaseClockOriginRef = { current: observedAt - startingElapsed };

    // Capture viewport dimensions for position computation
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;

    // Pre-compute reel orders (seeded shuffle) for this ceremony.
    const reelPool = ceremony.wasCompressed
      ? [ceremony.winnerId]
      : [...ceremony.candidateIds, ...(ceremony.reelFillerIds || [])];
    const reelOrdersRaw = ceremony.reelSeeds.map((seed) => buildReelOrder(reelPool, seed));

    let reel0 = reelOrdersRaw[0];
    let reel1 = reelOrdersRaw[1];
    let reel2 = reelOrdersRaw[2];

    const nonMatchReelIndex = ceremony.wasCompressed ? null
      : (ceremony.winnerReelPair
        ? [0, 1, 2].find(i => !ceremony.winnerReelPair.includes(i))
        : null);

    if (!ceremony.wasCompressed && ceremony.winnerReelPair) {
      const midIdx0 = Math.max(1, Math.min(reel0.length - 1, 4));
      const midIdx1 = Math.max(1, Math.min(reel1.length - 1, 4));

      if (ceremony.winnerReelPair.includes(0)) {
        reel0 = placeEntryAt(reel0, ceremony.winnerId, midIdx0);
      } else if (ceremony.nonMatchReelPlayerId) {
        reel0 = placeEntryAt(reel0, ceremony.nonMatchReelPlayerId, midIdx0);
      }

      if (ceremony.winnerReelPair.includes(1)) {
        reel1 = placeEntryAt(reel1, ceremony.winnerId, midIdx1);
      } else if (ceremony.nonMatchReelPlayerId) {
        reel1 = placeEntryAt(reel1, ceremony.nonMatchReelPlayerId, midIdx1);
      }
    }

    if (!ceremony.wasCompressed) {
      const finalStopIndex = Math.max(1, Math.min(reel2.length - 1, 6));
      if (ceremony.winnerId) {
        reel2 = placeEntryAt(reel2, ceremony.winnerId, finalStopIndex);
      }
      if (ceremony.nearMissTargetId) {
        reel2 = placeEntryAt(reel2, ceremony.nearMissTargetId, Math.max(0, finalStopIndex - 1));
      }
    }
    const reelOrders = [reel0, reel1, reel2];
    const winnerIndexInReel2 = ceremony.wasCompressed
      ? 0
      : reel2.indexOf(ceremony.winnerId);
    const nearMissIndexInReel2 = ceremony.wasCompressed
      ? null
      : (ceremony.nearMissTargetId ? reel2.indexOf(ceremony.nearMissTargetId) : null);

    let reel0LandingIdx = 0;
    let reel1LandingIdx = 0;
    if (!ceremony.wasCompressed && ceremony.winnerReelPair) {
      if (ceremony.winnerReelPair.includes(0)) {
        reel0LandingIdx = reel0.indexOf(ceremony.winnerId);
      } else if (ceremony.nonMatchReelPlayerId) {
        reel0LandingIdx = reel0.indexOf(ceremony.nonMatchReelPlayerId);
      }
      if (ceremony.winnerReelPair.includes(1)) {
        reel1LandingIdx = reel1.indexOf(ceremony.winnerId);
      } else if (ceremony.nonMatchReelPlayerId) {
        reel1LandingIdx = reel1.indexOf(ceremony.nonMatchReelPlayerId);
      }
    }

    const matchedHoldRow = table.find((r) => r.phase === 'matchedHold');
    const matchedHoldAbsoluteStart = matchedHoldRow ? matchedHoldRow.startAt : 9900;

    const context = {
      ceremony,
      reelOrders,
      table,
      reducedMotion,
      winnerIndexInReel2,
      nearMissIndexInReel2,
      reel0LandingIdx,
      reel1LandingIdx,
      nonMatchReelIndex,
      matchedHoldAbsoluteStart,
      viewportWidth,
      viewportHeight,
      ceremonyStartPos,
    };

    const tick = () => {
      const now = Date.now();
      const elapsed = now - phaseClockOriginRef.current;

      // v4: Fire leader-promote at crownDelivery t=1500ms (not cabinetOut start).
      if (!promotedRef.current) {
        const row = currentPhaseRow(table, elapsed);
        if (row.phase === 'crownDelivery') {
          const phaseEl = elapsed - row.startAt;
          if (phaseEl >= 1500) {
            promotedRef.current = true;
            try { onLeaderPromoteRef.current?.(); } catch (err) {
              console.error('[useSlotMachine] leader promote failed', err);
            }
          }
        } else if (row.phase === 'done') {
          promotedRef.current = true;
          try { onLeaderPromoteRef.current?.(); } catch (err) {
            console.error('[useSlotMachine] leader promote failed', err);
          }
        }
      }

      // Inject live players on each tick so crown removal/delivery resolve
      // positions from the current grid, not the frozen ceremony snapshot.
      context.players = playersRef.current;

      const nextState = computePhaseState(elapsed, ceremony, context);

      setPhaseState((prev) => (shallowEqual(prev, nextState) ? prev : nextState));

      if (nextState.phase === 'done') {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        if (!completedRef.current) {
          completedRef.current = true;
          try { onCeremonyCompleteRef.current?.(); } catch (err) {
            console.error('[useSlotMachine] ceremony complete callback failed', err);
          }
        }
      }
    };

    const loop = () => {
      tick();
      if (rafRef.current !== null) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    rafRef.current = requestAnimationFrame(loop);

    // Skip keybind (Escape) — gated on elapsed > 2000ms.
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      const now = Date.now();
      const elapsed = now - phaseClockOriginRef.current;
      if (elapsed < SKIP_AFTER_MS) return;
      const cabinetOutStart = table.find((r) => r.phase === 'cabinetOut')?.startAt ?? 0;
      const doneStart = table.find((r) => r.phase === 'done')?.startAt ?? totalDuration;
      if (elapsed >= cabinetOutStart) {
        phaseClockOriginRef.current = now - (doneStart - 50);
      } else {
        phaseClockOriginRef.current = now - cabinetOutStart;
      }
      if (!promotedRef.current) {
        promotedRef.current = true;
        try { onLeaderPromoteRef.current?.(); } catch (err) {
          console.error('[useSlotMachine] skip-promote failed', err);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ceremony?.ceremonyId]);

  return phaseState;
}

// Exported for tests
export { PHASE_TABLE_STANDARD, PHASE_TABLE_COMPRESSED, PHASE_TABLE_REDUCED };
