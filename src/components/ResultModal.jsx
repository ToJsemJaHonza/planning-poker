import { computeStats } from './resultModal.utils';
import { pixel } from './room/styles';

function ResultSection({ title, titleColor, stats }) {
  const { emoji, verdict, color, result, distribution, totalVotes, special } = stats;
  // Bars are scaled to totalVotes (not section-local maxCount) so a full
  // bar always means "everyone voted this", directly comparable between
  // the Frontend and Backend histograms in split mode.
  const denom = Math.max(totalVotes, 1);

  return (
    <div data-result-section style={styles.section}>
      {title && <div style={{ ...styles.sectionTitle, color: titleColor }}>{title}</div>}
      <div style={{ fontSize: '1.8rem' }}>{emoji}</div>
      <div style={{ ...styles.verdict, color }}>{verdict}</div>

      {result !== '-' && (
        <div style={styles.average}>
          Result: <strong>{result}</strong>
        </div>
      )}

      <div data-result-chart style={styles.chart}>
        {Object.entries(distribution)
          .sort((a, b) => {
            const na = Number(a[0]), nb = Number(b[0]);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            if (!isNaN(na)) return -1;
            if (!isNaN(nb)) return 1;
            return 0;
          })
          .map(([value, count]) => (
            <div key={value} data-result-bar style={styles.barCol}>
              <div style={styles.barCount}>{count}</div>
              <div style={{
                ...styles.bar,
                height: `${(count / denom) * 60}px`,
                background: isNaN(Number(value)) ? '#999' : (titleColor || '#d4a853'),
              }} />
              <div style={styles.barLabel}>{value}</div>
            </div>
          ))}
      </div>

      {special.length > 0 && (
        <div style={styles.specials}>
          {special.map((v, i) => (
            // Composite key — two same-named voters still get unique React keys.
            <span key={`${v.name}__${i}`} style={styles.specialItem}>
              {v.vote} {v.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Header shown above the verdict/histogram. Once cards are revealed we
// finally know which task was being estimated — surface it prominently so
// the room isn't left wondering "wait, what were we voting on again?".
function ResultHeader({ title, url }) {
  if (!title) return null;
  return (
    <div data-result-task-header style={styles.taskHeader}>
      <div style={styles.taskHeaderLabel}>Task</div>
      <div style={styles.taskHeaderTitle}>{title}</div>
      {url && (
        <a
          data-result-task-link
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.taskHeaderLink}
        >
          🔗 open
        </a>
      )}
    </div>
  );
}

export default function ResultModal({ players, splitMode, onNewRound, taskTitle, taskUrl }) {
  // Players are keyed by stable session ID — pull the display name off the
  // entry itself so the histogram and "special" rows show human-readable
  // names instead of opaque IDs. Two same-named players are independent
  // entries here, so their votes each count separately.
  if (splitMode) {
    const feVotes = Object.values(players)
      .filter((p) => p.voteFe != null)
      .map((p) => ({ name: p.name, vote: p.voteFe }));

    const beVotes = Object.values(players)
      .filter((p) => p.voteBe != null)
      .map((p) => ({ name: p.name, vote: p.voteBe }));

    const feStats = computeStats(feVotes);
    const beStats = computeStats(beVotes);

    return (
      <div style={styles.overlay}>
        <div
          data-split-modal
          style={{ ...styles.modal, width: 'min(500px, calc(100vw - 32px))' }}
        >
          <ResultHeader title={taskTitle} url={taskUrl} />
          <div style={styles.splitResults} data-split-modal-body>
            <ResultSection title="Frontend" titleColor="#3498db" stats={feStats} />
            <div style={styles.divider} />
            <ResultSection title="Backend" titleColor="#27ae60" stats={beStats} />
          </div>
          <button onClick={onNewRound} style={styles.button}>
            New Round
          </button>
        </div>
      </div>
    );
  }

  // Normal single mode
  const votes = Object.values(players)
    .filter((p) => p.vote != null)
    .map((p) => ({ name: p.name, vote: p.vote }));

  const stats = computeStats(votes);

  return (
    <div style={styles.overlay}>
      <div data-result-modal style={styles.modal}>
        <ResultHeader title={taskTitle} url={taskUrl} />
        <ResultSection stats={stats} />
        <button onClick={onNewRound} style={styles.button}>
          New Round
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: '#f5f0e4',
    border: '4px solid #d4a853',
    borderRadius: '0',
    padding: '1.5rem',
    textAlign: 'center',
    minWidth: '320px',
    maxWidth: '90vw',
    fontFamily: pixel,
    boxShadow: '6px 6px 0 #b8922e',
  },
  splitResults: {
    display: 'flex',
    gap: '0',
    justifyContent: 'center',
  },
  divider: {
    width: '3px',
    background: '#d4a853',
    margin: '0 1rem',
  },
  taskHeader: {
    marginBottom: '0.8rem',
    paddingBottom: '0.6rem',
    borderBottom: '3px solid #e0d6bb',
    textAlign: 'center',
  },
  taskHeaderLabel: {
    fontSize: '0.45rem',
    color: '#b8922e',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    marginBottom: '0.3rem',
    fontFamily: pixel,
  },
  taskHeaderTitle: {
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: '#2a2a3a',
    fontFamily: pixel,
    wordBreak: 'break-word',
  },
  taskHeaderLink: {
    display: 'inline-block',
    marginTop: '0.4rem',
    fontSize: '0.55rem',
    color: '#b8922e',
    textDecoration: 'underline',
    fontFamily: pixel,
  },
  section: {
    flex: 1,
    minWidth: '180px',
  },
  sectionTitle: {
    fontSize: '0.7rem',
    fontFamily: pixel,
    marginBottom: '0.5rem',
    fontWeight: 'bold',
  },
  verdict: {
    fontSize: '0.6rem',
    fontWeight: 'bold',
    margin: '0.3rem 0',
    fontFamily: pixel,
  },
  average: {
    fontSize: '0.9rem',
    margin: '0.5rem 0',
    color: '#2a2a3a',
    fontFamily: pixel,
  },
  chart: {
    display: 'flex',
    gap: '6px',
    justifyContent: 'center',
    alignItems: 'flex-end',
    margin: '0.5rem 0',
    minHeight: '80px',
  },
  barCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
  },
  barCount: {
    fontSize: '0.45rem',
    color: '#888',
    fontFamily: pixel,
  },
  bar: {
    width: '24px',
    borderRadius: '0',
    minHeight: '4px',
  },
  barLabel: {
    fontSize: '0.5rem',
    fontWeight: 'bold',
    color: '#2a2a3a',
    fontFamily: pixel,
  },
  specials: {
    display: 'flex',
    gap: '0.4rem',
    justifyContent: 'center',
    flexWrap: 'wrap',
    margin: '0.4rem 0',
  },
  specialItem: {
    padding: '2px 6px',
    background: '#e8dcc8',
    border: '2px solid #d4a853',
    fontSize: '0.4rem',
    fontFamily: pixel,
  },
  button: {
    marginTop: '1rem',
    padding: '0.6rem 1.5rem',
    fontSize: '0.65rem',
    background: '#d4a853',
    color: '#1e1e2e',
    border: '3px solid #b8922e',
    borderRadius: '0',
    cursor: 'pointer',
    fontFamily: pixel,
    boxShadow: '3px 3px 0 #b8922e',
  },
};
