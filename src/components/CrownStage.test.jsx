import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import CrownStage from './CrownStage';
import { createStageRuntime } from '../hooks/useCharacterStage';
import { SPRITE_W, SPRITE_H } from '../engine/characterLayout';
import { CROWN_W } from './Crown';

describe('CrownStage', () => {
  let stage;
  beforeEach(() => {
    stage = createStageRuntime();
  });

  function crownEl(container) {
    return container.querySelector('[data-cm-crown]');
  }

  it('renders nothing when location is none', () => {
    const { container } = render(
      <CrownStage stage={stage} crownOwnership={{ location: 'none', playerId: null, progress: 0, glowing: false }} />
    );
    expect(crownEl(container)).toBeNull();
  });

  it('anchors the crown to the referenced player character for player-head', () => {
    stage.add({
      id: 'player-p0',
      sprite: 'player',
      name: 'Alice',
      position: { x: 400, y: 500 },
      facingLeft: false,
    });
    const { container } = render(
      <CrownStage
        stage={stage}
        crownOwnership={{ location: 'player-head', playerId: 'p0', progress: 1, glowing: false }}
      />
    );
    const el = crownEl(container);
    expect(el).not.toBeNull();
    // Sprite top-left is (x - SPRITE_W/2, y - SPRITE_H/2) = (375, 465).
    // Head offset on top-left = (17, -22) → absolute (392, 443).
    expect(el.style.left).toBe('392px');
    expect(el.style.top).toBe('443px');
    // Crown must follow the character even if the character moves to a
    // brand-new position; sprite-local offsets must not have drifted.
  });

  it('renders a crown on pm-hand aligned to the PM sprite top-left + hand offset', () => {
    stage.add({
      id: 'pm',
      sprite: 'pm',
      position: { x: 200, y: 800 },
      facingLeft: false,
    });
    const { container } = render(
      <CrownStage
        stage={stage}
        crownOwnership={{ location: 'pm-hand', playerId: null, progress: 1, glowing: true }}
      />
    );
    const el = crownEl(container);
    expect(el).not.toBeNull();
    // PM top-left = (175, 765). Hand offset (40, 20) → (215, 785).
    expect(el.style.left).toBe('215px');
    expect(el.style.top).toBe('785px');
  });

  it('mirrors the crown x-offset when the PM is facing left', () => {
    stage.add({
      id: 'pm',
      sprite: 'pm',
      position: { x: 200, y: 800 },
      facingLeft: true,
    });
    const { container } = render(
      <CrownStage
        stage={stage}
        crownOwnership={{ location: 'pm-hand', playerId: null, progress: 1, glowing: false }}
      />
    );
    const el = crownEl(container);
    // PM top-left = 175. Mirrored offset = SPRITE_W - 40 - CROWN_W = 50 - 40 - 30 = -20.
    const expected = 175 + (SPRITE_W - 40 - CROWN_W);
    expect(el.style.left).toBe(`${expected}px`);
  });

  it('lifting: applies negative-y transform scaled by progress', () => {
    // REGRESSION: before CrownStage existed, the crown rendered in two
    // places — a player-head painter (which cleared itself the instant
    // the outgoing-leader director saw the ceremony start) and the
    // PM-ceremony painter (which only started showing the crown once
    // lifting had already begun). There was a gap — sometimes a whole
    // frame — where the crown vanished mid-ceremony. With a single
    // CrownStage driven by the canonical crownOwnership, `lifting` is
    // ALWAYS anchored to the PM's hand and moves smoothly upward from
    // there. The y-offset must be strictly negative for progress > 0.
    stage.add({
      id: 'pm',
      sprite: 'pm',
      position: { x: 200, y: 800 },
      facingLeft: false,
    });
    const { container } = render(
      <CrownStage
        stage={stage}
        crownOwnership={{ location: 'lifting', playerId: null, progress: 0.5, glowing: true }}
      />
    );
    const el = crownEl(container);
    expect(el).not.toBeNull();
    // transform lifts by progress * 50 = 25px upward.
    expect(el.style.transform).toBe('translate(0px, -25px)');
    // The anchor stays the PM hand (absolute left/top) even mid-lift —
    // that's the invariant that prevents the mid-air disappearance.
    expect(el.style.left).toBe('215px');
    expect(el.style.top).toBe('785px');
  });

  it('arcing-to-player: transform y is positive (crown descends toward target head)', () => {
    stage.add({
      id: 'pm',
      sprite: 'pm',
      position: { x: 200, y: 800 },
      facingLeft: false,
    });
    const { container } = render(
      <CrownStage
        stage={stage}
        crownOwnership={{ location: 'arcing-to-player', playerId: 'p0', progress: 0.4, glowing: true }}
      />
    );
    const el = crownEl(container);
    expect(el.style.transform).toBe('translate(0px, 18px)');
  });

  it('materializing: applies the materialize CSS class', () => {
    stage.add({
      id: 'pm',
      sprite: 'pm',
      position: { x: 200, y: 800 },
      facingLeft: false,
    });
    const { container } = render(
      <CrownStage
        stage={stage}
        crownOwnership={{ location: 'materializing', playerId: null, progress: 0.5, glowing: true }}
      />
    );
    const el = crownEl(container);
    expect(el.className).toContain('cm-crown-materialize');
  });

  it('returns null for player-head when the target character is missing', () => {
    // Guard: the outgoing leader could be filtered out of the roster
    // (disconnected, flipped off) while crownOwnership still references
    // their id briefly — we must not crash, we must not paint a ghost
    // crown at (0,0).
    const { container } = render(
      <CrownStage
        stage={stage}
        crownOwnership={{ location: 'player-head', playerId: 'nobody', progress: 1, glowing: false }}
      />
    );
    expect(crownEl(container)).toBeNull();
  });
});
