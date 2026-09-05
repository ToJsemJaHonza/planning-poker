# Duplicate-session QA

Run `npx vite --config qa/session-vite.config.js --port 5180` and open
`http://127.0.0.1:5180/qa/session-eviction.html`.
This fixture uses a local, cross-tab database mock; no Firebase credentials or
production writes are involved. Only the QA server aliases the Firebase module.
Add `&debug` to display the navigation type and this connection's fixture record.

1. Pick a card as Alice. Open the “PM view” link in another tab.
2. Open “Join another tab” in a new tab. All views see the PM approach,
   raise the hammer, speak and launch the old avatar out of the room.
3. After 6.6 seconds the original player view is disconnected. The new tab
   still has its selected card. Refresh the new tab: no hammer, same card.
4. “New split test” resets only the local QA room. Pick FE and BE cards,
   then repeat. Check that both stay selected and the vote counts only once.
5. Repeat with `&motion=none` (CSS animations disabled) and `&motion=reduced`
   (motion preference override). The latter keeps the message but omits flight.

Unit/integration coverage is in `sessionEviction.test.js`,
`useRoom.sessionEviction.test.jsx` and `useSessionEviction.test.js`.
The card-preservation regression was verified by temporarily clearing the
transferred vote, observing its failure, then restoring the implementation.

The hammer uses concept #4's red slab with large bitmap `BONK` lettering, including a facing correction
so the lettering is never mirrored. `PixelHammer.test.jsx` covers both facings
and the hand pivot. The mirrored-text regression was verified by removing that
correction and observing the test fail.

For the split intro, open the PM view and toggle FE/BE off then on. Both tabs
should see the original fullscreen arcade composition: gold/white SPECIAL / ROUND!,
blue FE / BE, two rows of pulsing stars and the 0.3 → 1.1 → 1 zoom entrance.
The small punchline appears after the zoom. No panel or large FE/BE cards.
With `motion=none` zoom and pulses still advance; `motion=reduced` keeps everything still.
`useRoom.splitEffects.test.jsx` checks that ambient quotes cannot overwrite the
intro; removing `specialRound` from the protected events makes that test fail.
