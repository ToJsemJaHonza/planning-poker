# Planning Poker — Architecture & Limitations

This document captures **how the app actually works**, **what broke and why**, and **the current limitations** so the next engineer (human or AI) can make good decisions fast.

---

## 1. Stack overview

| Layer             | Tech                                                    |
|-------------------|---------------------------------------------------------|
| UI framework      | React 19 (functional components only)                   |
| Build/dev server  | Vite 8 + @vitejs/plugin-react (Fast Refresh HMR)        |
| Styling           | Inline style objects + `src/index.css` for keyframes + `src/styles/*.css` |
| State (real-time) | Firebase Realtime Database (free tier, no Auth)         |
| Graphics          | Pure CSS `box-shadow` pixel sprites, 5 px per "pixel"   |
| Tests             | Vitest + jsdom + @testing-library/react                 |
| Deployment        | GitHub Pages via GitHub Actions                         |

No Redux, no query layer, no UI framework, no CSS preprocessor. The entire runtime is ~400 kB unminified JS — we want to keep it that way.

---

## 2. Event system (entrance animations)

Cinematic entrance animations (Richard's train, Tomáš's DBB pipeline, and anything else we add next) live in a dedicated **registry + engine** under `src/events/`.

```
src/events/
├── entranceEvents.js      ← registry: array of event configs
├── useEntranceEvents.js   ← engine hook: trigger detection, mutex, state derivation
└── EntranceStage.jsx      ← renderer: mounts whatever event is active
```

### Adding a new entrance (e.g. "Karel on a skateboard")

1. **Write the animation component** in `src/components/`. It receives the Firebase payload as props. It manages its own timers and doesn't need callbacks (`onDone`, `onPlayerExit` are no longer required — the engine derives everything from `syncedEvent`).

2. **Add a registry entry** to `entranceEvents.js`:
   ```js
   {
     type: 'skateboard',
     match: (name) => isKarelName(name),
     buildPayload: (name) => ({ type: 'skateboard', playerName: name, fromLeft: Math.random() > 0.5 }),
     duration: 8000,
     Component: Skateboard,
     getHiddenPlayer: (payload) => payload.playerName,
   }
   ```

3. **That's it.** No changes to `PlayerList`, `Room`, `useRoom`, or any test. The engine will:
   - Detect newly joined Karels on the leader's client
   - Roll `ENTRANCE_CHANCE`
   - Fire a Firebase `syncedEvent` (respecting the mutex — no stomping on an in-flight train)
   - Auto-hide Karel from the player grid while the skateboard is mid-animation
   - Mount `<Skateboard ...>` via `EntranceStage`

### Guarantees the engine enforces

- **Mutual exclusion**: if an important event is already in `syncedEvent`, the engine refuses to start another one. This is how we prevent Richard's train and Tomáš's DBB from colliding on the same screen.
- **Once per name**: each player is only rolled once per session. Strict-mode re-runs, Firebase echoes, and player-list re-renders don't cause re-rolls.
- **No local mirror state**: activeEntrance and hiddenPlayers are derived purely from `syncedEvent`. Strict Mode's simulated unmount/remount cannot desync the UI from the global truth.
- **Leader-only trigger**: non-leader clients just observe and render. Only the leader writes to Firebase.

### Events that are NOT in the registry (yet)

- PM wizard quotes, dev quotes, fuk-eyes, chicken, OKTA sheep, special round, Richard hunger -- these are still ad-hoc. Dev quotes, fuk eyes, Alan coffee, and Richard hunger are managed by `useAmbientEvents` (leader-only periodic event producers). Porting them to a parallel registry is future work.

## 2.5 File structure

