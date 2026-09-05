import { useEventTimeline } from '../../engine/useEventTimeline';
import { useMotionMode } from '../../engine/useMotionMode';
import { envelope, easeOut } from '../../engine/motionStyle';
import PixelSpark from '../PixelSpark';

export default function SpecialRoundOverlay({ timestamp }) {
  const mode = useMotionMode();
  const duration = mode === 'reduced' ? 600 : 2200;
  const elapsed = useEventTimeline(timestamp, duration);
  if (elapsed >= duration) return null;
  const quiet = mode === 'reduced';
  const enter = quiet ? 1 : easeOut(elapsed / 360);
  const part = quiet ? 1 : easeOut((elapsed - 160) / 600);
  return <div data-special-round className="pixel-special-overlay" style={{ opacity: quiet ? 1 : envelope(elapsed, duration) }}>
    <div className="pixel-special-panel" style={{ transform: `translateY(${(1 - enter) * 16}px)` }}>
      <div className="pixel-special-eyebrow"><PixelSpark size={14} /> ROUND MODIFIER <PixelSpark size={14} /></div>
      <div className="pixel-special-title">SPECIAL ROUND!</div>
      <div className="pixel-special-cards">
        <div className="pixel-special-card pixel-special-card--fe" style={{ transform: `translateX(${(1 - part) * 28}px)` }}>FE<span>FRONTEND</span></div>
        <PixelSpark size={21} style={{ opacity: part }} />
        <div className="pixel-special-card pixel-special-card--be" style={{ transform: `translateX(${(1 - part) * -28}px)` }}>BE<span>BACKEND</span></div>
      </div>
      <div className="pixel-special-caption">Two perspectives. One estimate.</div>
      {!quiet && [0, 1, 2, 3].map(i => <PixelSpark key={i} size={12} style={{ position: 'absolute', left: `${12 + i * 25}%`, top: i % 2 ? -12 : 'calc(100% + 8px)', opacity: Math.sin(Math.min(1, elapsed / 1400) * Math.PI) * 0.8, transform: `translateY(${-part * 6}px)` }} />)}
    </div>
  </div>;
}
