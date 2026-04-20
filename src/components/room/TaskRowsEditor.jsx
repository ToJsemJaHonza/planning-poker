import { useRef } from 'react';
import { pixel } from './styles';

/**
 * Controlled row-based editor for grooming tasks. Each row is a
 * { id?, title, url } triple. The parent owns the `rows` state; the
 * editor emits `onChange(nextRows)` for every input or add/remove.
 *
 * Shared by the Landing "Tasks to groom" step and the mid-session
 * TaskListPanel "Edit" mode — both need the same keyboard ergonomics
 * (Enter in the URL field of the last row appends a fresh row) and
 * the same pixel-art look.
 */
export default function TaskRowsEditor({ rows, onChange, autoFocusFirst = false }) {
  const firstInputRef = useRef(null);

  const updateRow = (i, patch) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange(next);
  };

  const addRow = () => {
    onChange([...rows, { title: '', url: '' }]);
  };

  const removeRow = (i) => {
    if (rows.length === 1) {
      onChange([{ title: '', url: '' }]);
      return;
    }
    onChange(rows.filter((_, idx) => idx !== i));
  };

  const handleUrlKeyDown = (e, i) => {
    if (e.key === 'Enter' && i === rows.length - 1) {
      e.preventDefault();
      addRow();
    }
  };

  return (
    <div data-task-rows-editor style={styles.wrapper}>
      {rows.map((row, i) => (
        <div key={i} style={styles.row} data-task-row>
          <input
            ref={i === 0 && autoFocusFirst ? firstInputRef : null}
            autoFocus={i === 0 && autoFocusFirst}
            data-task-title-input
            type="text"
            value={row.title}
            onChange={(e) => updateRow(i, { title: e.target.value })}
            placeholder="Task title"
            style={styles.titleInput}
            maxLength={120}
          />
          <input
            data-task-url-input
            type="text"
            value={row.url}
            onChange={(e) => updateRow(i, { url: e.target.value })}
            onKeyDown={(e) => handleUrlKeyDown(e, i)}
            placeholder="Link (optional) — e.g. seznam.cz"
            style={styles.urlInput}
            maxLength={500}
          />
          <button
            type="button"
            data-task-row-remove
            onClick={() => removeRow(i)}
            style={styles.removeBtn}
            title="Remove row"
            aria-label="Remove row"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        data-task-row-add
        onClick={addRow}
        style={styles.addBtn}
      >
        + Add row
      </button>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    width: '100%',
  },
  row: {
    display: 'flex',
    gap: '0.4rem',
    alignItems: 'stretch',
  },
  titleInput: {
    flex: '1 1 40%',
    minWidth: 0,
    padding: '0.4rem 0.5rem',
    fontSize: '0.55rem',
    border: '3px solid #d4a853',
    borderRadius: 0,
    fontFamily: pixel,
    background: '#fff',
    color: '#2a2a3a',
    outline: 'none',
  },
  urlInput: {
    flex: '1 1 60%',
    minWidth: 0,
    padding: '0.4rem 0.5rem',
    fontSize: '0.55rem',
    border: '3px solid #d4a853',
    borderRadius: 0,
    fontFamily: pixel,
    background: '#fff',
    color: '#2a2a3a',
    outline: 'none',
  },
  removeBtn: {
    flex: '0 0 auto',
    padding: '0 0.6rem',
    fontSize: '0.6rem',
    background: '#f5f0e4',
    color: '#b8922e',
    border: '3px solid #d4a853',
    borderRadius: 0,
    cursor: 'pointer',
    fontFamily: pixel,
  },
  addBtn: {
    alignSelf: 'flex-start',
    padding: '0.4rem 0.8rem',
    fontSize: '0.55rem',
    background: '#2a2a3a',
    color: '#d4a853',
    border: '3px solid #1a1a2a',
    borderRadius: 0,
    cursor: 'pointer',
    fontFamily: pixel,
  },
};
