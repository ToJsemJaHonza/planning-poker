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

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  currentPhaseRow,
  phaseTableFor,
  totalDurationFor,
  precomputeReelOrders,
} from '../events/slotMachine';
import { shallowEqual } from '../engine/shallowEqual';
import { computePhaseState, IDLE_STATE } from '../events/ceremonyPhases';
import { useAnimationLoop } from '../engine/useAnimationLoop';


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
export function useSlotMachine(ceremony, { onLeaderPromote, onCeremonyComplete, ceremonyStartPos, players, gridTop } = {}) {
  const [phaseState, setPhaseState] = useState(IDLE_STATE);
  const onLeaderPromoteRef = useRef(onLeaderPromote);
  const onCeremonyCompleteRef = useRef(onCeremonyComplete);
  const promotedRef = useRef(false);
  const completedRef = useRef(false);
  const skipOffsetRef = useRef(0);
  const contextRef = useRef(null);

  const playersRef = useRef(players);
  useEffect(() => { playersRef.current = players; }, [players]);

  useEffect(() => { onLeaderPromoteRef.current = onLeaderPromote; }, [onLeaderPromote]);
  useEffect(() => { onCeremonyCompleteRef.current = onCeremonyComplete; }, [onCeremonyComplete]);

  // Reset the "already fired" guards when a new ceremony starts.
  useEffect(() => {
    promotedRef.current = false;
    completedRef.current = false;
    skipOffsetRef.current = 0;
  }, [ceremony?.ceremonyId]);

  // Precompute context once per ceremony (stable across ticks).
  useEffect(() => {
    if (!ceremony) { contextRef.current = null; return; }

    const reducedMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const table = phaseTableFor({
      wasCompressed: !!ceremony.wasCompressed,
      reducedMotion,
    });

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;

    const {
      reelOrders, winnerIndexInReel2, nearMissIndexInReel2,
      reel0LandingIdx, reel1LandingIdx, nonMatchReelIndex,
    } = precomputeReelOrders(ceremony);

    const matchedHoldRow = table.find((r) => r.phase === 'matchedHold');

    contextRef.current = {
      ceremony,
      reelOrders,
      table,
      reducedMotion,
      winnerIndexInReel2,
      nearMissIndexInReel2,
      reel0LandingIdx,
      reel1LandingIdx,
      nonMatchReelIndex,
      matchedHoldAbsoluteStart: matchedHoldRow ? matchedHoldRow.startAt : 9900,
      viewportWidth,
      viewportHeight,
      ceremonyStartPos,
      gridTop,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ceremony?.ceremonyId]);

  // Check for stale ceremony — jump to done if too late to play.
  const staleChecked = useRef(false);
  useEffect(() => {
    staleChecked.current = false;
  }, [ceremony?.ceremonyId]);

  useEffect(() => {
    if (!ceremony || staleChecked.current) return;
    staleChecked.current = true;

    const table = phaseTableFor({
      wasCompressed: !!ceremony.wasCompressed,
      reducedMotion: typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    const totalDuration = totalDurationFor(table);
    const clientElapsedAtObservation = Date.now() - (ceremony.startedAt || Date.now());

    if (clientElapsedAtObservation > totalDuration + DRIFT_TOLERANCE_MS) {
      setPhaseState({ ...IDLE_STATE, phase: 'done' });
      if (!completedRef.current) {
        completedRef.current = true;
        Promise.resolve().then(() => onCeremonyCompleteRef.current?.());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ceremony?.ceremonyId]);

  // The animation tick — called every frame by useAnimationLoop.
  const ceremonyTick = useCallback((rawElapsed) => {
    const ctx = contextRef.current;
    if (!ctx || !ceremony) return;

    const elapsed = rawElapsed + skipOffsetRef.current;
    const { table } = ctx;

    // Fire leader-promote at crownDelivery t=1500ms.
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
    ctx.players = playersRef.current;

    const nextState = computePhaseState(elapsed, ceremony, ctx);
    setPhaseState((prev) => (shallowEqual(prev, nextState) ? prev : nextState));

    if (nextState.phase === 'done' && !completedRef.current) {
      completedRef.current = true;
      try { onCeremonyCompleteRef.current?.(); } catch (err) {
        console.error('[useSlotMachine] ceremony complete callback failed', err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ceremony?.ceremonyId]);

  // Idle state when no ceremony.
  useEffect(() => {
    if (!ceremony) setPhaseState(IDLE_STATE);
  }, [ceremony?.ceremonyId]);

  // Drive the ceremony with useAnimationLoop (rAF-based).
  useAnimationLoop(
    ceremony ? ceremonyTick : null,
    ceremony?.startedAt,
  );

  // Skip keybind (Escape) — gated on elapsed > 2000ms.
  useEffect(() => {
    if (!ceremony) return;

    const table = contextRef.current?.table;
    if (!table) return;
    const totalDuration = totalDurationFor(table);

    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      const rawElapsed = Date.now() - (ceremony.startedAt || Date.now());
      const elapsed = rawElapsed + skipOffsetRef.current;
      if (elapsed < SKIP_AFTER_MS) return;

      const cabinetOutStart = table.find((r) => r.phase === 'cabinetOut')?.startAt ?? 0;
      const doneStart = table.find((r) => r.phase === 'done')?.startAt ?? totalDuration;

      if (elapsed >= cabinetOutStart) {
        skipOffsetRef.current = (doneStart - 50) - rawElapsed;
      } else {
        skipOffsetRef.current = cabinetOutStart - rawElapsed;
      }
      if (!promotedRef.current) {
        promotedRef.current = true;
        try { onLeaderPromoteRef.current?.(); } catch (err) {
          console.error('[useSlotMachine] skip-promote failed', err);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ceremony?.ceremonyId]);

  return phaseState;
}

