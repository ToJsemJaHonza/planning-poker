/**
 * CrownStage — the SOLE renderer for the crown.
 *
 * Before this component existed, the crown was painted by three different
 * code paths: `PlayerFigure` (for the leader's head), `PmSprite` ceremony
 * mode (for PM's hand during the slot-machine ceremony), and `char.crown`
 * mirroring in both director hooks. Each path had its own state, its own
 * lifecycle, and its own chance to disagree with the others. When the
 * outgoing leader's `char.crown` was cleared one frame before the PM had
 * visibly lifted it, the crown vanished mid-air — the bug that drove this
 * refactor.
 *
 * Now there is ONE crown, rendered here, driven exclusively by the
 * canonical `crownOwnership` object from `useCrownOwnership`. Every other
 * crown-render site has been deleted. If you find yourself adding a crown
 * somewhere else in the tree, stop — the bug you're about to fix will
 * come back. Extend this component instead.
 *
 * Positioning: crown absolute coords are derived from the referenced
 * character's live `position` on the shared stage. The character may be
 * walking, nodding, trembling — the crown rides along because it reads
 * the same position every tick via `useSyncExternalStore`.
 */

import { useSyncExternalStore } from 'react';
import Crown, { CROWN_W } from './Crown';
import { SPRITE_W, SPRITE_H } from '../engine/characterLayout';

// Crown offset from the player sprite's top-left (head anchor).
// Matches Crown.jsx's ANCHOR_OFFSETS.head — that offset was calibrated
// against the PlayerFigure wrapper, which shares the same top-left as the
// character sprite.
const HEAD_OFFSET = { left: 17, top: -22 };

// Crown offset from the PM sprite's top-left (hand anchor).
// (40, 20) = (8*PX, 4*PX) — matches the inline value PmSprite used in
// ceremony mode, keeping the refactor pixel-identical for the ceremony.
const PM_HAND_OFFSET = { left: 40, top: 20 };

/**
 * Absolute top-left for a PM-anchored crown. When the PM faces left the
 * sprite gets an internal scaleX(-1); the crown — rendered OUTSIDE that
 * flipped wrapper — has to mirror its own left offset to stay visually
 * in the PM's hand.
 */
function pmCrownTopLeft(pmChar) {
  const spriteLeft = pmChar.position.x - SPRITE_W / 2;
  const spriteTop = pmChar.position.y - SPRITE_H / 2;
  const leftOffset = pmChar.facingLeft
    ? SPRITE_W - PM_HAND_OFFSET.left - CROWN_W
    : PM_HAND_OFFSET.left;
  return { left: spriteLeft + leftOffset, top: spriteTop + PM_HAND_OFFSET.top };
}

export default function CrownStage({ stage, crownOwnership }) {
  // Re-render on every tick — same pattern CharacterStage uses. The crown's
  // host character is mutated in place; this hook wakes React so we paint.
  useSyncExternalStore(stage.subscribe, stage.getVersion, stage.getVersion);

  if (!crownOwnership || crownOwnership.location === 'none') return null;

  const { location, playerId, progress, glowing } = crownOwnership;

  // Head of a grid player: anchor to the player's character.
  if (location === 'player-head') {
    const char = stage.get(`player-${playerId}`);
    if (!char || char.hidden) return null;
    const spriteLeft = char.position.x - SPRITE_W / 2;
    const spriteTop = char.position.y - SPRITE_H / 2;
    return (
      <Crown
        glowing={!!glowing}
        style={{
          position: 'fixed',
          left: spriteLeft + HEAD_OFFSET.left,
          top: spriteTop + HEAD_OFFSET.top,
          zIndex: (char.zIndex ?? 50) + 1,
        }}
      />
    );
  }

  // All other locations anchor to the PM.
  const pmChar = stage.get('pm');
  if (!pmChar) return null;
  const { left, top } = pmCrownTopLeft(pmChar);
  const pmZ = (pmChar.zIndex ?? 50) + 1;

  if (location === 'pm-hand') {
    return (
      <Crown
        glowing={!!glowing}
        style={{ position: 'fixed', left, top, zIndex: pmZ }}
      />
    );
  }

  if (location === 'lifting') {
    return (
      <Crown
        glowing={!!glowing}
        style={{
          position: 'fixed',
          left,
          top,
          transform: `translate(0px, ${progress * -50}px)`,
          transition: 'transform 300ms steps(12, end)',
          zIndex: pmZ,
        }}
      />
    );
  }

  if (location === 'arcing-to-player') {
    return (
      <Crown
        glowing={!!glowing}
        style={{
          position: 'fixed',
          left,
          top,
          transform: `translate(0px, ${progress * 45}px)`,
          transition: 'transform 300ms steps(12, end)',
          zIndex: pmZ,
        }}
      />
    );
  }

  if (location === 'materializing') {
    return (
      <Crown
        glowing={!!glowing}
        className="cm-crown-materialize"
        style={{ position: 'fixed', left, top, zIndex: pmZ }}
      />
    );
  }

  return null;
}
