import { afterEach, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { usePmDirector } from './usePmDirector';
import { createStageRuntime } from './useCharacterStage';
import CharacterStage from '../components/CharacterStage';
import CrownStage from '../components/CrownStage';
import { setMotionMode, resetMotionProbe } from '../engine/motionProbe';
import { __testing__ as motion } from '../engine/MotionRuntime';

afterEach(() => { resetMotionProbe(); motion.reset(); });

it('paints PM and the carried crown in the same commit as the ceremony phase, without another RAF', () => {
  setMotionMode('reduced'); // no incidental frame may repair a stale paint
  const stage = createStageRuntime();
  function Scene({ x, y, elapsed }) {
    const phaseStateRef = useRef(null);
    usePmDirector({ stage, ceremonyActive: true, phaseStateRef });
    phaseStateRef.current = { elapsed, pmCeremonyPosition: { x, y }, pmCeremonyFacing: 'right', pmCeremonyPose: 'walk1' };
    return <><CharacterStage stage={stage} /><CrownStage stage={stage} crownOwnership={{ location: 'pm-hand', glowing: true }} /></>;
  }
  const view = render(<Scene x={400} y={600} elapsed={16300} />);
  view.rerender(<Scene x={700} y={430} elapsed={19800} />);
  const pm = view.container.querySelector('[data-character-id="pm"]');
  expect(pm.style.transform).toBe('translate(675px, 395px)');
  const crown = view.container.querySelector('[data-cm-crown]');
  expect(crown.style.left).toBe('715px');
  expect(crown.style.top).toBe('415px');
});

it('also publishes room-start positions in the same commit before paint', () => {
  setMotionMode('reduced');
  const stage = createStageRuntime();
  function Scene({ x }) {
    const roomStartStateRef = useRef(null);
    usePmDirector({ stage, ceremonyActive: true, roomStartStateRef });
    roomStartStateRef.current = { active: true, pmPosition: { x, y: 400 }, pmPose: 'cast' };
    return <CharacterStage stage={stage} />;
  }
  const view = render(<Scene x={200} />);
  view.rerender(<Scene x={500} />);
  expect(view.container.querySelector('[data-character-id="pm"]').style.transform).toBe('translate(475px, 365px)');
});
