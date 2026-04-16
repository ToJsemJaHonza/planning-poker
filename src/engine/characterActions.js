/**
 * Action advance logic — the per-frame step for every supported action type.
 *
 * Pure. No React, no DOM, no Date.now() defaults. Caller owns `now`.
 *
 * Each action is a plain object with `{ type, ...params }`. When `startAction`
 * (in character.js) begins an action, it attaches `from` (live position
 * snapshot) and `startedAt` (the `now` at start). `advanceAction` reads those
 * plus the current `now` and mutates the character accordingly, returning
 * `true` when the action has completed.
 *
 * Mutation is deliberate. Characters are mutable live models the renderer
 * reads each frame. Immutable updates would force a cascade of snapshots
 * for every tick of every character — wasteful and harder to reason about.
 */

import { lerpPosition, easeInOutCubic } from './animation';

export const ACTION_TYPES = Object.freeze({
  WALK_TO: 'walkTo',
  WAIT: 'wait',
  SET_POSE: 'setPose',
  SET_FACING: 'setFacing',
  SET_BUBBLE: 'setBubble',
  SET_HIDDEN: 'setHidden',
  SET_ZINDEX: 'setZIndex',
  SET_NAME: 'setName',
  GIVE_CROWN: 'giveCrown',
  TAKE_CROWN: 'takeCrown',
  ARC_CROWN_TO: 'arcCrownTo',
  TELEPORT: 'teleport',
  CALLBACK: 'callback',
});

/**
 * Advance a single action by one tick. Mutates `char` in place.
 *
 * @param {object} char - live character model
 * @param {object} action - the current `char.action` (already has `from`/`startedAt`)
 * @param {number} now - current timestamp (same clock as `startedAt`)
 * @returns {boolean} true when the action has finished
 */
export function advanceAction(char, action, now) {
  const elapsed = Math.max(0, now - action.startedAt);
  switch (action.type) {
    case ACTION_TYPES.WALK_TO: {
      const duration = Math.max(0, action.duration ?? 0);
      const progress = duration > 0 ? Math.min(1, elapsed / duration) : 1;
      const ease = action.easing ?? easeInOutCubic;
      const target = { x: action.x, y: action.y };
      char.position = lerpPosition(progress, action.from, target, ease);
      if (progress >= 1) {
        // Snap exactly to the declared target — no floating-point drift.
        char.position = { x: target.x, y: target.y };
        return true;
      }
      return false;
    }
    case ACTION_TYPES.WAIT:
      return elapsed >= Math.max(0, action.ms ?? 0);
    case ACTION_TYPES.SET_POSE:
      char.pose = action.pose;
      return true;
    case ACTION_TYPES.SET_FACING:
      char.facingLeft = !!action.facingLeft;
      return true;
    case ACTION_TYPES.SET_BUBBLE:
      char.bubble =
        action.text == null
          ? null
          : { text: String(action.text), opacity: action.opacity ?? 1 };
      return true;
    case ACTION_TYPES.SET_HIDDEN:
      char.hidden = !!action.hidden;
      return true;
    case ACTION_TYPES.SET_ZINDEX:
      char.zIndex = Number(action.zIndex) || 0;
      return true;
    case ACTION_TYPES.SET_NAME:
      char.name = action.name ?? null;
      return true;
    case ACTION_TYPES.GIVE_CROWN:
      char.crown = action.state ?? { mode: 'settled', glowing: false };
      return true;
    case ACTION_TYPES.TAKE_CROWN:
      char.crown = null;
      return true;
    case ACTION_TYPES.ARC_CROWN_TO: {
      const duration = Math.max(0, action.duration ?? 500);
      const progress = duration > 0 ? Math.min(1, elapsed / duration) : 1;
      char.crown = { mode: 'arcing', progress, glowing: !!action.glowing };
      if (progress >= 1) {
        char.crown = { mode: 'settled', glowing: !!action.glowing };
        return true;
      }
      return false;
    }
    case ACTION_TYPES.TELEPORT:
      char.position = { x: action.x, y: action.y };
      return true;
    case ACTION_TYPES.CALLBACK:
      try {
        action.fn?.(char);
      } catch (err) {
        console.error('[character] callback action threw', err);
      }
      return true;
    default:
      // Unknown action types complete immediately so a stale queue entry
      // can't wedge the character forever.
      console.error('[character] unknown action type:', action.type);
      return true;
  }
}
