# Planning Poker — Development Notes

## 🎯 Quality Bar: 120% Perfection Required

Every change merged into this repo is held to a **120% perfection** bar — not 100%, not "it works". The extra 20% is what separates a passable feature from one the user actually feels good about.

Before you consider a change "done":

1. **Test what you built, honestly.** Open the app, reproduce the exact scenario the user would hit, and watch it. Screenshots or inspector evidence, not "I'm pretty sure it works".
2. **Write regression tests.** Every bug you fix and every feature you ship gets a test that would have failed before your fix. No exceptions — the test suite is the only thing standing between us and re-breaking the same thing next week.
3. **Verify the test catches the regression.** Temporarily reintroduce the bug, run the test, see it fail. Then put the fix back. If the test doesn't fail without the fix, the test is worthless.
4. **Look for the second problem.** If you fixed a race in one place, check whether the same race exists elsewhere. If one animation felt wrong, look at the other animations.
5. **Read the final state.** Re-read the diff from top to bottom before calling it done. Check for debug code, temporary values, commented-out experiments, and console.logs.
6. **Match the existing feel.** Pixel-art animations, fonts, spacing, colors — new work must match the rest of the app, not look like it was grafted on.
7. **Think about failure modes.** What happens if Firebase is slow? What happens if a player disconnects mid-animation? What happens if two clients race? Handle it, or document why you chose not to.

"It compiled" is not done. "Tests pass" is not done. 120% perfection is done.

## Architecture

See `ARCHITECTURE.md` for the full write-up of data flow, known limits, and the rationale behind the current design. Read it before making significant changes.

## IMPORTANT: Event Synchronization Rule

**ALL visual events, animations, and easter eggs MUST be synchronized through Firebase.**

Every player must see the same thing at the same time. Never use local `Math.random()` to decide if an event shows on screen. Instead:

1. One client (leader/PM or triggering player) makes the random decision
2. Writes the result to Firebase (e.g. `meta/devQuote`, `meta/chickenEvent`, etc.)
3. All clients read from Firebase and render the same animation
4. The triggering client cleans up the flag after the animation ends

### Currently synced via Firebase:
- Special Round (FE/BE split) animation
- PM quotes (speech bubbles)
- OKTA sheep easter egg
- Card reveal / phase changes
- Player join/leave
- Dev programmer quotes (who speaks + what they say)
- Chicken easter egg (after reveal)
- Fuk eyes pose (františek/fanda)
- Richard's train entrance
- Tomáš DBB pipeline entrance
- Alan coffee quote

### Events that need Firebase sync:
- Any NEW visual event must follow this pattern

## Tech Stack
- React + Vite
- Firebase Realtime Database
- Pixel art sprites via CSS box-shadow
- Press Start 2P font
- GitHub Pages deployment via GitHub Actions

## Feature Descriptions

### Roles
- **PM (Manager)**: Creates room, controls voting (Split, Reveal, New Round), edits task name, does NOT vote, has no player figure. Represented by walking pixel art PM sprite visible to ALL players.
- **Player**: Joins room via code, votes with cards, has pixel art figure. Cannot control voting.
- **Player-Leader**: Player who created the room — can vote AND control voting.

### Voting Flow
1. Players select cards from bottom picker (Fibonacci: 1,2,3,5,8,13,21,?,☕)
2. Cards appear above player figures (hidden pattern until reveal)
3. PM/leader clicks "Reveal Cards" → all cards flip face-up
4. Result modal shows verdict (Perfect match / Good match / Some spread / Big spread), average, and vote distribution histogram
5. "New Round" resets all votes

### FE/BE Split Mode
- PM/leader clicks "✂ Split" → "SPECIAL ROUND!" fullscreen animation (synced via Firebase)
- Two rows of cards appear at bottom (FE blue, BE green)
- Two cards shown per player (FE + BE side by side)
- Result modal shows FE and BE results separately
- New Round resets split mode back to normal

### PM Sprite (Wizard component)
- Walks horizontally at bottom of screen (above card picker)
- Visible to ALL connected players
- Leader's instance runs thinking loop (random pauses, 20% chance of quote)
- Quotes synced to Firebase → all players see same quote as speech bubble above sprite
- Quotes include Michael Scott references and corporate buzzwords

