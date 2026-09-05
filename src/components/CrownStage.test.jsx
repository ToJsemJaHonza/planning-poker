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

  it.each(['lifting', 'arcing-to-player'])('%s follows a continuous head-to-hand arc without a trailing transition', location => {
    stage.add({ id: 'pm', sprite: 'pm', position: { x: 200, y: 800 } });
    stage.add({ id: 'player-p0', sprite: 'player', position: { x: 400, y: 300 } });
    const head = { left: 392, top: 243 };
    const hand = { left: 215, top: 785 };
    const from = location === 'lifting' ? head : hand;
    const to = location === 'lifting' ? hand : head;
    const { container, rerender } = render(<CrownStage stage={stage} crownOwnership={{ location, playerId: 'p0', progress: 0 }} />);
    expect(crownEl(container).style.left).toBe(from.left + 'px');
    expect(crownEl(container).style.top).toBe(from.top + 'px');
    rerender(<CrownStage stage={stage} crownOwnership={{ location, playerId: 'p0', progress: 0.5 }} />);
    expect(parseFloat(crownEl(container).style.left)).toBe((from.left + to.left) / 2);
    expect(parseFloat(crownEl(container).style.top)).toBe((from.top + to.top) / 2 - 24);
    expect(crownEl(container).style.transition).toBe('');
    rerender(<CrownStage stage={stage} crownOwnership={{ location, playerId: 'p0', progress: 1 }} />);
    expect(parseFloat(crownEl(container).style.left)).toBeCloseTo(to.left);
    expect(parseFloat(crownEl(container).style.top)).toBeCloseTo(to.top);
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