```
src/
  engine/                   Pure utilities (zero React imports)
    sprite.js               Box-shadow sprite rendering (shared by all components)
    animation.js            Easing curves, timing constants, lerp helpers
    gridPosition.js         Math-based grid position (no DOM queries)
    shallowEqual.js         60fps-optimized equality check for phase state
    useAnimationLoop.js     Shared rAF loop hook
  events/                   Entrance event system
    entranceEvents.js       Registry of cinematic entrances (Train, DBB)
    useEntranceEvents.js    Engine: trigger detection, mutex, state derivation
    EntranceStage.jsx       Renderer: mounts whatever event is active
    slotMachine.js          Crowning Machine pure helpers (payload, phase tables, RNG)
    ceremonyPhases.js       Phase state computation (crown removal, delivery, reels)
    useCinematicHandoff.js  Walk-from-cinematic-to-grid-slot transition
  hooks/
    useRoom.js              THE Firebase interface (only module that talks to RTDB)
    useSlotMachine.js       Phase machine for the PM Crowning Machine ceremony
    useCrownOwnership.js    Single source of truth for crown location
    useRoomStartCrowning.js Mini-ceremony for first player's crown delivery
    useWizardPosition.js    JS-driven wizard walk (replaces CSS keyframes)
    useAmbientEvents.js     Leader-only periodic events (dev quotes, fuk eyes, etc.)
  components/
    Room.jsx                Main orchestrator (header, task, players, picker, modals)
    PlayerList.jsx           Player grid with join/leave animations
    PlayerFigure.jsx        Deterministic pixel-art figure from name hash
    Wizard.jsx              PM sprite (idle walk + ceremony pose)
    Crown.jsx               Crown sprite with anchor modes
    SlotMachineStage.jsx    Ceremony overlay (3-act: crown removal, cabinet, delivery)
    SlotMachine.jsx         Slot cabinet visual
    SlotReel.jsx            Single reel with ribbon scroll
    SlotFiller.jsx          Filler sprites (crown, trophy, coffee, etc.)
    Train.jsx               Richard's Shinkansen entrance
    DbbPipeline.jsx         Tomas's DBB pipe entrance
    CardPicker.jsx          Voting card picker (normal + split FE/BE)
    ResultModal.jsx         Vote results with histogram
    RevealBackground.jsx    Floating numbers on reveal
    Chicken.jsx / Sheep.jsx Easter egg animations
    Landing.jsx             Room creation / join screen
    NamePrompt.jsx          Player name entry
    ErrorBoundary.jsx       Crash recovery UI
    room/                   Room sub-components (header, task bar, phase bar, etc.)
    player/                 Player sub-components (card, walking figure, voting cards)
  styles/                   CSS files for keyframe animations
    base.css                Core keyframes (walk-in, walk-out, reveal, float)
    walk.css                Walking animation classes
    events.css              Entrance event animations (train, DBB, chicken, sheep)
    ceremony.css            Crowning Machine animations (cabinet, crown, spotlight)
    wizard.css              Wizard positioning
    responsive.css          Mobile breakpoints
```

Shared constants:
- `src/components/room/styles.js` exports `pixel` (the Press Start 2P font family)
- `src/engine/sprite.js` exports `PX`, `spriteToBoxShadow`, `SPRITE_PIXEL_STYLE`
- `src/engine/animation.js` exports timing constants and easing utilities

## 3. Data flow

```
┌─────────────────────────────┐
│        Firebase RTDB        │   /rooms/{code}/
│                             │       meta/  (phase, task, splitMode,
│                             │               specialRound, syncedEvent, pmQuote, leaderChangedAt)
│                             │       players/{name}/  (vote, voteFe, voteBe, isLeader, role, joinedAt)
└─────────┬─────────┬─────────┘
          │         │
          ▼         ▼
   onValue subs   set/update/remove
          │         │
┌─────────┴─────────┴─────────┐
│       src/hooks/useRoom.js  │   The only module that talks to Firebase.
│                             │   Exposes: players, phase, task, splitMode,
│                             │            specialRound, pmQuote, oktaEvent,
│                             │            syncedEvent, fireSyncedEvent,
│                             │            isLeader, connected, leaderChangedAt,
│                             │            castVote, castVoteFe, castVoteBe,
│                             │            toggleSplit, revealCards, newRound,
│                             │            updateTask, triggerOkta
└────────────────┬────────────┘
                 ▼
       ┌─────────────────────────────┐
       │    src/components/Room.jsx  │  Orchestrates: header, task bar,
       │                             │   PlayerList, CardPicker, PM bar,
       │                             │   ResultModal, Wizard, leader banner,
       │                             │   ErrorBoundary wraps the whole thing
       └─────────────────────────────┘
```

