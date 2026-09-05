import { useMemo } from 'react';
import { spriteToBoxShadow, PX } from '../engine/sprite';
import { useEventTimeline } from '../engine/useEventTimeline';
import { useMotionMode } from '../engine/useMotionMode';
import { MOTION_PALETTE as color } from '../engine/motionStyle';
import PixelRunner from './PixelRunner';

const _ = null, W = color.white, S = '#cbd5db', Y = color.gold, R = color.red, B = color.ink;
const BODY = [
  [_,_,_,_,_,R,R,_,_,_],
  [_,_,_,_,W,W,W,W,_,_],
  [_,_,_,_,W,W,B,W,Y,Y],
  [W,_,W,W,W,W,W,W,_,_],
  [W,W,W,S,S,W,W,R,_,_],
  [_,W,W,W,S,W,W,_,_,_],
  [_,_,W,W,W,W,_,_,_,_],
];
const FRAMES = [
  [...BODY, [_,_,_,Y,_,Y,_,_,_,_], [_,_,Y,Y,_,Y,Y,_,_,_]],
  [...BODY, [_,_,_,_,Y,Y,_,_,_,_], [_,_,_,_,Y,_,Y,_,_,_]],
];

export default function Chicken({ timestamp }) {
  const mode = useMotionMode();
  const elapsed = useEventTimeline(timestamp, 3000);
  const frames = useMemo(() => FRAMES.map(frame => spriteToBoxShadow(frame, PX)), []);
  if (mode === 'reduced' || elapsed >= 3000) return null;
  const frame = Math.floor(elapsed / 150) % 2;
  return <div data-chicken-scene style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none', overflow: 'hidden' }}>
    <PixelRunner className="chicken-run" elapsed={elapsed} duration={3000} width={50} height={45} top="60%">
      <div data-runner-frame={frame} style={{ width: PX, height: PX, boxShadow: frames[frame], position: 'absolute', imageRendering: 'pixelated' }} />
    </PixelRunner>
  </div>;
}
