```
  ╔═══════════════════════════════╗
  ║  ♠  ?  ♠  ?  ♠  ?  ♠  ?  ♠  ║
  ║      P L A N N I N G         ║
  ║        P O K E R             ║
  ║  ?  ♠  ?  ♠  ?  ♠  ?  ♠  ?  ║
  ╚═══════════════════════════════╝
```

# Planning Poker

**Retro pixel-art estimation for agile teams. No accounts. No install. Just vibes and Fibonacci.**

[![CI / CD](https://github.com/ToJsemJaHonza/planning-poker/actions/workflows/ci.yml/badge.svg)](https://github.com/ToJsemJaHonza/planning-poker/actions/workflows/ci.yml)

> [**Try it live**](https://tojsemjahonza.github.io/planning-poker/)

---

## What is this?

Planning Poker is a real-time estimation tool for agile teams. Create a room, share the code, pick Fibonacci cards, reveal, discuss. Everything runs in the browser — no signups, no installs, no tracking. Room data lives only in Firebase during your session and is not used for any other purpose.

The entire UI is hand-crafted pixel art: deterministic player avatars, a walking PM wizard, and enough easter eggs to keep grooming sessions from feeling like grooming sessions.

### Why this exists

Most estimation tools are either overengineered enterprise platforms that require accounts and onboarding, or generic card apps with zero personality. Sprint planning is already one of the most dreaded ceremonies — the tool shouldn't make it worse.

Planning Poker is built to be **zero-friction** (share a link, you're in) and **actually fun** (your team gets unique pixel-art avatars, a walking PM wizard drops Michael Scott quotes, and there's a small chance a chicken runs across the screen after reveal). It turns "let's get this over with" into something the team might actually look forward to.

It's also **completely free and self-hostable** — no vendor lock-in, no per-seat pricing, no "upgrade to Pro for more than 5 voters". Just clone it, point it at your own Firebase, and go.

---

## Features

### Core

| Feature | Description |
|---------|-------------|
| **Real-time voting** | Modified Fibonacci deck (1, 2, 3, 5, 8, 13, 21, ?, ☕). Cards appear above your avatar, hidden until reveal. |
| **Three roles** | **Player** votes. **Player-Leader** votes + controls rounds. **Manager** controls rounds, doesn't vote. |
| **FE/BE Split mode** | Special round where the team votes separately for frontend and backend effort. |
| **Results** | Verdict (Perfect match! / Good match / Some spread / Big spread!), average rounded to nearest card, vote histogram. |
| **Room sharing** | Create a room, get a 6-character code, share the link. `?room=CODE` in the URL for instant join. |

### Pixel Art & Personality

- **Deterministic avatars** generated from your name — 14 hair colors, 5 skin tones, 10 shirt colors, 10 haircuts, 14 accessories, 5 poses, 5 leg stances. No two names look alike.
- **PM wizard sprite** walks across the bottom of the screen, pauses to think, and drops Michael Scott quotes and corporate buzzwords. Visible to all players.
- **Walk-in animations** when players join — pixel figures walk in from the sides with a bobbing step cycle.
- **Dev quotes** — 30 IT jokes appear as speech bubbles over random players (2% chance every 3 seconds).

<details>
<summary><strong>Easter eggs (spoilers)</strong></summary>

- **Chicken run** — 1% chance after card reveal: a pixel-art chicken runs across the screen.
- **OKTA sheep** — Player named "Honza" holds O+K+T+A keys simultaneously: a sheep runs across screaming "OKTAAAAAAAAA!!!!"
- **Richard's Shinkansen** — 10% chance when "Richard" joins: a bullet train arrives, stops, Richard exits.
- **Tomáš's DBB Pipeline** — 10% chance when "Tomáš" joins: an industrial pipe extends from a random edge, Tomáš pops out.
- **Fuk eyes** — 10% chance per round for "František"/"Fanda": only eyes and nose visible, peeking pose.
- **Alan's coffee** — 10% chance when "Alan" votes ☕: says "Fullstack FE developer".
- **Richard's hunger** — After 60 minutes in a session, "Richard" starts complaining about food.

All easter eggs are synchronized through Firebase — every player sees the same animation at the same time.

</details>

---

## Quick Start

### Just use it

Open the [live app](https://tojsemjahonza.github.io/planning-poker/), enter your name, create a room, and share the code with your team. Works in all modern desktop browsers. Mobile is functional but best experienced on a larger screen.

### Run locally

```bash
git clone https://github.com/ToJsemJaHonza/planning-poker.git
cd planning-poker
npm install
```

Create a `.env` file with your Firebase Realtime Database credentials (see [`.env.example`](.env.example)). You'll need a free [Firebase Realtime Database](https://firebase.google.com/docs/database) — create one in the [Firebase Console](https://console.firebase.google.com) and copy the config values from **Project Settings > General > Your apps**.

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

Then start the dev server:

```bash
npm run dev
```

> **Note:** Firebase config values are client-side identifiers, not secrets. Security depends on your [Firebase Realtime Database security rules](https://firebase.google.com/docs/database/security), which you configure in the Firebase Console.

> **Note:** The app requires **Node.js >= 22**. CI runs on Node 22.

---

## Tech Stack

| | |
|---|---|
| **Framework** | React 19 — functional components only |
| **Build** | Vite 8 |
| **Real-time backend** | Firebase Realtime Database (free tier, no auth) |
| **Graphics** | Pure CSS `box-shadow` pixel sprites, 5px per pixel |
| **Font** | Press Start 2P |
| **Styling** | Inline style objects + one `index.css` for keyframes |
| **Tests** | Vitest + Testing Library + jsdom |
| **Deploy** | GitHub Pages via GitHub Actions |

No Redux. No CSS preprocessor. No component library. Deliberately minimal.

---

## How It Works

Every client subscribes to a single Firebase room node. One hook ([`useRoom`](src/hooks/useRoom.js)) handles all reads and writes. There is no global state management — React state flows from Firebase through a single hook to the component tree.

All visual events — card reveals, easter eggs, entrance animations, PM quotes — are synchronized through Firebase. Every player sees the same animation at the same time. The room leader makes random decisions and writes results to Firebase; other clients render what they see.

Player avatars are 12×14 pixel grids rendered as a single CSS `box-shadow` string. Every name deterministically generates a unique combination of hair, skin, clothes, pose, stance, and accessories. No images, no canvas — just one `<div>` with a very long `box-shadow`.

See [**ARCHITECTURE.md**](ARCHITECTURE.md) for the full write-up including known limitations, the entrance event engine, animation internals, and the leader election protocol.

---

## Project Structure

```
src/
├── components/     # UI: Room, PlayerList, PlayerFigure, CardPicker, ResultModal, Wizard, Train, ...
├── events/         # Entrance animation engine (registry + hook + renderer)
├── hooks/          # useRoom.js — the only Firebase interface
├── test/           # Test setup + in-memory Firebase mock
├── index.css       # Keyframe animations
└── firebase.js     # Firebase config
```

---

## Testing

Every bug fix ships with a regression test that would have failed before the fix.

```bash
npm test              # single pass (CI gate)
npm run test:watch    # dev loop
npm run lint          # ESLint
```

Tests run in jsdom with an [in-memory Firebase mock](src/test/firebase-mock.js) — no real Firebase project needed. CI runs tests on every push and PR via GitHub Actions.

---

## Deployment

Pushes to `master` trigger a three-stage CI/CD pipeline (`.github/workflows/ci.yml`):

1. **Test** — runs on every push and PR
2. **Build** — injects Firebase config from GitHub Secrets, produces the static bundle
3. **Deploy** — publishes to GitHub Pages

> **Self-hosting:** The Vite config sets `base: '/planning-poker/'`. If you deploy to a different path, update the `base` value in `vite.config.js`.

---

## Contributing

Got an idea? Found a bug? Want a new easter egg for your teammate? [Open an issue](https://github.com/ToJsemJaHonza/planning-poker/issues) — we'd love to hear what would make your sprint planning better.

If you want to contribute code:

1. Read [ARCHITECTURE.md](ARCHITECTURE.md) before touching anything
2. Write regression tests for every change
3. Match the pixel-art aesthetic
4. See [CLAUDE.md](CLAUDE.md) for the full quality bar

---

<sub>Built with coffee, CSS box-shadows, and an unreasonable number of pixel grids.</sub>
