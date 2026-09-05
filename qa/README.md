# Browser animation QA

`npm run dev:qa` opens the **actual Room, components, hooks and CSS** with a
deterministic in-memory Firebase adapter. Open
http://127.0.0.1:5173/planning-poker/qa/ and expand **QA controls** to watch
train/pipe entrances, guest join/leave, connection loss, shame and leader
departure. Task editing, voting, split mode and result dialogs use the normal UI.

Useful query parameters:

- `?role=pm&count=8`: manager view, wrapped roster.
- `?viewer=1&role=pm&count=6`: ordinary player watching a manager leave.
- `?viewer=1&role=player&count=6`: ordinary player watching a crowned leader leave.
- `?motion=none&count=6`: CSS animation/transition disabled, JS motion retained.
- `?motion=reduced`: quiet visual effects. Automated tests also emulate the OS preference.
- `?app`: real name prompt/lobby, for startup and blocked-storage tests.
- `?app&gallery`: detailed character gallery with the unchanged PM as reference;
  compare idle, both walk frames, hands on hips, card holding, peeking and stress.

**Leader leaves** changes the database presence flag; the production election
hook waits its normal 10-second reconnect grace before starting the ceremony.
The default six-player ceremony then runs for 21.3 seconds. No skip or simulated
clock is used in the cross-browser succession tests.

## Automated checks

```sh
npm ci
npx playwright install chromium firefox webkit
npm run test:browser
npm test
npm run lint
npm run build
```

The browser suite runs in Chromium, Firefox and WebKit at desktop and mobile
sizes. It checks font loading, measured figure alignment after layout/scroll/
resize, floating task panel stability, modal controls, blocked storage, CSS-off
entrances, reduced motion, task particle/gauntlet cleanup, and both succession
paths. Succession samples PM position on each animation frame and verifies one
stage crown, no large short-frame jumps, and the successor's final head anchor.
The pixel-art pass additionally checks the special-round panel at 320px,
animal gait changes with CSS animations disabled, and the sheep caption staying
inside the viewport. These scenes have saved mobile screenshots too.
Tests retain failure traces/screenshots; selected visual checkpoints are saved
in `test-results/`. `npx playwright show-report` opens the HTML report.

During development, the new motion/roster/crown tests were also run against
the selected original implementations from `5690bad`: 11 regressions failed
there and all 30 tests in those files passed with the fixes restored.

## Scope and limitations

The QA fixture does **not** connect to a production room or test live Firebase
security rules/network delivery, and separate QA tabs have separate databases.
The existing hook integration suite tests database operations using the same
adapter. WebKit is an engine-level compatibility check, not a claim of testing
every Safari/iPhone version or GPU. Smoothness assertions catch discontinuities;
they do not promise a fixed frame rate on every device.

QA files are excluded from the production Vite entry point and Vitest discovery.
GitHub CI runs all three browser engines and publishes the report artifacts.

## Motion implementation notes

- PM is the visual reference: ink outlines, warm paper, gold and pointer blue;
  smooth travel with small stepped poses, pixel sparks and hard contact shadows.
  Animal gait and dust share their existing timeline; task effects use square
  grains and stepped portal corners. Text translates without stretching/spinning.
- Generated players retain the 12×14 grid and 60×70 layout footprint. Material
  highlights, collars, seams and shoes do not move their head/ground anchors.
  The name hash is deterministic; the zero-shift hair-color selection now uses
  the hash instead of cancelling it out. Other trait selections are preserved.
- Shared `MotionRuntime` remains the only animation-frame scheduler.
- Grid anchors are measured after layout/fonts/resize and compensated for scroll;
  decorative nod/tremble translations never become walking targets.
- Cinematic scenes derive their phase and primary transforms from one absolute
  event timestamp, including CSS-off and resumed/late-client behavior.
- Card flip deadlines are bounded, cancellable and robust to early timers.
- Fonts are bundled locally, including Latin Extended/Czech glyphs.
- Task editor changes are drafts until Save. Draft previews are local; successful
  saves atomically publish task changes plus a timestamped effect in `taskList`.
  Other clients render the same saved operation without a second network write.
  A maximum of three canvas bursts and 1200 grains per removed row bounds cost;
  reduced motion uses a 180ms fade. Expired events never replay on later joins.
