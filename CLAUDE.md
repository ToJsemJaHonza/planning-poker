# Planning Poker — Development Notes

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

### Events that need Firebase sync:
- Dev programmer quotes (who speaks + what they say)
- Chicken easter egg (after reveal)
- Fuk eyes pose (františek/fanda)
- Richard's train entrance
- Alan coffee quote

## Tech Stack
- React + Vite
- Firebase Realtime Database
- Pixel art sprites via CSS box-shadow
- Press Start 2P font
- GitHub Pages deployment via GitHub Actions
