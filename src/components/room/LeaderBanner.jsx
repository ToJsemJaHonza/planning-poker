import { useState, useEffect } from 'react';
import { pixel } from './styles';

export default function LeaderBanner({ leaderChangedAt, isLeader, currentLeaderName }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!leaderChangedAt) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 4500);
    return () => clearTimeout(t);
  }, [leaderChangedAt]);

  if (!visible || !currentLeaderName) return null;

  return (
    <div style={styles.leaderBanner} data-testid="leader-banner">
      <span style={styles.leaderBannerText}>
        👑 {isLeader ? 'You are now the leader' : `${currentLeaderName} is now the leader`}
      </span>
    </div>
  );
}

const styles = {
  leaderBanner: {
    position: 'fixed',
    top: 80,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#2a2a3a',
    border: '4px solid #d4a853',
    color: '#d4a853',
    padding: '10px 18px',
    fontSize: '0.7rem',
    fontFamily: pixel,
    boxShadow: '4px 4px 0 #b8922e',
    zIndex: 190,
    letterSpacing: '1px',
    animation: 'specialFade 4.5s ease-in-out forwards',
  },
  leaderBannerText: {
    fontFamily: pixel,
  },
};
