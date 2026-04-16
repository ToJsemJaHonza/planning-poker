/**
 * CharacterSprite — dumb renderer for one Character.
 *
 * Reads `character.position`, offsets by half-sprite (unified center-coord
 * convention, see characterLayout.js), and paints the underlying PM or
 * player sprite. Every animation update — position, facing, pose,
 * walkFrame, crown, bubble, hidden — flows in through the character model
 * mutated by tickCharacter; this component does not own any timers, refs,
 * or branching logic that could drift.
 */

import { useMemo } from 'react';
import PmSprite from './PmSprite';
import PlayerFigure from './PlayerFigure';
import { SPRITE_W, SPRITE_H } from '../engine/characterLayout';

/**
 * Translate a Character into the `model` prop shape that PmSprite's
 * ceremony branch consumes. PmSprite ceremony mode renders a
 * relatively-positioned sprite — exactly what the outer CharacterSprite
 * wrapper wants.
 */
function toPmModel(character) {
  // character.pose accepts: 'walk' | 'walk1' | 'walk2' | 'cast' | 'think'.
  // walk1/walk2 pin the sprite to a specific frame (used by ceremony phase
  // state). Bare 'walk' defers to character.walkFrame (used by idle, which
  // updates the frame from the thinking loop / tickCharacter).
  let pose = 'walk';
  let walkFrame = character.walkFrame;
  switch (character.pose) {
    case 'cast': pose = 'cast'; break;
    case 'think': pose = 'think'; break;
    case 'walk1': pose = 'walk'; walkFrame = 0; break;
    case 'walk2': pose = 'walk'; walkFrame = 1; break;
    default: pose = 'walk'; break;
  }
  return {
    mode: 'ceremony',
    walkFrame,
    pose,
    showSparkles: false,
    bubble: character.bubble?.text ?? '',
    showBubble: !!character.bubble,
    facingLeft: !!character.facingLeft,
    position: null,
    crownState: character.crown,
    crownGlowing: character.crown?.glowing ?? false,
  };
}

export default function CharacterSprite({ character }) {
  const { position, zIndex, hidden, sprite } = character;
  const x = position.x - SPRITE_W / 2;
  const y = position.y - SPRITE_H / 2;

  const pmModel = useMemo(
    () => (sprite === 'pm' ? toPmModel(character) : null),
    // Re-derive on any visible state change. Object identity stays the
    // same because `character` is mutated in place, so we list the leaf
    // fields the PM renderer actually reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      sprite,
      character.pose,
      character.walkFrame,
      character.facingLeft,
      character.bubble?.text,
      character.crown?.mode,
      character.crown?.progress,
      character.crown?.glowing,
    ],
  );

  return (
    <div
      data-character-id={character.id}
      data-character-sprite={sprite}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate(${x}px, ${y}px)`,
        zIndex: zIndex ?? 50,
        visibility: hidden ? 'hidden' : 'visible',
        pointerEvents: 'none',
        imageRendering: 'pixelated',
        willChange: 'transform',
      }}
    >
      {sprite === 'pm' ? (
        <PmSprite model={pmModel} />
      ) : (
        <div
          className={character.className || undefined}
          style={{
            width: SPRITE_W,
            height: SPRITE_H,
            transform: character.facingLeft ? 'scaleX(-1)' : 'scaleX(1)',
            transformOrigin: 'center center',
          }}
        >
          <PlayerFigure
            name={character.name || 'anon'}
            walkFrame={character.walkFrame}
            pose={character.pose === 'walk1' || character.pose === 'walk2' ? null : character.pose}
            showCrown={!!character.crown}
            fukEyes={!!character.fukEyes}
            stressStage={character.stressStage || 0}
          />
        </div>
      )}
    </div>
  );
}
