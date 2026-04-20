import { useEffect, useState } from 'react';
import { pixel } from './styles';

/**
 * Transient banner shown to every player when the leader jumps to a new
 * grooming item without finishing the previous one (no score recorded).
 *
 * Driven by `meta/taskSwitchNotice` — `useRoom` writes it from inside
 * `setActiveTask`, and any client will auto-null the key after the TTL
 * elapses. This component renders it with a client-local expiry timer so
 * a late subscription update or a tab-throttled setTimeout can't leave a
 * stale toast on screen.
 */
export default function TaskSwitchToast({ notice }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!notice) { setVisible(false); return undefined; }
    const now = Date.now();
    const ttl = (notice.expiresAt || 0) - now;
    if (ttl <= 0) { setVisible(false); return undefined; }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), ttl);
    return () => clearTimeout(t);
    // `startedAt` is the stable identity of a given notice — re-running
    // the timer on any prop-shape change would let a React rerender
    // spuriously reset the hide countdown.
  }, [notice?.startedAt, notice?.expiresAt, notice]);

  if (!visible || !notice) return null;

  const prev = notice.prevTitle || 'previous task';
  const next = notice.nextTitle || 'new task';

  return (
    <div data-task-switch-toast style={styles.toast} role="status">
      <span style={styles.icon} aria-hidden="true">⚠</span>
      <span style={styles.text}>
        Leader switched to <strong>{next}</strong> — <em>{prev}</em> was not finished.
      </span>
    </div>
  );
}

const styles = {
  toast: {
    position: 'fixed',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 200,
    padding: '0.7rem 1rem',
    background: '#fff8e0',
    border: '4px solid #d4a853',
    boxShadow: '4px 4px 0 #b8922e',
    fontFamily: pixel,
    fontSize: '0.55rem',
    color: '#2a2a3a',
    maxWidth: 'min(540px, 90vw)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    lineHeight: 1.5,
  },
  icon: {
    fontSize: '1rem',
    color: '#b8922e',
  },
  text: {},
};
