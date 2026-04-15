import { useState, useEffect } from 'react';
import { pixel } from './styles';

export default function TaskBar({ task, canControl, phase, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  // Close editor when leaving voting phase
  useEffect(() => {
    if (phase !== 'voting') setEditing(false);
  }, [phase]);

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
};
