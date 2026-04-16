/**
 * usePmDirector — the PM's sole owner.
 *
 * One persistent Character on the shared stage is used for every phase the
 * PM appears in: idle ping-pong, slot-machine ceremony (Acts 1 & 3), and
 * the room-start mini-ceremony. Because the character instance persists
 * across all of them, there is no mount/unmount handoff for the jump to
 * hide inside.
 *
 * The director also publishes `ceremonyStartPos` — captured synchronously
 * from the live character position the moment `ceremonyActive` flips on —
 * replacing the old `useEffect`-based snapshot in `usePmPosition` that
 * raced the first ceremony render and caused the `vh-140` teleport.
 *
 * Responsibilities:
 *   1. Create/own the PM character on the given stage.
 *   2. Drive the idle ping-pong walk (same timing as old CSS/usePmPosition).
 *   3. Mirror ceremony-phase computed state (position, pose, facing,
 *      bubble, crown) into the character during slot-machine and
 *      room-start ceremonies.
 *   4. Resync the idle cycle origin when ceremonies end so the next idle
 *      frame starts from wherever the PM actually is.
 *   5. Keep the existing `usePmModel` thinking loop (quote publish,
 *      sparkle timing) running — its bubble output is piped to
 *      `char.bubble` during idle.
 */

import { useEffect, useLayoutEffect, useRef } from 'react';
import { subscribe as subscribeMotion } from '../engine/MotionRuntime';
import { useMotionMode } from '../engine/useMotionMode';
import { usePmModel } from './usePmModel';
import {
  SPRITE_H,
  getGroundY,
  getIdleWalkBounds,
} from '../engine/characterLayout';

// Idle ping-pong cycle — 48s full cycle. User wants the PM to read as a
// leisurely "rozvláklý manažer"; iterative feedback pushed this from the
// old 16s → 32s → 48s.
const IDLE_CYCLE_MS = 48000;

/**
 * Pure idle-position computation, emitting CENTER coordinates.
 * Mirrors the old usePmPosition keyframes (0–3% hold, 3–47% sweep right,
 * 47–50% hold, 50–53% flip hold, 53–97% sweep left, 97–100% hold).
 */
export function computeIdleCenter(cycleTime, vw) {
  const { minX, maxX } = getIdleWalkBounds(vw);
  const range = maxX - minX;
  const t = (((cycleTime % IDLE_CYCLE_MS) + IDLE_CYCLE_MS) % IDLE_CYCLE_MS) / IDLE_CYCLE_MS;
  if (t < 0.03) return { x: minX, facingLeft: false };
  if (t < 0.47) return { x: minX + range * ((t - 0.03) / (0.47 - 0.03)), facingLeft: false };
  if (t < 0.50) return { x: maxX, facingLeft: false };
  if (t < 0.53) return { x: maxX, facingLeft: true };
  if (t < 0.97) return { x: maxX - range * ((t - 0.53) / (0.97 - 0.53)), facingLeft: true };
  return { x: minX, facingLeft: true };
}

/**
 * Derive the cycle-time that corresponds to a given x/facing so the idle
 * walk resumes from wherever the PM currently is. Inverse of
 * `computeIdleCenter` for the moving-segment cases.
 */
function cycleTimeFromPosition(x, facingLeft, vw) {
  const { minX, maxX } = getIdleWalkBounds(vw);
  const range = maxX - minX;
  const clamped = Math.max(minX, Math.min(maxX, x));
  const fraction = range > 0 ? (clamped - minX) / range : 0;
  const t = facingLeft
    ? 0.53 + (1 - fraction) * (0.97 - 0.53)
    : 0.03 + fraction * (0.47 - 0.03);
  return t * IDLE_CYCLE_MS;
}

/**
 * Map the canonical `crownOwnership` shape used across the app into the
 * `char.crown` shape the ceremony-mode PmSprite renderer understands.
 * Returns null when the crown is not on the PM.
 */
function crownOwnershipToChar(ownership) {
  if (!ownership) return null;
  switch (ownership.location) {
    case 'lifting':
      return { mode: 'lifting', progress: ownership.progress, glowing: !!ownership.glowing };
    case 'pm-hand':
      return { mode: 'settled', progress: 1, glowing: !!ownership.glowing };
    case 'arcing-to-player':
      return { mode: 'arcing', progress: ownership.progress, glowing: !!ownership.glowing };
    case 'materializing':
      return { mode: 'materializing', progress: ownership.progress, glowing: !!ownership.glowing };
    default:
      return null;
  }
}

