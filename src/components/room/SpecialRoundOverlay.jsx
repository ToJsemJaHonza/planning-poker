import { pixel } from './styles';
import { useEventTimeline } from '../../engine/useEventTimeline';
import { useMotionMode } from '../../engine/useMotionMode';
import { envelope, easeOut, clamp01 } from '../../engine/motionStyle';

// Original arcade splash (5690bad): no modal frame or cards. Sample the old
// zoom/pulse beats from the shared clock so CSS-disabled clients see them too.
export default function SpecialRoundOverlay({ timestamp }) {
  const quiet = useMotionMode() === 'reduced';
  const duration = quiet ? 600 : 2200;
  const elapsed = useEventTimeline(timestamp, duration);
  if (elapsed >= duration) return null;
  const first = easeOut(elapsed / 300);
  const settle = easeOut((elapsed - 300) / 300);
  const scale = quiet ? 1 : elapsed < 300 ? .3 + first * .8 : 1.1 - settle * .1;
  const angle = quiet ? 0 : elapsed < 300 ? -5 + first * 7 : 2 - settle * 2;
  const pulse = quiet ? 0 : (1 - Math.cos(elapsed / 800 * Math.PI * 2)) / 2;
  const starStyle = { ...styles.stars, transform: `scale(${1 + pulse * .2})`, opacity: quiet ? 1 : .8 + pulse * .2 };
  return <div data-special-round style={{ ...styles.overlay,
    opacity: quiet ? 1 : envelope(elapsed, duration, 330, 550) }}>
    <div data-special-content style={{ position: 'relative', textAlign: 'center',
      transform: `scale(${Number(scale.toFixed(4))}) rotate(${Number(angle.toFixed(4))}deg)`,
      opacity: quiet ? 1 : clamp01(elapsed / 600) }}>
      <div data-special-stars style={starStyle}>✦ ✦ ✦</div>
      <div style={styles.title}>SPECIAL</div>
      <div style={{ ...styles.title, color: '#fff', textShadow: '4px 4px 0 #333, -2px -2px 0 #fff3' }}>ROUND!</div>
      <div style={styles.sub}>FE / BE</div>
      <div data-special-stars style={starStyle}>✦ ✦ ✦</div>
      <div data-special-punchline style={{ ...styles.punchline, opacity: quiet ? 1 : clamp01((elapsed - 650) / 180) }}>
        Two cards. Same deadline.
      </div>
    </div>
  </div>;
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, pointerEvents: 'none', overflow: 'hidden',
  },
  stars: { fontSize: '1.5rem', color: '#f5c542', letterSpacing: '12px', margin: '0.3rem 0' },
  title: {
    fontSize: 'clamp(1.5rem, 6vw, 2.5rem)', fontFamily: pixel, color: '#f5c542',
    textShadow: '4px 4px 0 #b8922e, -2px -2px 0 #fff3', letterSpacing: '6px',
  },
  sub: {
    fontSize: '1rem', fontFamily: pixel, color: '#3498db', marginTop: '0.5rem',
    textShadow: '2px 2px 0 #1a3a5a', letterSpacing: '8px',
  },
  punchline: {
    position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
    width: 'max-content', maxWidth: '90vw', marginTop: 12, lineHeight: 1.8,
    fontFamily: pixel, fontSize: 8, color: '#c3c8ba',
  },
};
