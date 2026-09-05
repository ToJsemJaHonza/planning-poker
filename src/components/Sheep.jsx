import { useMemo } from 'react';
import { spriteToBoxShadow, PX } from '../engine/sprite';
import { pixel } from './room/styles';
import { useEventTimeline } from '../engine/useEventTimeline';
import { useMotionMode } from '../engine/useMotionMode';
import { MOTION_PALETTE as color, envelope } from '../engine/motionStyle';
import PixelRunner from './PixelRunner';

const _ = null, W = color.white, C = '#bdcbd3', B = color.navy, P = '#d09868', E = color.ink;
const BODY = [
  [_,_,W,W,_,W,W,_,_,_,_,_],
  [_,W,W,W,W,W,W,W,_,_,_,_],
  [W,W,C,W,W,W,C,W,W,_,_,_],
  [W,W,W,W,W,W,W,W,W,B,B,_],
  [W,W,W,C,W,W,W,W,B,B,E,B],
  [_,W,W,W,W,W,W,W,B,B,B,P],
  [_,_,W,W,C,W,W,W,_,B,B,_],
];
const FRAMES = [
  [...BODY, [_,_,B,_,B,_,_,B,_,B,_,_], [_,B,B,_,B,_,_,B,_,B,B,_]],
  [...BODY, [_,_,_,B,B,_,_,B,B,_,_,_], [_,_,_,B,_,B,_,_,B,_,_,_]],
];

export default function Sheep({ timestamp }) {
  const mode = useMotionMode();
  const elapsed = useEventTimeline(timestamp, 4000);
  const frames = useMemo(() => FRAMES.map(frame => spriteToBoxShadow(frame, PX)), []);
  if (mode === 'reduced' || elapsed >= 4000) return null;
  const vw = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const x = (vw + 120) * elapsed / 4000 - 30;
  const bubbleWidth = Math.min(250, vw - 32);
  const bubbleX = Math.max(bubbleWidth / 2 + 16, Math.min(vw - bubbleWidth / 2 - 16, x));
  const frame = Math.floor(elapsed / 180) % 2;
  return <div data-sheep-scene style={{ position: 'fixed', inset: 0, zIndex: 250, pointerEvents: 'none', overflow: 'hidden' }}>
    <div className="sheep-text" style={{ position: 'absolute', top: 'calc(45% - 62px)', left: bubbleX, transform: 'translateX(-50%)', width: bubbleWidth, opacity: envelope(elapsed, 4000, 450, 450), padding: '12px 8px', background: color.paper, color: color.navy, border: `3px solid ${color.navy}`, boxShadow: `4px 4px 0 ${color.ochre}`, font: `0.65rem ${pixel}`, textAlign: 'center', lineHeight: 1.8 }}>
      OKTAAAAAAAA!!!!
      <i style={{ position: 'absolute', bottom: -8, left: '50%', width: 8, height: 8, background: color.navy }} />
    </div>
    <PixelRunner className="sheep-run" elapsed={elapsed} duration={4000} width={60} height={45} top="45%" strideMs={180}>
      <div data-runner-frame={frame} style={{ width: PX, height: PX, boxShadow: frames[frame], position: 'absolute', imageRendering: 'pixelated' }} />
    </PixelRunner>
  </div>;
}
