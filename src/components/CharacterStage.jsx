/**
 * CharacterStage — renders every character owned by a stage runtime.
 *
 * One instance mounts at the top of Room.jsx after Phase 2. All animated
 * figures (PM, grid players, entering cinematics, outgoing leaders) live
 * here; there is no other place in the tree that mounts a walking sprite.
 */

import { useSyncExternalStore } from 'react';
import CharacterSprite from './CharacterSprite';

export default function CharacterStage({ stage }) {
  // Re-render on every tick. The actual per-frame mutations live in the
  // character model objects; this hook just wakes React up so it paints.
  useSyncExternalStore(stage.subscribe, stage.getVersion, stage.getVersion);

  return (
    <>
      {stage.all().map((character) => (
        <CharacterSprite key={character.id} character={character} />
      ))}
    </>
  );
}
