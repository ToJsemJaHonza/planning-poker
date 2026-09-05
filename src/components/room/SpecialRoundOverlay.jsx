import { pixel } from './styles';
import { useEventTimeline } from '../../engine/useEventTimeline';
import { useMotionMode } from '../../engine/useMotionMode';

export default function SpecialRoundOverlay({ timestamp }) {
  const mode = useMotionMode();
  const duration = mode === 'reduced' ? 600 : 2200;
  const elapsed = useEventTimeline(timestamp, duration);
  if (elapsed >= duration) return null;
  const opacity = mode === 'reduced' ? 1 : Math.min(1, elapsed / 180, (duration - elapsed) / 300);
  return (
    <div style={{ ...styles.specialOverlay, opacity }}>
      <div style={styles.specialContent}>
        <div style={styles.specialStars}>✦ ✦ ✦</div>
        <div style={styles.specialText}>SPECIAL</div>
        <div style={styles.specialText2}>ROUND!</div>
        <div style={styles.specialSub}>FE / BE</div>
        <div style={styles.specialStars}>✦ ✦ ✦</div>
      </div>
    </div>
  );
}

const styles = {
  specialOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    pointerEvents: 'none',
  },
  specialContent: {
    textAlign: 'center',
    animation: 'specialZoom 0.6s ease-out',
  },
  specialStars: {
    fontSize: '1.5rem',
    color: '#f5c542',
    letterSpacing: '12px',
    margin: '0.3rem 0',
    animation: 'specialPulse 0.8s ease-in-out infinite',
  },
  specialText: {
    fontSize: 'clamp(1.4rem, 7vw, 2.5rem)',
    fontFamily: pixel,
    color: '#f5c542',
    textShadow: '4px 4px 0 #b8922e, -2px -2px 0 #fff3',
    letterSpacing: '6px',
  },
  specialText2: {
    fontSize: 'clamp(1.4rem, 7vw, 2.5rem)',
    fontFamily: pixel,
    color: '#fff',
    textShadow: '4px 4px 0 #333, -2px -2px 0 #fff3',
    letterSpacing: '6px',
  },
  specialSub: {
    fontSize: '1rem',
    fontFamily: pixel,
    color: '#3498db',
    marginTop: '0.5rem',
    textShadow: '2px 2px 0 #1a3a5a',
    letterSpacing: '8px',
  },
};
