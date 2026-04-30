/**
 * useEntranceDirector — the cinematic-entrance equivalent of
 * `usePmDirector` and `usePlayerDirector`.
 *
 * The entering player's character already exists on the stage (courtesy
 * of `usePlayerDirector`), it's just hidden while the cinematic scenery
 * (train / DBB pipe / etc.) plays above the grid. When the timeline
 * reaches the "exit" beat, the cinematic component calls
 * `entranceDirector.walkFromDoor({ playerId, door })` and we:
 *
 *   1. Interrupt whatever walk-in the player director had queued.
 *   2. Teleport the character to the door pixel.
 *   3. Un-hide it.
 *   4. walkTo the player's grid slot — which we recover from the
 *      character's already-queued walk target (the director had it walk
 *      in from offscreen, so its `from` / `to` is the grid slot).
 *   5. On arrival, call `markArrived(playerId)` so PlayerList's
 *      placeholder flips to visible — by which point the character is
 *      sitting precisely on that slot.
 *
 * The old `useCinematicHandoff` used `getBoundingClientRect()` to measure
 * the target placeholder at walk time; this version reads the grid center
 * from `computePlayerGridPosition` via the director, so there's no
 * DOM-measurement race against in-progress CSS transitions.
 */

import { useMemo, useRef } from 'react';
import { computePlayerGridPosition } from '../engine/gridPosition';
import { getGroundY } from '../engine/characterLayout';

// Cinematic-entrance walk duration (train door → grid, pipe mouth → grid).
// 5× the old `useCinematicHandoff` pace so Richard / Tomáš stroll in
// rather than sprint (user feedback: "postavy jsou moc rychlé").
const DEFAULT_WALK_MS = 12500;

function clampDuration(ms) {
  return Math.max(9000, Math.min(16000, ms));
}

/**
 * @param {object} opts
 * @param {object} opts.stage
 * @param {Record<string, object>} opts.players
 * @param {(id: string) => void} [opts.markArrived]  callback to un-hide the player in PlayerList
 * @returns {{ walkFromDoor: (params: { playerId: string, door: {x,y}, duration?: number, pose?: string }) => void }}
 */
export function useEntranceDirector({ stage, players, markArrived, gridTop }) {
  const markArrivedRef = useRef(markArrived);
  markArrivedRef.current = markArrived;
  const playersRef = useRef(players);
  playersRef.current = players;
  const gridTopRef = useRef(gridTop);
  gridTopRef.current = gridTop;

  return useMemo(() => ({
    walkFromDoor({ playerId, door, duration, pose = 'walk' }) {
      if (!stage || !playerId || !door) return;
      const charId = `player-${playerId}`;
      const char = stage.get(charId);
      if (!char) return;

      const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
      // Grid slot: if the character's pending walkTo already has a target
      // (set by usePlayerDirector's join walk-in), reuse it — that's the
      // slot computed from the live roster at the right moment. If not,
      // derive it from the current player roster.
      let target = null;
      if (char.action?.type === 'walkTo') {
        target = { x: char.action.x, y: char.action.y };
      } else if (char.queue?.length) {
        const next = char.queue.find((a) => a.type === 'walkTo');
        if (next) target = { x: next.x, y: next.y };
      }
      if (!target) {
        const sorted = Object.entries(playersRef.current || {})
          .filter(([, d]) => d.role !== 'pm')
          .sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
        const idx = sorted.findIndex(([id]) => id === playerId);
        const count = sorted.length || 1;
        target = computePlayerGridPosition(idx >= 0 ? idx : 0, count, vw, gridTopRef.current);
      }

      // Distance-scaled duration mirrors the old useCinematicHandoff
      // spec (~6ms/px, clamped [1800, 3200]) so walk pacing feels the same.
      const dx = target.x - door.x;
      const dy = target.y - door.y;
      const distance = Math.hypot(dx, dy);
      const computedDuration = duration ?? (clampDuration(Math.round(distance * 6)) || DEFAULT_WALK_MS);

      char.interrupt();
      char.teleport({ x: door.x, y: door.y });
      char.hidden = false;
      // Facing: auto-flip on walkTo handles direction from dx.
      char.walkTo({
        x: target.x,
        y: target.y,
        duration: computedDuration,
        pose,
        onDone: () => {
          markArrivedRef.current?.(playerId);
        },
      });
    },
  }), [stage]);
}

// ---------------------------------------------------------------------------
// Shared door-position helpers — consumed by Train.jsx / DbbPipeline.jsx so
// the cinematic components stay decoupled from the character model.
// ---------------------------------------------------------------------------

import { CAR_H } from '../sprites/trainSprites';

/**
 * Viewport pixel coordinates (center of sprite) where Richard steps off
 * the train. Matches the layout constants in Train.jsx so the character
 * materialises exactly at the train door.
 */
export function trainDoorPosition() {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  // Train.jsx: container bottom 210, train bottom 16 inside container,
  // figure anchors at bottom (210 + CAR_H + 16) with marginLeft -30 to
  // center 60px-wide container. After SPRITE_W redesign (50px) figure
  // width is 50 — keep center x at vw/2.
  void vh;
  return {
    x: vw / 2,
    y: getGroundY(),
  };
}

/**
 * Pipe mouth position for Tomáš's DBB pipeline entrance. DbbPipeline.jsx
 * computes the actual mouth from `buildPipePath` — passing us the mouth
 * rect at walk time is preferable, but when we don't have it (edge cases,
 * tests), fall back to the viewport center with a ground-row y.
 */
export function pipeMouthFallback() {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  return { x: vw / 2, y: getGroundY() };
}

export const __testing__ = { DEFAULT_WALK_MS, clampDuration };
