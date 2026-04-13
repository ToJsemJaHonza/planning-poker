import { useState, useEffect } from 'react';
import { pixel } from '../room/styles';

const STRESS_METER_CONFIG = {
  1: { fillColor: '#27ae60', label: 'STRESS' },
  2: { fillColor: '#f1c40f', label: 'STRESS' },
  3: { fillColor: '#e67e22', label: 'STRESS' },
  4: { fillColor: '#e74c3c', label: 'STRESS' },
  5: { fillColor: '#c0392b', label: 'MAX STRESS' },
};

const STAGE_THRESHOLDS = [0, 30, 45, 60, 80, 100];

/**
 * Pixel-art stress meter bar below the holdout's name tag.
 * Self-updating: owns its own 1s interval based on startedAt so it never
 * freezes even if parent re-renders are delayed.
 */
export default function StressMeter({ stage, startedAt }) {
  if (stage < 2 || !startedAt) return null;

  const [elapsed, setElapsed] = useState(() => Date.now() - startedAt);

  useEffect(() => {
    const tick = () => setElapsed(Date.now() - startedAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const config = STRESS_METER_CONFIG[stage] || STRESS_METER_CONFIG[2];

  // Compute fill percentage based on where we are within the stage range
  const currentMin = STAGE_THRESHOLDS[stage] || 0;
  const nextMin = STAGE_THRESHOLDS[Math.min(stage + 1, 5)] || 120;
  const elapsedSec = elapsed / 1000;
  const stageProgress = nextMin > currentMin
    ? Math.min(1, (elapsedSec - currentMin) / (nextMin - currentMin))
    : 1;
  const globalPercent = Math.min(100, ((stage - 1) * 20) + stageProgress * 20);

  const pulseScale = stage >= 5 ? 1.08 : stage >= 4 ? 1.05 : stage >= 3 ? 1.03 : 1;

  return (
    <div style={styles.container}>
      <div style={styles.label}>
        <span style={{ ...styles.labelText, color: stage >= 5 ? '#e74c3c' : '#888' }}>
          {config.label}
        </span>
      </div>
      <div
        style={{
          ...styles.barOuter,
          animation: stage >= 3 ? `stressMeterPulse ${stage >= 5 ? 400 : stage >= 4 ? 600 : 1000}ms steps(2, end) infinite` : 'none',
          '--pulse-scale': pulseScale,
        }}
      >
        <div
          style={{
            ...styles.barFill,
            width: `${globalPercent}%`,
            backgroundColor: config.fillColor,
            transition: 'width 400ms ease, background-color 400ms ease',
          }}
        />
        {/* Crack marks at stage 4+ */}
        {stage >= 4 && (
          <>
            <div style={{ ...styles.crack, left: '25%' }} />
            <div style={{ ...styles.crack, left: '65%' }} />
            {stage >= 5 && <div style={{ ...styles.crack, left: '85%' }} />}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1px',
    marginTop: '2px',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
  },
  labelText: {
    fontSize: '0.3rem',
    fontFamily: pixel,
    letterSpacing: '0.5px',
  },
  barOuter: {
    width: '36px',
    height: '6px',
    background: '#444',
    border: '1px solid #666',
    position: 'relative',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  crack: {
    position: 'absolute',
    top: '0',
    width: '2px',
    height: '100%',
    background: '#222',
    opacity: 0.6,
  },
};
