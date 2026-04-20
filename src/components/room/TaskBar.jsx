import { useState, useEffect, useMemo } from 'react';
import { pixel } from './styles';

export default function TaskBar({ task, canControl, phase, onSave, taskList }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  // Close editor when leaving voting phase
  useEffect(() => {
    if (phase !== 'voting') setEditing(false);
  }, [phase]);

  // List-mode branch: whenever the room has ANY backlog items, render the
  // whole backlog horizontally so players can see what's been scored, what's
  // coming, and which item the leader currently has on the table. Players
  // don't see the side panel — this strip is their only view of the list.
  const items = useMemo(() => {
    if (!taskList?.items) return [];
    return Object.entries(taskList.items)
      .map(([id, it]) => ({ id, ...(it || {}) }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [taskList]);

  if (items.length > 0) {
    const activeId = taskList?.activeId || null;
    return (
      <div data-task-bar data-task-list-mode style={styles.taskBarList}>
        <div style={styles.taskListLabel}>Grooming backlog</div>
        <div data-task-strip style={styles.taskStrip}>
          {items.map((item) => {
            const isActive = item.id === activeId;
            const isDone = item.score != null || item.scoreFe != null || item.scoreBe != null;
            const scoreLabel = item.scoreFe != null || item.scoreBe != null
              ? `${item.scoreFe ?? '-'}/${item.scoreBe ?? '-'}`
              : (item.score != null ? String(item.score) : null);
            return (
              <div
                key={item.id}
                data-task-chip
                data-task-chip-id={item.id}
                data-task-chip-active={isActive ? 'true' : 'false'}
                data-task-chip-done={isDone ? 'true' : 'false'}
                aria-current={isActive ? 'true' : undefined}
                title={item.title || 'Untitled'}
                style={{
                  ...styles.chip,
                  ...(isDone && !isActive ? styles.chipDone : null),
                  ...(isActive ? styles.chipActive : null),
                }}
              >
                {isActive
                  ? <span style={styles.chipMarker} aria-hidden="true">▶</span>
                  : isDone
                    ? <span style={styles.chipStatusDone} aria-hidden="true">✓</span>
                    : <span style={styles.chipStatus} aria-hidden="true">○</span>}
                {item.url ? (
                  <a
                    data-task-link
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      ...(isActive ? styles.chipTitleActive : styles.chipTitle),
                      ...styles.chipTitleLink,
                    }}
                  >
                    {item.title || 'Untitled'}
                  </a>
                ) : (
                  <span style={isActive ? styles.chipTitleActive : styles.chipTitle}>
                    {item.title || 'Untitled'}
                  </span>
                )}
                {scoreLabel != null && (
                  <span
                    data-task-chip-score
                    style={isActive ? styles.chipScoreActive : styles.chipScore}
                  >
                    {scoreLabel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const handleEdit = () => {
    if (!canControl) return;
    setDraft(task);
    setEditing(true);
  };

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  return (
    <div data-task-bar style={styles.taskBar}>
      {editing ? (
        <div style={styles.taskEdit}>
          <input
            data-task-input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Task name..."
            style={styles.taskInput}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              else if (e.key === 'Escape') { setEditing(false); setDraft(''); }
            }}
          />
          <button onClick={handleSave} style={styles.taskSaveBtn}>✓</button>
        </div>
      ) : (
        <div data-task-display onClick={handleEdit} style={{
          ...styles.taskDisplay,
          cursor: canControl ? 'pointer' : 'default',
        }}>
          {task || (canControl ? 'Click to set task...' : 'No task')}
        </div>
      )}
    </div>
  );
}

const styles = {
  taskBar: {
    padding: '0.5rem 1rem',
    borderBottom: '3px solid #d0c4ae',
    background: '#f0ead8',
  },
  taskDisplay: {
    fontSize: '0.65rem',
    color: '#888',
    padding: '0.3rem 0',
  },
  taskEdit: {
    display: 'flex',
    gap: '0.5rem',
  },
  taskInput: {
    flex: 1,
    padding: '0.4rem 0.6rem',
    fontSize: '0.65rem',
    border: '3px solid #d4a853',
    borderRadius: '0',
    fontFamily: pixel,
    outline: 'none',
    background: '#f5f0e4',
    color: '#2a2a3a',
  },
  taskSaveBtn: {
    padding: '0.4rem 0.6rem',
    background: '#d4a853',
    color: '#1e1e2e',
    border: '3px solid #b8922e',
    borderRadius: '0',
    cursor: 'pointer',
    fontSize: '0.65rem',
    fontFamily: pixel,
  },
  // Horizontal strip that fills the TaskBar width. The active chip gets
  // a scale-up, gold fill, and a ▶ marker so it reads as the focal point
  // even among a dozen siblings. Pending/done chips share the muted
  // parchment look so the active one stands out by contrast, not by
  // decoration overload.
  taskBarList: {
    padding: '0.9rem 1rem 1.1rem',
    borderBottom: '4px solid #d4a853',
    background: '#fff8e0',
    boxShadow: 'inset 0 -3px 0 #e6d8a8',
  },
  // Bigger tracking + stronger color than before — the label used to
  // drown in the parchment background, so at 0.55/#8a6a1e it now reads
  // as a proper section header rather than decoration.
  taskListLabel: {
    fontSize: '0.55rem',
    color: '#8a6a1e',
    letterSpacing: '3px',
    textTransform: 'uppercase',
    marginBottom: '0.75rem',
    fontFamily: pixel,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  taskStrip: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.7rem',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '0.3rem',
  },
  // Pixel font at <0.6rem is brutal to read — base chip bumped to
  // 0.7rem with near-black ink on parchment so titles don't disappear
  // into the background. Done chips keep a muted *surface* but the ink
  // stays dark; low-contrast grey text on a sandy chip was the worst
  // of both worlds.
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.8rem',
    background: '#fffdf6',
    border: '3px solid #b8a67a',
    boxShadow: '2px 2px 0 #9a8a62',
    fontFamily: pixel,
    fontSize: '0.7rem',
    color: '#1e1e2e',
    lineHeight: 1.3,
    maxWidth: '100%',
    transition: 'transform 0.15s ease',
  },
  chipDone: {
    background: '#e8dcb8',
    color: '#3a3020',
    borderColor: '#8a7d55',
    boxShadow: '2px 2px 0 #6a5d3b',
  },
  chipActive: {
    background: '#d4a853',
    color: '#1a1a2a',
    border: '4px solid #6a5010',
    boxShadow: '5px 5px 0 #6a5010',
    padding: '0.7rem 1.1rem',
    fontSize: '1rem',
    transform: 'scale(1.08)',
    fontWeight: 'bold',
  },
  chipMarker: {
    color: '#1a1a2a',
    fontSize: '0.85rem',
  },
  chipStatus: {
    color: '#8a7d55',
    fontSize: '0.75rem',
    marginRight: '0.1rem',
  },
  chipStatusDone: {
    color: '#4a7a3a',
    fontSize: '0.85rem',
    fontWeight: 'bold',
  },
  chipTitle: {
    whiteSpace: 'nowrap',
    maxWidth: '18ch',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  chipTitleActive: {
    whiteSpace: 'nowrap',
    maxWidth: '24ch',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  // Linked titles inherit the chip's ink color so active/done/pending
  // each keep their own contrast level; a solid `borderBottom` is used
  // instead of `text-decoration` because it renders predictably in a
  // pixel-art font and survives browser defaults. No separate 🔗 icon
  // any more — the underlined title IS the link.
  chipTitleLink: {
    color: 'inherit',
    textDecoration: 'underline',
    textDecorationThickness: '2px',
    textUnderlineOffset: '3px',
    borderBottom: '2px solid currentColor',
    paddingBottom: '1px',
    cursor: 'pointer',
  },
  chipScore: {
    padding: '0.2rem 0.45rem',
    background: '#2a2a3a',
    color: '#ffd76a',
    fontSize: '0.7rem',
    fontWeight: 'bold',
    border: '2px solid #1a1a2a',
  },
  chipScoreActive: {
    padding: '0.25rem 0.5rem',
    background: '#1e1e2e',
    color: '#ffd76a',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    border: '2px solid #000',
  },
};