/**
 * Downstream hooks (`useSlotMachine`, `useRoomStartCrowning`,
 * `useCrownOwnership`) depend on `ceremonyStartPos` from this hook — and
 * this hook's ceremony mirror depends on their output. The circular edge
 * is broken by passing Refs for the mirror inputs: they're assigned later
 * in the parent render but read by the layout effect after commit, which
 * is after all refs have been updated.
 *
 * @param {object} opts
 * @param {object} opts.stage           shared CharacterStage runtime
 * @param {boolean} opts.ceremonyActive true when pmRoulette or roomStart is live
 * @param {{current: object|null}} [opts.phaseStateRef]     slotMachinePhaseState
 * @param {{current: object|null}} [opts.roomStartStateRef] useRoomStartCrowning output
 * @param {{current: object|null}} [opts.crownOwnershipRef] useCrownOwnership output
 * @param {boolean} [opts.isLeader=false]
 * @param {string} [opts.externalQuote='']
 * @param {((q:string)=>void)|null} [opts.onQuote=null]
 * @returns {{ ceremonyStartPos: {x,y}|null, pmChar: object|null }}
 */
export function usePmDirector({
  stage,
  ceremonyActive,
  phaseStateRef = null,
  roomStartStateRef = null,
  crownOwnershipRef = null,
  isLeader = false,
  externalQuote = '',
  onQuote = null,
}) {
  const motionMode = useMotionMode();

  // ── Character instance ────────────────────────────────────────────────────
  const pmCharRef = useRef(null);
  if (pmCharRef.current === null && stage) {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const { minX } = getIdleWalkBounds(vw);
    pmCharRef.current = stage.ensure({
      id: 'pm',
      sprite: 'pm',
      position: { x: minX, y: getGroundY() },
      facingLeft: false,
      pose: 'walk',
      zIndex: 50,
    });
  }
  const pmChar = pmCharRef.current;

  // ── Thinking loop (quotes, sparkles, walk-frame, pose derivation) ────────
  // Kept as-is from the old PmSprite pipeline so the leader quote loop and
  // non-leader externalQuote display both continue to work. The hook runs
  // during both idle and ceremony; we only write its output to the
  // character during idle (ceremony mirroring takes priority below).
  const pmModel = usePmModel({
    mode: ceremonyActive ? 'ceremony' : 'idle',
    isLeader,
    isCasting: false,
    externalQuote,
    onQuote,
    position: null,
    facingLeft: !!pmChar?.facingLeft,
    pmPose: null,
    pmBubble: '',
    ceremonyFacing: null,
    crownState: null,
    crownGlowing: false,
  });

  // ── Idle ping-pong ────────────────────────────────────────────────────────
  const cycleOriginRef = useRef(Date.now());
  // Reconcile ceremony transitions: snapshot startPos on enter, resync the
  // cycle origin on exit. The enter-snapshot has to happen during render
  // (not useLayoutEffect) so downstream hooks — useSlotMachine,
  // useRoomStartCrowning — see the correct ceremonyStartPos value before
  // their own initialization effects fire on the same commit.
  const wasActiveRef = useRef(false);
  const ceremonyStartPosRef = useRef(null);

  if (pmChar && ceremonyActive && !wasActiveRef.current) {
    // Synchronous capture during render. Idempotent across strict-mode
    // double-renders because pmChar.position is stable between ticks.
    ceremonyStartPosRef.current = { x: pmChar.position.x, y: pmChar.position.y };
  } else if (pmChar && !ceremonyActive && ceremonyStartPosRef.current !== null) {
    // Clear synchronously too so consumers that read the return value on
    // the ceremony-end render don't see a stale snapshot.
    ceremonyStartPosRef.current = null;
  }

  useLayoutEffect(() => {
    if (!pmChar) return;
    if (ceremonyActive && !wasActiveRef.current) {
      // Actually commit the transition. Any queued idle walk actions are
      // cleared so the character is owned by the ceremony mirror below.
      pmChar.interrupt();
    }
    if (!ceremonyActive && wasActiveRef.current) {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
      cycleOriginRef.current = Date.now() - cycleTimeFromPosition(pmChar.position.x, pmChar.facingLeft, vw);
      ceremonyStartPosRef.current = null;
    }
    wasActiveRef.current = ceremonyActive;
  }, [ceremonyActive, pmChar]);

  // ── Idle motion loop (direct writes) ─────────────────────────────────────
  // Uses MotionRuntime directly instead of the character's action queue so
  // the idle timing is identical to the old usePmPosition (same CSS-derived
  // ping-pong curve). A future phase can swap this to walkTo actions once
  // the curve is re-expressed as distance+easing.
  useEffect(() => {
    if (!pmChar) return undefined;
    if (ceremonyActive) return undefined;
    if (motionMode === 'reduced') {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
      const { minX } = getIdleWalkBounds(vw);
      pmChar.teleport({ x: minX, y: getGroundY() });
      return undefined;
    }

    return subscribeMotion(() => {
      if (!pmChar) return;
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
      const cycleTime = Date.now() - cycleOriginRef.current;
      const { x, facingLeft } = computeIdleCenter(cycleTime, vw);
      pmChar.position = { x, y: getGroundY() };
      pmChar.facingLeft = facingLeft;
    });
  }, [pmChar, ceremonyActive, motionMode]);

  // Resize handling: during ceremony, keep the y anchored to the ground
  // (ceremony x/y is computed elsewhere; we trust it). During idle the rAF
  // loop picks up the new viewport on the next frame so no handler needed.
  useEffect(() => {
    if (!pmChar) return undefined;
    const onResize = () => {
      if (!pmChar) return;
      if (!ceremonyActive) return;
      pmChar.position = { x: pmChar.position.x, y: getGroundY() };
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pmChar, ceremonyActive]);

  // ── Ceremony mirror ──────────────────────────────────────────────────────
  // On every render that a ceremony is active, copy the computed
  // position/pose/facing/bubble/crown from the ceremony phase state into
  // the character. Runs before paint so the sprite renders at the right
  // coords on the same frame.
  //
  // Ordering note: `useSlotMachine` sets `phaseState` via setState on each
  // rAF tick → parent renders → this effect fires before paint → character
  // positioned correctly for that frame.
  useLayoutEffect(() => {
    if (!pmChar) return;

    // Idle: write thinking-loop outputs into the character.
    if (!ceremonyActive) {
      pmChar.pose = pmModel.pose === 'think' ? 'think' : 'walk';
      pmChar.walkFrame = pmModel.walkFrame;
      pmChar.bubble = pmModel.showBubble && pmModel.bubble
        ? { text: pmModel.bubble, opacity: 1 }
        : null;
      pmChar.crown = null;
      return;
    }

    const phaseState = phaseStateRef?.current ?? null;
    const roomStartState = roomStartStateRef?.current ?? null;
    const crownOwnership = crownOwnershipRef?.current ?? null;

    // Room-start mini-ceremony takes priority over slot-machine ceremony
    // (they never overlap — useRoomStartCrowning gates on `!pmRoulette` —
    // but being defensive costs nothing).
    if (roomStartState?.active && roomStartState.pmPosition) {
      pmChar.position = { x: roomStartState.pmPosition.x, y: roomStartState.pmPosition.y };
      pmChar.pose = roomStartState.pmPose || 'walk';
      pmChar.facingLeft = false;
      pmChar.bubble = null;
      pmChar.crown = crownOwnershipToChar(crownOwnership);
      pmChar.zIndex = 55;
      return;
    }

    // Slot-machine ceremony — mirror computed phase fields.
    if (phaseState?.pmCeremonyPosition) {
      pmChar.position = {
        x: phaseState.pmCeremonyPosition.x,
        y: phaseState.pmCeremonyPosition.y,
      };
      pmChar.pose = phaseState.pmCeremonyPose || 'walk';
      pmChar.facingLeft = phaseState.pmCeremonyFacing === 'left';
      pmChar.bubble = phaseState.pmCeremonyBubble
        ? {
            text: phaseState.pmCeremonyBubble.text,
            opacity: phaseState.pmCeremonyBubble.opacity ?? 1,
          }
        : null;
      pmChar.crown = crownOwnershipToChar(crownOwnership);
      // Ceremony PM renders above SlotMachineStage backdrop (z 205) and its
      // procession spotlight (z 212). Match old SlotMachineStage value.
      pmChar.zIndex = 213;
    }
  });

  return {
    pmChar,
    ceremonyStartPos: ceremonyStartPosRef.current,
  };
}

// Exported for tests
export { IDLE_CYCLE_MS, SPRITE_H };
