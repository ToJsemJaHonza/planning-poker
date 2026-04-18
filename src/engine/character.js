/**
 * Character — a long-lived, mutable animation model with an action queue.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * Historically the PM, the grid players, the entering cinematic figures,
 * and the outgoing leader each lived in a different piece of code that
 * mounted/unmounted its own DOM element at a different coordinate. Every
 * "handoff" between subsystems was a fresh mount starting from whatever
 * coordinate that subsystem thought was right — and when two subsystems
 * disagreed (idle PM at vh-105 vs ceremony PM at vh-140) the character
 * teleported at the seam.
 *
 * A Character replaces that with one persistent object per figure. The
 * object's `position` is its live truth. Any call to `walkTo` (or any
 * other action) starts with `from: { ...char.position }` so it ALWAYS
 * continues from wherever the character actually is right now — no matter
 * what was happening a frame ago.
 *
 * ── The one invariant ──────────────────────────────────────────────────────
 *   startAction(char, action) ⇒ action.from === char.position at that moment
 *
 * Delete that line, break every ceremony.
 *
 * ── Shape ──────────────────────────────────────────────────────────────────
 *   {
 *     id:          string
 *     sprite:      'pm' | 'player'
 *     position:    { x, y }                ← live, mutated each tick
 *     facingLeft:  boolean
 *     pose:        'walk1'|'walk2'|'cast'|'think'|...
 *     walkFrame:   0 | 1                   ← toggles every WALK_FRAME_MS
 *     name:        string | null           ← drives player-sprite hash
 *     zIndex:      number
 *     hidden:      boolean
 *     bubble:      null | { text, opacity }
 *     action:      null | Action           ← current in-flight action
 *     queue:       Action[]                ← pending actions (FIFO)
 *   }
 *
 * The crown is NOT a character property. It's rendered by <CrownStage>
 * from the canonical `crownOwnership` object. Any attempt to add a
 * `char.crown` field back creates exactly the coordination bug this
 * refactor killed — a crown painted in two places that can disagree
 * across a frame.
 *
 * Methods attached for ergonomic director code: walkTo, wait, setPose,
 * setFacing, setBubble, setHidden, setZIndex, teleport, sequence,
 * interrupt, clearQueue. Each returns the character so they can be chained.
 */

import { advanceAction, ACTION_TYPES } from './characterActions';
import { WALK_FRAME_MS } from './animation';

export { ACTION_TYPES };

const VALID_SPRITES = new Set(['pm', 'player']);

/**
 * Create a fresh character. Plain-object return; attach methods for ergonomic
 * director code but the underlying state is public and tick-mutable.
 */
export function createCharacter({
  id,
  sprite,
  position = { x: 0, y: 0 },
  facingLeft = false,
  pose = 'walk1',
  name = null,
  zIndex = 50,
  hidden = false,
  bubble = null,
  fukEyes = false,
  stressStage = 0,
  className = '',
} = {}) {
  if (!id) throw new Error('createCharacter: id is required');
  if (!VALID_SPRITES.has(sprite)) {
    throw new Error(`createCharacter: sprite must be one of ${[...VALID_SPRITES].join(', ')}`);
  }

  const char = {
    id,
    sprite,
    position: { x: position.x, y: position.y },
    facingLeft,
    pose,
    walkFrame: 0,
    name,
    zIndex,
    hidden,
    bubble,
    fukEyes,
    stressStage,
    className,
    action: null,
    queue: [],
  };

  // Ergonomic methods — directors call `char.walkTo(...)` instead of
  // importing a free function for every verb. They delegate to the
  // module-level functions below, which remain the tested surface.
  char.walkTo = (opts) => enqueue(char, { type: ACTION_TYPES.WALK_TO, ...opts });
  char.wait = (ms) => enqueue(char, { type: ACTION_TYPES.WAIT, ms });
  char.setPose = (pose) => enqueue(char, { type: ACTION_TYPES.SET_POSE, pose });
  char.setFacing = (facingLeft) => enqueue(char, { type: ACTION_TYPES.SET_FACING, facingLeft });
  char.setBubble = (text, opacity) => enqueue(char, { type: ACTION_TYPES.SET_BUBBLE, text, opacity });
  char.setHidden = (hidden) => enqueue(char, { type: ACTION_TYPES.SET_HIDDEN, hidden });
  char.setZIndex = (zIndex) => enqueue(char, { type: ACTION_TYPES.SET_ZINDEX, zIndex });
  char.setName = (name) => enqueue(char, { type: ACTION_TYPES.SET_NAME, name });
  char.callback = (fn) => enqueue(char, { type: ACTION_TYPES.CALLBACK, fn });
  char.sequence = (actions) => {
    for (const a of actions) enqueue(char, a);
    return char;
  };
  char.teleport = ({ x, y }) => teleport(char, { x, y });
  char.interrupt = () => interrupt(char);
  char.clearQueue = () => clearQueue(char);

  return char;
}

