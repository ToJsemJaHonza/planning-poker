/**
 * The Crowning Machine -- pure helpers for the PM slot-machine ceremony.
 *
 * Zero React imports. Nothing here touches the DOM, Firebase, or timers.
 * Everything is a pure function the leader runs at payload-write time OR
 * a pure function the phase machine consumes at tick time.
 *
 * Firebase payload shape lives at `rooms/{code}/meta/pmRoulette` and is
 * written atomically in ONE set() -- never field-by-field. The clients read
 * it once, freeze candidates, and drive the phase machine from it.
 *
 * Schema version 4. The ceremony has three acts:
 *   Act 1: crownRemoval (PM walks to leader, lifts crown, walks back)
 *   Act 2: slot-machine spin (cabinet drop, decel, matched-hold, winner reveal)
 *   Act 3: crownDelivery (PM walks to winner, places crown, walks back)
 *
 * Winner appears on 2 of 3 reels (winnerReelPair). The non-matching reel
 * shows a different candidate (nonMatchReelPlayerId). Near-miss target
 * appears on reel 2 one slot before the winner for dramatic tension.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CEREMONY_TTL_MS = 30000;
export const CEREMONY_STALE_GRACE_MS = 2000;
export const SCHEMA_VERSION = 4;

// Filler slot type keys — anything in `reelFillerIds` or in a reel pool
// that matches one of these is a filler sprite (not a player ID).
export const FILLER_TYPE_KEYS = [
  'crown',
  'trophy',
  'coffee',
  'pullRequest',
  'questionMark',
  'continue',
  'pizza',
  'wizardHat',
  'notFound',
];

export function isFillerKey(entry) {
  return typeof entry === 'string' && FILLER_TYPE_KEYS.includes(entry);
}

// Farewell phrases the departing PM says during crown removal.
export const FAREWELL_PHRASES = [
  "I'm taking PTO. Godspeed.",
  "Slack is down. I never existed.",
  "OOO for synergy.",
  "I'll ping you from the afterlife.",
  "Circling back never.",
  "Bandwidth: zero.",
  "Delegating my existence.",
  "Ctrl+C, Ctrl+V my replacement.",
  "I declare sprint bankruptcy!",
  "Offboarding is a paradigm shift.",
  "Taking this one offline. Forever.",
  "404 PM not found.",
  "Parking lot — literally.",
  "Low-hanging fruit: the EXIT button.",
  "My OOO is my identity now.",
  "Quick sync with destiny.",
  "Standup canceled. All standups canceled.",
  "Pivot: to a beach.",
  "I'm not a hero, I'm a stand-up comedian.",
  "Deprecated.",
];

// Parting words the Wizard says as he walks off after crowning.
export const CROWNING_BUBBLES = [
  "Carry on, young padawan.",
  "Inbox zero: achieved.",
  "The council has spoken.",
  "Namaste, standup warriors.",
  "Gone fishin' for alignment.",
  "Your roadmap, your problem.",
  "Farewell, retro lords.",
  "Keep the coffee hot.",
];

// Rare flourish variants. Ordered to match FLOURISH_WEIGHTS.
export const FLOURISH_VARIANTS = ['cat', 'royal', 'pigeon', 'crownBounce', 'glitch'];
// Probabilities per variant. Sum = 0.05 (5% total flourish chance).
export const FLOURISH_WEIGHTS = [0.01, 0.01, 0.005, 0.02, 0.005];

// ---------------------------------------------------------------------------
// Deterministic RNG -- inlined mulberry32 (seeded PRNG)
// ---------------------------------------------------------------------------

/**
 * Tiny, fast seeded PRNG. Same seed => same sequence on every client, which
 * is how three independently-rendering clients produce identical reel
 * shuffles without writing 39 strings into the Firebase payload.
 *
 * @param {number} seed uint32
 * @returns {() => number} next() returns a number in [0, 1)
 */
