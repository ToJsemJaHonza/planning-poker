// @refresh reset
// ============================================================================
// Entrance event registry
// ----------------------------------------------------------------------------
// This is the ONE place where all cinematic entrance events live.
//
// To add a new entrance (e.g. "Karel on a skateboard"):
//
//   1. Write its animation component under `src/components/`. It receives
//      the full Firebase payload as props + whatever `initialProps` it
//      needs. It manages its own timers and unmounts itself cleanly.
//
//   2. Add an entry below with:
//        - `type`                    — Firebase syncedEvent.type string
//        - `match(name)`             — returns true for names that trigger this entrance
//        - `buildPayload(id, name)`  — Firebase payload (leader rolls randomness).
//                                       Stores BOTH the stable session id (for
//                                       targeting the grid placeholder) AND the
//                                       display name (for rendering the bubble).
//        - `duration`                — how long Firebase should hold the flag (ms)
//        - `Component`               — the React component to render while active
//        - `getHiddenPlayer(payload)` — returns the player ID to hide from the grid
//                                        while this event plays
//
//   3. That's it. The engine (`useEntranceEvents`) handles trigger detection,
//      the mutual exclusion mutex, hiding the target player, and passing the
//      payload into the component.
//
// Entrance events are mutually exclusive: only one can play at a time. The
// engine enforces this so Richard's train and Tomáš's DBB pipeline never
// collide on the same screen.
// ============================================================================

import Train from '../components/Train';
import DbbPipeline from '../components/DbbPipeline';
import { isRichardName, isTomasName } from '../components/playerList.utils';

// Probability an eligible player triggers a cinematic entrance.
// Keep at 0.1 — "magic moments" should be rare.
export const ENTRANCE_CHANCE = 0.1;

export const ENTRANCE_EVENTS = [
  {
    type: 'train',
    match: isRichardName,
    buildPayload: (id, name) => ({
      type: 'train',
      playerId: id,
      playerName: name,
      fromRight: Math.random() > 0.5,
    }),
    duration: 12000,
    Component: Train,
    getHiddenPlayer: (payload) => payload.playerId,
  },
  {
    type: 'dbbPipeline',
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
    duration: 10000,
    Component: DbbPipeline,
    getHiddenPlayer: (payload) => payload.playerId,
  },
];

/** Find the registry entry for a given event type (or null). */
export function findEntranceByType(type) {
  return ENTRANCE_EVENTS.find((e) => e.type === type) || null;
}

/** Find the registry entry matching a player name (first match wins). */
export function findEntranceForName(name) {
  return ENTRANCE_EVENTS.find((e) => e.match(name)) || null;
}