### 3.1 Leader election

- The first client to call `setupPlayer()` writes the room and marks itself `isLeader: true`.
- Subsequent joiners write themselves with `isLeader: !hasLeader && role === 'pm'`.
- When no leader exists, the earliest-joined candidate fires a PM Crowning Machine ceremony (slot-machine animation) instead of bare-setting `isLeader`.
- The ceremony payload is written atomically to `meta/pmRoulette` via a Firebase transaction.
- The only code paths that write `isLeader = true` are:
  (a) `setupPlayer` for the first joiner into a fresh room
  (b) `resolvePmRoulettePromotion` during the crownDelivery phase of the ceremony

**Known limit:** if two clients call `setupPlayer()` on the *same* fresh room in the same event-loop tick, both see `exists=false` and both write the room. The last `set()` wins. In practice this is extremely rare (requires creation collision on a random 6-char code) but it's not defended against. A transaction or a CAS-style check on creation would fix it properly.

### 2.2 Synced events

`fireSyncedEvent({ type, ... }, durationMs)` is the single channel for visual events that must be seen by **every** client:

- Caller writes to `meta/syncedEvent` in Firebase
- Every client's `onValue` listener sees the update and renders
- After `durationMs`, the caller clears `meta/syncedEvent` — but *only if* the same event is still active (we re-read before clearing)
- Important events (`train`, `chicken`) can't be overwritten by minor events (`devQuote`)

**Known limit:** if the leader disconnects mid-event, their cleanup `setTimeout` never fires and the `syncedEvent` stays stuck. The new leader promotion effect defends against this by wiping `meta` flags on takeover, but a dead leader whose replacement hasn't arrived yet will leave non-leader clients stuck on the frozen event.

### 2.3 Per-player presence

`onDisconnect(playerRef).remove()` is what cleans up a player node when their tab closes. This is the only mechanism — there's no heartbeat. Firebase will honor it as soon as the connection times out (seconds, not milliseconds).

---

## 3. Animations — how they really work

Every moving thing in the app uses one of three techniques:

### 3.1 Sliding CSS `@keyframes` (the Wizard's walk, SPECIAL ROUND overlay, train, chicken, sheep)

Pure CSS animation on a positioned element. No React re-renders involved. Fast and cheap.

### 3.2 JS-driven sprite frame toggle (players walking in/out)

`WalkingFigure` is a module-level component that holds a `frame` state, flips it on a `setInterval`, and passes `walkFrame` to `PlayerFigure`. `PlayerFigure` rewrites rows 7–13 of the sprite grid based on the frame — legs, arms, and silhouette all change. A `.walk-bob-{frame}` class on the wrapper adds a vertical bob that syncs with the step.

**Why JS instead of CSS?** With `box-shadow` pixel sprites there is no sprite sheet to shift via `background-position`. We'd need to stack two figures and crossfade opacity, which we tried — it "worked" in principle but felt wrong because both frames blended mid-step instead of snapping cleanly. JS state flips are rock-solid and directly drive a single re-render per step.

**Why module scope?** If `WalkingFigure` is defined *inside* another component, React treats each render of the parent as a brand-new component type, which unmounts/remounts the figure and resets the `setInterval` before it can even tick. This was one of the bugs we hit — we now enforce module scope via a comment in the file and a test that catches the regression.

### 3.3 Firebase-synced timed sequences (Richard's train)

The train is a fully-synced visual event:

1. Leader detects Richard joining → `fireSyncedEvent({ type: 'train', ... }, 9500)`
2. Every client sees the event and mounts `<Train>`
3. Train's own `useEffect` runs a cascading `setTimeout` schedule from `rails → arrive → stopped → bubble → exit → depart → fadeRails → done`
4. On `exit` it calls `onPlayerExit` (Richard now appears in `PlayerList`)
5. On `done` it calls `onDone` (the parent unmounts Train)

**The bug we fixed:** the effect used to depend on `[onPlayerExit]`. Every parent re-render passed a new callback reference, which made React re-run the effect — which cleared the old timers via the cleanup and started a brand-new set. Result: the animation restarted from `rails` mid-way, so non-owners saw the train arrive twice. Fix: callbacks are stashed in refs, the effect has `[]` deps, and we have a regression test that re-renders the parent with fresh callbacks every 1 s and asserts `onPlayerExit` fires exactly once.

