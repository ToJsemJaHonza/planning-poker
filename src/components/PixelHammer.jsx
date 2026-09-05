import { PX, spriteToBoxShadow, SPRITE_PIXEL_STYLE } from '../engine/sprite';
import { hammerDesign } from './hammerDesign';

const glyphs = {
  B: '110101110101110', O: '111101101101111',
  N: '101111111111101', K: '101101110101101',
};
const label = hammerDesign.labels[0];
const letterWidth = label.pixel * PX;
const letterHeight = label.pixelY * PX;
const labelWidth = (label.text.length * 4 - 1) * letterWidth;
const labelHeight = 5 * letterHeight;

// The shaft rotates around the PM's stationary palm in both walking frames.
export const HAMMER_HAND = { x: 7 * PX, y: 8 * PX };
export const HAMMER_GRIP = { x: 12 * PX, y: 24 * PX };

export default function PixelHammer({ angle, facingLeft = false }) {
  return <div data-pm-hammer aria-hidden="true" style={{
    position: 'absolute', left: HAMMER_HAND.x, top: HAMMER_HAND.y,
    width: 0, height: 0, pointerEvents: 'none',
  }}>
    <div data-hammer-body style={{
      position: 'absolute', left: -HAMMER_GRIP.x, top: -HAMMER_GRIP.y,
      width: 24 * PX, height: 28 * PX,
      transform: `rotate(${angle}deg)`, transformOrigin: `${HAMMER_GRIP.x}px ${HAMMER_GRIP.y}px`,
    }}>
      <svg data-hammer-art width={24 * PX} height={28 * PX} shapeRendering="crispEdges">
        {hammerDesign.shapes.map((r, i) => <rect key={i} x={r.x * PX} y={r.y * PX}
          width={r.w * PX} height={r.h * PX} fill={r.fill} />)}
      </svg>
      <div data-hammer-lettering data-label={label.text} style={{
        position: 'absolute', left: label.x * PX, top: label.y * PX, width: labelWidth, height: labelHeight,
        transform: facingLeft ? 'scaleX(-1)' : 'scaleX(1)',
      }}>
        <svg width={labelWidth} height={labelHeight} shapeRendering="crispEdges">
          {[...label.text].flatMap((letter, index) => [...glyphs[letter]].map((bit, p) => bit === '1'
            ? <rect key={`${index}:${p}`} x={(index * 4 + p % 3) * letterWidth}
              y={Math.floor(p / 3) * letterHeight} width={letterWidth} height={letterHeight} fill={label.color} /> : null))}
        </svg>
      </div>
    </div>
    {/* Stationary knuckles overlap the shaft so the PM visibly holds it. */}
    <div data-hammer-grip style={{ ...SPRITE_PIXEL_STYLE,
      boxShadow: spriteToBoxShadow([['#f0c8a0', '#f0c8a0'], ['#d09868', null]]),
    }} />
  </div>;
}
