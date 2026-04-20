// @refresh reset
// ============================================================================
// Cinematic event registry
// ----------------------------------------------------------------------------
// This is the ONE place where every full-screen cinematic in the app is
// declared. Mounting and routing live in `<EntranceStage>`; this file is
// pure data + registry helpers.
//
// Two categories live here, split by how they're triggered:
//
//   1. "name-cinematic"  — fired by `useEntranceEvents` when a matching
//                          player joins. Hijacks that player's grid slot
//                          via `getHiddenPlayer`. Mutually exclusive with
//                          every other name-cinematic. Examples:
//                          train (Richard), dbbPipeline (Tomáš).
//
//   2. "overlay"         — fired by an explicit Room action (reveal,
//                          OKTA combo, split toggle). Free-floating; does
//                          NOT touch the player grid. May coexist with a
//                          name-cinematic and with each other.
//
// To add a new cinematic:
//   - Drop the component under `src/components/`.
//   - Append an entry below with `type`, `category`, `Component`,
//     `duration`, and the trigger fields appropriate to its category.
// ============================================================================

import Train from '../components/Train';
import DbbPipeline from '../components/DbbPipeline';
import Chicken from '../components/Chicken';
import Sheep from '../components/Sheep';
import SpecialRoundOverlay from '../components/room/SpecialRoundOverlay';
import { isRichardName, isTomasName } from '../components/playerList.utils';

// Probability an eligible player triggers a cinematic entrance.
export const ENTRANCE_CHANCE = 0.25;

/**
 * Categories used by the registry. Centralised so the engine and the stage
 * stay in sync about which trigger path applies.
 */
export const CINEMATIC_CATEGORY = Object.freeze({
  NAME: 'name-cinematic',
  OVERLAY: 'overlay',
});

/**
 * Sources tell the stage where to read the "is this active right now?"
 * signal from. Every `overlay` cinematic must have a source.
 *   - 'syncedEvent'    : active when `syncedEvent.type === entry.type`
 *
 * The OKTA_EVENT and SPECIAL_ROUND sources existed earlier when those two
 * cinematics had dedicated `meta/oktaEvent` and `meta/specialRound`
 * Firebase booleans. Both have since been migrated to the unified
 * `meta/syncedEvent` channel — every overlay now reads from the same path.
 */
export const CINEMATIC_SOURCE = Object.freeze({
  SYNCED_EVENT: 'syncedEvent',
});

export const ENTRANCE_EVENTS = [
  // ------- Name-triggered cinematics ----------------------------------
  {
    type: 'train',
    category: CINEMATIC_CATEGORY.NAME,
    match: isRichardName,
    buildPayload: (id, name) => ({
      type: 'train',
      playerId: id,
      playerName: name,
      fromRight: Math.random() > 0.5,
    }),
    duration: 14000,
    Component: Train,
    getHiddenPlayer: (payload) => payload.playerId,
  },
  {
    type: 'dbbPipeline',
    category: CINEMATIC_CATEGORY.NAME,
    match: isTomasName,
    buildPayload: (id, name) => {
      const sides = ['top', 'bottom', 'left', 'right'];
      return {
        type: 'dbbPipeline',
        playerId: id,
        playerName: name,
        fromSide: sides[Math.floor(Math.random() * sides.length)],
      };
    },
    duration: 11000,
    Component: DbbPipeline,
    getHiddenPlayer: (payload) => payload.playerId,
  },

  // ------- Free-floating overlays -------------------------------------
  {
    // Fires after reveal — already routed through Firebase syncedEvent
    // (see Room.handleReveal -> fireSyncedEvent({ type: 'chicken' })).
    type: 'chicken',
    category: CINEMATIC_CATEGORY.OVERLAY,
    source: CINEMATIC_SOURCE.SYNCED_EVENT,
    duration: 3500,
    Component: Chicken,
  },
  {
    // OKTA easter egg — Honza presses O+K+T+A. Triggered through the
    // unified syncedEvent channel (see useRoom.triggerOkta).
    type: 'okta',
    category: CINEMATIC_CATEGORY.OVERLAY,
    source: CINEMATIC_SOURCE.SYNCED_EVENT,
    duration: 4500,
    Component: Sheep,
  },
  {
    // Split-mode entry animation. Fired by the leader when toggling
    // split mode on; the splitMode boolean still controls voting, this
    // entry controls only the splash overlay.
    type: 'specialRound',
    category: CINEMATIC_CATEGORY.OVERLAY,
    source: CINEMATIC_SOURCE.SYNCED_EVENT,
    duration: 2500,
    Component: SpecialRoundOverlay,
  },
];

/** Find the registry entry for a given event type (or null). */
export function findEntranceByType(type) {
  return ENTRANCE_EVENTS.find((e) => e.type === type) || null;
}

/** Find the registry entry matching a player name (first match wins). */
export function findEntranceForName(name) {
  return ENTRANCE_EVENTS.find(
    (e) => e.category === CINEMATIC_CATEGORY.NAME && e.match?.(name),
  ) || null;
}

/**
 * Compute the list of overlay cinematics that should currently be on
 * screen, given the room's trigger sources. Pure function so the stage
 * can derive its render tree without owning any state.
 *
 * Multiple overlays can be active simultaneously (e.g. a chicken running
 * across the screen during a SPECIAL ROUND splash). The order returned
 * matches registry declaration order — render in that order so z-index
 * stays predictable.
 */
export function activeOverlays({ syncedEvent }) {
  const out = [];
  for (const e of ENTRANCE_EVENTS) {
    if (e.category !== CINEMATIC_CATEGORY.OVERLAY) continue;
    let payload = null;
    if (e.source === CINEMATIC_SOURCE.SYNCED_EVENT) {
      if (syncedEvent && syncedEvent.type === e.type) payload = syncedEvent;
    }
    if (payload) out.push({ event: e, payload });
  }
  return out;
}