### 3.4 Body bob via CSS class switch

The walking bob uses `.walk-bob-{frame}` where `frame` comes from React state. A `transition` smooths the ~3 px step so the eye reads it as a single rolling motion with the leg swap.

---

## 4. Known technical limits & gotchas

1. **React Strict Mode double-invokes effects.** Any effect that mutates a ref based on external state must be idempotent. `PlayerList`'s "new player detection" effect is idempotent because `knownRef.current` is a `Set`.
2. **`vi.mock` path resolution.** Tests mock `src/firebase.js` via a Vitest setup file alias; see `src/test/setup.js` and `src/test/firebase-mock.js`. If you add a new module that imports Firebase, make sure tests don't accidentally hit the real thing.
3. **Race on room creation.** See 2.1. Not defended against yet.
4. **Background tab throttling.** `setInterval` in a background tab is heavily throttled. Walking animations that continue in background tabs may look janky. We don't currently pause them.
5. **No reconnect UI.** `useRoom` tracks a `connected` boolean from initial setup, but it never flips back to `false` if Firebase drops. Adding reconnection awareness via Firebase's `.info/connected` reference is future work.
6. **Inline styles everywhere.** This is a deliberate choice for this app size, but if the repo grows, extracting a shared style object or moving to CSS modules is the natural next step.
7. **Fast Refresh demands single-component exports.** `PlayerList.jsx`, `ResultModal.jsx` etc. export *only* their default component. Pure helper functions live in `<name>.utils.js` siblings. This keeps HMR surgical — editing `PlayerList.jsx` won't trigger a full-page reload.
8. **No auth.** `players/{name}` is keyed by the typed name. Two people typing the same name fight over the same node. The name sanitizer in `NamePrompt.jsx` is strictly for Firebase key-safety (strips `.`, `$`, `#`, `[`, `]`, `/`), not for identity.
9. **CSS animations throttle under `prefers-reduced-motion`**. We don't currently respect this media query. A11y improvement opportunity.

---

## 5. Test architecture

```
src/
  test/
    setup.js             ← vitest setup (testing-library, localStorage cleanup, matchMedia polyfill)
    firebase-mock.js     ← in-memory Firebase Realtime Database clone
    utils.test.js        ← pure helpers: generateRoomCode, isRichardName, hashDir, computeStats, name sanitization
  hooks/
    useRoom.test.js      ← integration tests for the Firebase-backed hook
  components/
    Train.test.jsx           ← regression: onPlayerExit fires exactly once under re-renders
    PlayerList.test.jsx      ← walk-in / walk-out / PM filtering / split mode / hidden votes
    NamePrompt.test.jsx      ← name sanitization + maxLength
    ErrorBoundary.test.jsx   ← catches render errors and shows recovery UI
```

Every bug we fix is accompanied by a regression test that we explicitly verify **would have failed** before the fix.

### Running
- `npm test` → single pass of every test file
- `npm run test:watch` → dev loop

---

## 6. What's intentionally simple

- No routing library — just `?room=CODE` in the URL parsed at startup
- No global state — `Room` reads everything via `useRoom`
- No UI library — pixel-art visuals + Press Start 2P font
- No translation — Czech-English mix in UI strings; we haven't had a reason to split them out

These are deliberate, not oversights. Only add abstraction when it would genuinely reduce friction, not to match what "real" React apps look like.

---

## 7. When you're about to break this

Before touching:

- **`useRoom.js`** — understand the leader promotion loop; read tests first.
- **`Train.jsx`** — effect deps are `[]` by design, callbacks in refs. Don't regress.
- **`PlayerList.jsx`** — `WalkingFigure` lives at module scope for a reason. Don't inline it.
- **`index.css` keyframes** — walkInFromLeft/Right only translates X. Vertical bob is per-figure.
- **`firebase-mock.js`** — if you change it, re-run the useRoom integration tests.

When in doubt: write the regression test first, watch it fail without your change, watch it pass with your change, and only then commit.