### Player Figures
- Pixel art (12×14 grid, 5px per pixel, CSS box-shadow)
- Deterministic from name: hair style/color, skin tone, shirt/pants color, accessories
- Accessories: glasses, headphones, cap, laptop, coffee, backpack, scarf, hoodie, watch, beard, phone, badge, tie, pen
- Poses: neutral, hips, pockets, crossed, lean (body) + together, apart, crossed, casual, wide (legs)
- Enter animation: walk-in from left/right with bobbing

### Easter Eggs (ALL synced via Firebase)
- **Dev quotes**: 2% chance every 3s, one player speaks at a time (30 IT jokes)
- **Chicken**: 1% chance after reveal, pixel art chicken runs across screen
- **OKTA sheep**: Player named "Honza" holds O+K+T+A keys → sheep runs across screen screaming "OKTAAAAAAAAA!!!!"
- **Fuk eyes**: 10% chance per round for "František"/"Fanda" — only eyes+nose visible, peeking pose
- **Richard's train**: 10% chance when "Richard"/"Ricardo" joins — Shinkansen arrives, "Monorepo conductor has arrived", Richard exits train
- **Alan coffee**: 10% chance when "Alan" votes ☕ → says "Fullstack FE developer"

### Name Validation
- Firebase-unsafe characters stripped: `.` `$` `#` `[` `]` `/`
- Max 20 characters
- Must be non-empty after sanitization

## Testing Checklist

**IMPORTANT: Every change MUST be tested from BOTH perspectives:**
1. **PM/Manager view** (room creator who selected "Manager" role)
2. **Player view** (someone who joined via room code)

### Core Flow Tests
- [ ] Name prompt: enter name, verify saved to localStorage
- [ ] Name validation: try "R.I.C.H.A.R.D" → becomes "RICHARD", try "..." → rejected
- [ ] Landing: create room → role selection appears (Player / Manager)
- [ ] Landing: join via code → goes directly to room as player
- [ ] Room URL: `?room=CODE` in URL auto-joins

### PM View Tests
- [ ] PM sees: Split button, Reveal Cards button, New Round button
- [ ] PM does NOT see: card picker, player figure for themselves
- [ ] PM sees: "Waiting for X players..." status bar at bottom
- [ ] PM can edit task name (click to edit)
- [ ] PM sprite walks at bottom — visible on PM's screen
- [ ] Reveal Cards works: cards flip, result modal appears

### Player View Tests
- [ ] Player sees: card picker at bottom
- [ ] Player does NOT see: Split, Reveal, New Round buttons
- [ ] Player sees: their own figure with golden name tag
- [ ] Player sees: PM sprite walking at bottom
- [ ] Player sees: PM speech bubble when PM "thinks"
- [ ] Voting: click card → card appears above figure (hidden pattern)
- [ ] Cannot edit task name

### Split FE/BE Tests
- [ ] PM clicks Split → SPECIAL ROUND animation (visible to ALL)
- [ ] Two card pickers appear (FE blue label, BE green label) — player view
- [ ] Two cards per player (FE + BE side by side) — both views
- [ ] Vote count shows players who voted BOTH fe+be
- [ ] Reveal shows both cards
- [ ] Result modal shows FE and BE separately
- [ ] New Round resets split mode to normal

### Easter Egg Tests (all must be visible to ALL players)
- [ ] Dev quotes: wait ~30s, random player says IT joke in blue bubble
- [ ] OKTA: login as "Honza", hold O+K+T+A → sheep + text for everyone
- [ ] Fuk eyes: add "Fanda" player, cycle rounds — 10% chance peeking pose
- [ ] Train: add "Richard" player — 10% chance Shinkansen arrives
- [ ] Chicken: reveal cards — 1% chance chicken runs across
- [ ] Alan coffee: add "Alan" with ☕ vote, reveal — 10% chance quote

### Visual Tests
- [ ] Pixel art figures look correct (no broken sprites)
- [ ] Cards: hidden pattern (gold diamond on blue), revealed (white with number)
- [ ] PM sprite: not mirrored text in speech bubble
- [ ] Responsive: figures wrap to multiple rows
- [ ] No JS errors in console
- [ ] Build passes: `npm run build`
