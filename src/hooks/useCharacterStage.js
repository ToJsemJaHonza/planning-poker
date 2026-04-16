/**
 * useCharacterStage — the single source of truth for every live character.
 *
 * Owns a `Map<id, Character>` and drives it from the shared MotionRuntime.
 * Directors (usePmDirector, usePlayerDirector, useEntranceDirector) call
 * `stage.add` / `stage.get(id).walkTo(...)` etc.; the CharacterStage
 * component reads the map and paints each character.
 *
 * This is the only place rAF is subscribed for character movement — the
 * old per-entity rAFs (usePmPosition, useCinematicHandoff, CSS keyframes
 * for player walk-in/out — all deleted) funnel through here.
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { subscribe as subscribeMotion } from '../engine/MotionRuntime';
import { createCharacter, tickAll } from '../engine/character';

/**
 * Build a stage runtime that is *not* coupled to React — useful for tests
 * and for ad-hoc consumers (e.g. the director hooks drive this via
 * `useCharacterStage()`, but tests construct one directly).
 */
export function createStageRuntime() {
  const characters = new Map();
  let version = 0;
  const listeners = new Set();

  const notify = () => {
    version = (version + 1) >>> 0; // stay in 32-bit positive range
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        console.error('[characterStage] listener threw', err);
      }
    }
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const getVersion = () => version;

  const runtime = {
    characters,
    subscribe,
    getVersion,

    tick(now) {
      tickAll(characters, now);
      notify();
    },

    add(config) {
      if (characters.has(config.id)) return characters.get(config.id);
      const char = createCharacter(config);
      characters.set(config.id, char);
      notify();
      return char;
    },

    /**
     * Get-or-create. Lets a director call `stage.ensure({ id, ... })` every
     * render without needing to track "did I add this yet" externally.
     */
    ensure(config) {
      return characters.get(config.id) ?? runtime.add(config);
    },

    remove(id) {
      if (characters.delete(id)) notify();
    },

    get(id) {
      return characters.get(id);
    },
    has(id) {
      return characters.has(id);
    },
    all() {
      return Array.from(characters.values());
    },
    size() {
      return characters.size;
    },
    clear() {
      if (characters.size === 0) return;
      characters.clear();
      notify();
    },
  };

  return runtime;
}

/**
 * React hook. Returns a stage runtime whose rAF loop is bound to the
 * component's mount lifecycle via MotionRuntime.
 */
export function useCharacterStage() {
  const stageRef = useRef(null);
  if (stageRef.current === null) {
    stageRef.current = createStageRuntime();
  }
  const stage = stageRef.current;

  useEffect(() => {
    return subscribeMotion((now) => {
      stage.tick(now);
    });
  }, [stage]);

  // Expose version changes to suspense-safe consumers (CharacterStage uses
  // its own useSyncExternalStore; this call here keeps the hosting
  // component re-rendering on structural stage changes too).
  useSyncExternalStore(stage.subscribe, stage.getVersion, stage.getVersion);

  return stage;
}