/**
 * Start an action against the given character. This is the one place where
 * `from` is bound — and it is always bound to the character's live
 * position, which is the invariant that kills every handoff jump.
 */
export function startAction(char, action, now) {
  const started = {
    ...action,
    from: { x: char.position.x, y: char.position.y },
    startedAt: now,
  };
  // Auto-flip facing on walkTo so a director doesn't have to spell it out
  // for every target. `autoFlip: false` opts out (e.g. PM must keep facing
  // the crown while walking backward in Act 3).
  if (action.type === ACTION_TYPES.WALK_TO && action.autoFlip !== false) {
    const dx = (action.x ?? char.position.x) - char.position.x;
    if (dx !== 0) char.facingLeft = dx < 0;
  }
  char.action = started;
  try {
    started.onStart?.(char);
  } catch (err) {
    console.error('[character] onStart threw', err);
  }
  return started;
}

export function enqueue(char, action) {
  char.queue.push(action);
  return char;
}

export function clearQueue(char) {
  char.queue.length = 0;
  return char;
}

/**
 * Abort the current action in place; position, pose, crown etc. stay
 * exactly where they are this instant. Used when a higher-priority
 * sequence takes over (idle → ceremony, player leaving mid-walk).
 */
export function interrupt(char) {
  char.action = null;
  char.queue.length = 0;
  return char;
}

/**
 * Explicit, visible teleport. Clears any in-flight work so the character
 * can't jump then continue a stale animation. Reserved for reduced-motion
 * paths and for initial positioning of a just-mounted character.
 */
export function teleport(char, { x, y }) {
  char.action = null;
  char.queue.length = 0;
  char.position = { x, y };
  return char;
}

/**
 * Advance a single character by one tick. Mutates the character.
 *
 * @param {object} char
 * @param {number} now - timestamp from the shared clock
 */
export function tickCharacter(char, now) {
  // Drain in a single loop: if the current action completes, immediately
  // pull the next from the queue so a sequence of `[setPose, setBubble,
  // walkTo]` all apply on the tick they were queued. Instant actions
  // (zero-duration) complete in the same iteration they started in.
  let guard = 0;
  while (true) {
    if (char.action === null) {
      if (char.queue.length === 0) break;
      const next = char.queue.shift();
      startAction(char, next, now);
    }
    const action = char.action;
    const done = advanceAction(char, action, now);
    if (!done) break;
    const onDone = action.onDone;
    char.action = null;
    try {
      onDone?.(char);
    } catch (err) {
      console.error('[character] onDone threw', err);
    }
    if (++guard > 64) {
      console.error('[character] tick drain guard tripped for', char.id);
      break;
    }
  }

  // Walk-frame stepping — deterministic from action.startedAt. No hidden
  // counter state; resets implicitly when a new walkTo begins and clears
  // when the character stops.
  if (char.action?.type === ACTION_TYPES.WALK_TO) {
    const since = Math.max(0, now - char.action.startedAt);
    char.walkFrame = Math.floor(since / WALK_FRAME_MS) % 2;
  }
}

/**
 * Advance every character in a Map. Called once per rAF frame by the stage.
 */
export function tickAll(characters, now) {
  for (const char of characters.values()) {
    tickCharacter(char, now);
  }
}