export function mulberry32(seed) {
  let state = seed | 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate a 32-bit unsigned seed with Math.random. Used at payload write
// time, not at tick time.
export function randomUint32() {
  return (Math.random() * 0x100000000) >>> 0;
}

// ---------------------------------------------------------------------------
// Reel construction
// ---------------------------------------------------------------------------

/**
 * Fisher-Yates shuffle of `pool` using a seeded PRNG. NEVER mutates the
 * input array — always spreads first. Caller-supplied seed makes the
 * result deterministic across clients.
 *
 * @param {string[]} pool
 * @param {number} seed
 * @returns {string[]} a new shuffled array
 */
export function buildReelOrder(pool, seed) {
  const rng = mulberry32(seed);
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Move a specific entry to a specific index, shifting any existing entry at
 * that index back to wherever `entry` used to live. Pure — returns a new
 * array. Used to place the winner (and near-miss target) at known indices
 * in the rightmost reel without redoing the shuffle.
 *
 * @param {string[]} arr
 * @param {string} entryId
 * @param {number} targetIndex
 * @returns {string[]} a new array with entryId placed at targetIndex
 */
export function placeEntryAt(arr, entryId, targetIndex) {
  if (!arr.includes(entryId)) return [...arr];
  const clamped = Math.max(0, Math.min(arr.length - 1, targetIndex));
  const src = arr.indexOf(entryId);
  if (src === clamped) return [...arr];
  const next = [...arr];
  const [e] = next.splice(src, 1);
  next.splice(clamped, 0, e);
  return next;
}

// ---------------------------------------------------------------------------
// Phase tables v2 (standard, compressed, reduced-motion)
// ---------------------------------------------------------------------------

/**
 * Phase table -- 3-act ceremony:
 *   Act 1: crownRemoval (PM walks to leader, takes crown, walks back, leader exits)
 *   Act 2: cabinetDrop through cabinetOut (slot machine)
 *   Act 3: crownDelivery (PM walks to winner, places crown, walks back)
 *
 * Total ceremony: 21.3s.
 */
export const PHASE_TABLE_STANDARD = [
  // Act 1 — Crown Removal (2x slower)
  { phase: 'crownRemoval',   startAt:     0, duration: 5000 },
  // Act 2 — Slot Machine (2x longer spin)
  { phase: 'cabinetDrop',    startAt:  5000, duration:  400 },
  { phase: 'spinning',       startAt:  5400, duration: 2000 },
  { phase: 'decelerating',   startAt:  7400, duration: 2500 },
  // reel 0 stops at 9400, reel 1 stops at 9900, then matchedHold begins at 9900
  { phase: 'matchedHold',    startAt:  9900, duration: 1200 },
  // Winner-pair reels locked with pulse. Reel 2 still at full speed.
  { phase: 'reel3Decel',     startAt: 11100, duration: 3100 },
  // reel 2 slowdown: 6 clicks + 200ms near-miss hold + 440ms nudge
  { phase: 'winnerFreeze',   startAt: 14200, duration:  400 },
  { phase: 'winnerEmphasis', startAt: 14600, duration: 1200 },
  { phase: 'cabinetOut',     startAt: 15800, duration:  500 },
  // Act 3 — Crown Delivery (2x slower)
  { phase: 'crownDelivery',  startAt: 16300, duration: 5000 },
  { phase: 'done',           startAt: 21300, duration:    0 },
];

// Compressed table -- single candidate, no reel spin. Direct crown transfer.
export const PHASE_TABLE_COMPRESSED = [
  { phase: 'crownRemoval',    startAt:     0, duration: 5000 },
  { phase: 'crownDelivery',   startAt:  5000, duration: 5000 },
  { phase: 'done',            startAt: 10000, duration:    0 },
];

// Reduced-motion table -- all walks replaced by instant position swaps.
export const PHASE_TABLE_REDUCED = [
  { phase: 'crownRemoval',    startAt:    0, duration:  400 },
  { phase: 'cabinetDrop',     startAt:  400, duration:  200 },
  { phase: 'winnerFreeze',    startAt:  600, duration:  200 },
  { phase: 'winnerEmphasis',  startAt:  800, duration:  100 },
  { phase: 'cabinetOut',      startAt:  900, duration:  200 },
  { phase: 'crownDelivery',   startAt: 1100, duration:  400 },
  { phase: 'done',            startAt: 1500, duration:    0 },
];

/** Pick the right phase table for a given ceremony/client. */
export function phaseTableFor({ wasCompressed, reducedMotion }) {
  if (reducedMotion) return PHASE_TABLE_REDUCED;
  if (wasCompressed) return PHASE_TABLE_COMPRESSED;
  return PHASE_TABLE_STANDARD;
}

/** Total runtime of a phase table in ms (position of `done`). */
export function totalDurationFor(table) {
  const done = table.find((row) => row.phase === 'done');
  return done ? done.startAt : 0;
}

/**
 * Look up the current phase by linear scan of the table. Returns the
 * matching row (with startAt/duration/phase) or the `done` row if elapsed
 * is past the end. Never returns undefined.
 */
export function currentPhaseRow(table, elapsed) {
  if (elapsed < 0) return table[0];
  for (let i = 0; i < table.length - 1; i++) {
    const row = table[i];
    const next = table[i + 1];
    if (elapsed >= row.startAt && elapsed < next.startAt) return row;
  }
  return table[table.length - 1]; // done
}

// ---------------------------------------------------------------------------
// Reel deceleration curve
// ---------------------------------------------------------------------------

/**
 * Reel 2 (rightmost) slowdown intervals in ms between clicks. Each entry is
 * ~1.2x the previous (ease-out). 6 slots total; the 6th slot is the
 * near-miss target, then a ~200ms hold, then a smoother nudge to the winner.
 */
export const REEL2_SLOWDOWN_INTERVALS = [220, 264, 316, 380, 456, 548];

// v4+: all absolute reel timing constants updated for 2x longer ceremony.
// Reel 0 decel window inside `decelerating` phase.
export const REEL0_STOP_AT = 9400;
// Reel 1 decel window inside `decelerating` phase.
export const REEL1_STOP_AT = 9900;

// v4+: reel 2 slowdown start moves to AFTER matchedHold (11100ms).
// The matchedHold phase (1200ms) is inserted between reel 1 stop (9900ms)
// and reel 2 deceleration start.
export const REEL2_SLOWDOWN_START = 11100;

// ---------------------------------------------------------------------------
// Flourish picking
// ---------------------------------------------------------------------------

/**
 * Roll once for a flourish variant. Returns one of FLOURISH_VARIANTS or null
 * based on the weighted table. Called at payload-write time only.
 *
 * @param {() => number} [rand] injected for tests
 */
export function rollFlourish(rand = Math.random) {
  const roll = rand();
  let cursor = 0;
  for (let i = 0; i < FLOURISH_VARIANTS.length; i++) {
    cursor += FLOURISH_WEIGHTS[i];
    if (roll < cursor) return FLOURISH_VARIANTS[i];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Candidate selection helpers
// ---------------------------------------------------------------------------

/** Sorted list of non-PM players keyed by joinedAt ASC. Stable for ties. */
export function nonPmCandidatesSorted(players) {
  return Object.entries(players)
    .filter(([, p]) => p && p.role !== 'pm')
    .sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
}

// ---------------------------------------------------------------------------
// Payload construction
// ---------------------------------------------------------------------------

/**
 * Build the full ceremony payload, ready to `set()` into Firebase in one
 * call. Returns `null` when there's nothing to crown (zero candidates). The
 * leader runs this once per disconnect.
 *
 * @param {object} opts
 * @param {Record<string, any>} opts.players        live player map from Firebase
 * @param {number} [opts.now]                       Date.now() override for tests
 * @param {() => number} [opts.rand]                RNG override for tests
 * @param {{ id: string, data: any } | null} [opts.outgoingLeader]
 * @returns {object | null} payload, or null when no crowning is possible
 */
export function buildCeremonyPayload({
  players,
  now = Date.now(),
  rand = Math.random,
  outgoingLeader = null,
} = {}) {
  const sorted = nonPmCandidatesSorted(players);

  // Outgoing leader fields (v2, carried forward)
  const outgoingLeaderId = outgoingLeader?.id || null;
  const outgoingLeaderLastData = outgoingLeader?.data
    ? { name: outgoingLeader.data.name, role: outgoingLeader.data.role }
    : null;
  const outgoingLeaderHadCrown = !!(
    outgoingLeader?.data?.role === 'player'
    && outgoingLeader?.data?.isLeader === true
  );

  // v3 BUG FIX: exclude outgoing leader from candidate pool BEFORE winner pick.
  // The outgoing leader may still be in `players` when this runs because
  // Firebase onDisconnect removal is not instantaneous.

  // Track outgoing leader's index in the sorted list BEFORE filtering.
  // This lets clients compute the leader's grid position with pure math.
  const allSortedIds = sorted.map(([id]) => id);
  const outgoingLeaderIndex = outgoingLeaderId != null
    ? allSortedIds.indexOf(outgoingLeaderId)
    : -1;

  const candidateIds = allSortedIds.filter(id => id !== outgoingLeaderId);
  if (candidateIds.length === 0) return null;

  const candidateNames = {};
  for (const [id, data] of sorted) {
    if (id !== outgoingLeaderId) {
      candidateNames[id] = data?.name || id;
    }
  }

  const ceremonyId = `cm-${now}-${((rand() * 0xffff) | 0).toString(16)}`;

  // Compressed case: single candidate, no spin, no near-miss.
  if (candidateIds.length === 1) {
    return {
      ceremonyId,
      schemaVersion: SCHEMA_VERSION,
      startedAt: now,
      expiresAt: now + CEREMONY_TTL_MS,
      wasCompressed: true,
      candidateIds,
      candidateNames,
      winnerId: candidateIds[0],
      nearMissTargetId: null,
      winnerReelPair: null,
      nonMatchReelPlayerId: null,
      isTripleJackpot: false,
      reelFillerIds: [],
      reelSeeds: [0, 0, 0],
      farewellPhraseIndex: Math.floor(rand() * FAREWELL_PHRASES.length),
      crowningBubbleIndex: Math.floor(rand() * CROWNING_BUBBLES.length),
      flourishVariant: rollFlourish(rand),
      outgoingLeaderId,
      outgoingLeaderLastData,
      outgoingLeaderHadCrown,
      outgoingLeaderIndex,
      winnerIndex: 0,
    };
  }

  // Standard case: pick winner uniformly at random from candidates.
  const winnerIdx = Math.floor(rand() * candidateIds.length);
  const winnerId = candidateIds[winnerIdx];
  const winnerIndex = winnerIdx;

  // Winner reel pair -- which 2 of 3 reels show the winner.
  const VALID_PAIRS = [[0, 1], [0, 2], [1, 2]];
  const winnerReelPair = VALID_PAIRS[Math.floor(rand() * 3)];
  const isTripleJackpot = winnerReelPair[0] === 0 && winnerReelPair[1] === 1;

  // Non-match reel player -- random non-winner candidate for the 3rd reel.
  const nonMatchPool = candidateIds.filter(id => id !== winnerId);
  const nonMatchReelPlayerId = nonMatchPool.length > 0
    ? nonMatchPool[Math.floor(rand() * nonMatchPool.length)]
    : null;

  // Near-miss target -- appears on reel 2 before nudge to winner.
  // Prefer someone who is neither the winner nor the nonMatch player (variety).
  const nearMissPool = candidateIds.filter(
    id => id !== winnerId && id !== nonMatchReelPlayerId
  );
  let nearMissTargetId;
  if (nearMissPool.length > 0) {
    nearMissTargetId = nearMissPool[Math.floor(rand() * nearMissPool.length)];
  } else if (nonMatchPool.length > 0) {
    // 2 candidates: near-miss = the non-winner (same as nonMatchReelPlayerId)
    nearMissTargetId = nonMatchReelPlayerId;
  } else {
    nearMissTargetId = null; // single candidate, compressed (should not reach here)
  }

  // Pick 4 filler type keys uniformly from the 9-variant pool, without
  // replacement, using a local Fisher-Yates.
  const fillerPool = [...FILLER_TYPE_KEYS];
  const reelFillerIds = [];
  const fillerCount = Math.min(4, fillerPool.length);
  for (let i = 0; i < fillerCount; i++) {
    const pickIdx = Math.floor(rand() * fillerPool.length);
    reelFillerIds.push(fillerPool.splice(pickIdx, 1)[0]);
  }

  return {
    ceremonyId,
    schemaVersion: SCHEMA_VERSION,
    startedAt: now,
    expiresAt: now + CEREMONY_TTL_MS,
    wasCompressed: false,
    candidateIds,
    candidateNames,
    winnerId,
    nearMissTargetId,
    winnerReelPair,
    nonMatchReelPlayerId,
    isTripleJackpot,
    reelFillerIds,
    reelSeeds: [randomUint32FromRand(rand), randomUint32FromRand(rand), randomUint32FromRand(rand)],
    farewellPhraseIndex: Math.floor(rand() * FAREWELL_PHRASES.length),
    crowningBubbleIndex: Math.floor(rand() * CROWNING_BUBBLES.length),
    flourishVariant: rollFlourish(rand),
    outgoingLeaderId,
    outgoingLeaderLastData,
    outgoingLeaderHadCrown,
    outgoingLeaderIndex,
    winnerIndex,
  };
}

// Internal: sample a uint32 from an injected rand function. Tests use this
// to get deterministic seeds without importing randomUint32.
function randomUint32FromRand(rand) {
  return (rand() * 0x100000000) >>> 0;
}

/**
 * Guard for payload validation — reject anything missing the essentials or
 * wrong schema version. Used by clients on read. Old payloads with
 * mismatched schema versions are treated as absent.
 */
export function isValidCeremonyPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.schemaVersion !== SCHEMA_VERSION) return false;
  if (!Array.isArray(payload.candidateIds)) return false;
  if (payload.candidateIds.length === 0) return false;
  if (!payload.ceremonyId || typeof payload.ceremonyId !== 'string') return false;
  if (typeof payload.startedAt !== 'number') return false;
  if (typeof payload.expiresAt !== 'number') return false;
  if (typeof payload.winnerId !== 'string') return false;
  if (!payload.candidateIds.includes(payload.winnerId)) return false;

  // v3 winnerReelPair validation (non-compressed only)
  if (!payload.wasCompressed) {
    const pair = payload.winnerReelPair;
    if (!Array.isArray(pair) || pair.length !== 2) return false;
    const validPairs = [[0, 1], [0, 2], [1, 2]];
    const pairMatch = validPairs.some(vp => vp[0] === pair[0] && vp[1] === pair[1]);
    if (!pairMatch) return false;

    if (typeof payload.nonMatchReelPlayerId !== 'string') return false;
    if (!payload.candidateIds.includes(payload.nonMatchReelPlayerId)) return false;
    if (payload.nonMatchReelPlayerId === payload.winnerId) return false;

    // nearMissTargetId: must not be winner, must be in candidates (when non-null)
    if (payload.nearMissTargetId != null) {
      if (payload.nearMissTargetId === payload.winnerId) return false;
      if (!payload.candidateIds.includes(payload.nearMissTargetId)) return false;
    }

    if (typeof payload.isTripleJackpot !== 'boolean') return false;
    // isTripleJackpot must be consistent with the pair
    if (payload.isTripleJackpot !== (pair[0] === 0 && pair[1] === 1)) return false;

    // BUG FIX: outgoing leader must NOT be in candidate pool
    if (payload.outgoingLeaderId && payload.candidateIds.includes(payload.outgoingLeaderId)) {
      return false;
    }
  }

  // v2 outgoing leader fields: both present or both null
  if (!!payload.outgoingLeaderId !== !!payload.outgoingLeaderLastData) return false;
  if (typeof payload.outgoingLeaderHadCrown !== 'boolean') return false;

  // Index fields for math-based grid position
  if (typeof payload.outgoingLeaderIndex !== 'number') return false;
  if (typeof payload.winnerIndex !== 'number') return false;

  return true;
}

/** True when the payload's TTL + grace has passed. */
export function isStalePayload(payload, now = Date.now()) {
  if (!payload || typeof payload.expiresAt !== 'number') return true;
  return now > payload.expiresAt + CEREMONY_STALE_GRACE_MS;
}
