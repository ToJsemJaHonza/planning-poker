import { useMemo, useState, useEffect } from 'react';
import { pixel } from './styles';
import TaskRowsEditor from './TaskRowsEditor';
import { buildTaskText, triggerDownload, copyToClipboard } from './export.utils';

/**
 * Collapsible side panel that surfaces the grooming backlog to every
 * player. Leaders additionally get:
 *   - click a pending row to jump to it
 *   - Edit mode to add / remove / rename rows
 *   - Export button that produces a TSV download + clipboard copy
 *
 * Hidden entirely when there is no list AND the local user is not a
 * leader — leaders still see the empty-state "Add tasks" affordance so
 * they can bootstrap a backlog mid-session.
 */
export default function TaskListPanel({
  taskList,
  isLeader,
  onSetActive,
  onEdit,
  roomCode,
}) {
  const [editing, setEditing] = useState(false);
  const [draftRows, setDraftRows] = useState([{ title: '', url: '' }]);
  const [exportStatus, setExportStatus] = useState(null); // 'copied' | 'downloaded' | 'no-clipboard'

  // Panel open/close: default open on desktop, collapsed on mobile, and
  // remember the user's choice across re-renders for this session.
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 720;
  });

  useEffect(() => {
    if (!exportStatus) return undefined;
    const t = setTimeout(() => setExportStatus(null), 2000);
    return () => clearTimeout(t);
  }, [exportStatus]);

  const items = useMemo(() => {
    if (!taskList || !taskList.items) return [];
    return Object.entries(taskList.items)
      .map(([id, it]) => ({ id, ...(it || {}) }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [taskList]);

  const doneCount = items.filter(scored).length;

  // Hide the panel entirely when nothing to show and the user cannot
  // create a list. Non-leader + no list = wasted chrome.
  if (!items.length && !isLeader) return null;

  const startEdit = () => {
    const rows = items.length
      ? items.map((it) => ({ id: it.id, title: it.title, url: it.url || '' }))
      : [{ title: '', url: '' }];
    setDraftRows(rows);
    setEditing(true);
    setOpen(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const saveEdit = async () => {
    if (!onEdit) { setEditing(false); return; }
    await onEdit(draftRows);
    setEditing(false);
  };

  const handleRowClick = (item) => {
    // Only leaders, and only for pending (not active, not scored) items.
    if (!isLeader || !onSetActive) return;
    if (item.id === taskList.activeId) return;
    if (scored(item)) return;
    onSetActive(item.id);
  };

  const handleExport = async () => {
    const content = buildTaskText(items);
    const filename = `planning-poker-${roomCode || 'session'}-${Date.now()}.txt`;
    triggerDownload(filename, content);
    const copied = await copyToClipboard(content);
    setExportStatus(copied ? 'copied' : 'downloaded');
  };

  return (
    <div data-task-list-panel style={{ ...styles.panel, ...(open ? null : styles.panelCollapsed) }}>
      <button
        type="button"
        data-task-panel-toggle
        onClick={() => setOpen((o) => !o)}
        style={styles.header}
        aria-expanded={open}
      >
        <span style={styles.headerTitle}>Tasks</span>
        <span style={styles.headerMeta}>
          {items.length > 0 && (
            <span data-task-panel-progress style={styles.headerProgress}>
              {doneCount}/{items.length}
            </span>
          )}
          <span style={styles.headerCaret}>{open ? '▾' : '▸'}</span>
        </span>
      </button>

      {open && (
        <div style={styles.body}>
          {editing ? (
            <div data-task-panel-edit>
              <TaskRowsEditor rows={draftRows} onChange={setDraftRows} autoFocusFirst />
              <div style={styles.editActions}>
                <button type="button" onClick={cancelEdit} style={styles.cancelBtn}>Cancel</button>
                <button type="button" data-task-panel-save onClick={saveEdit} style={styles.saveBtn}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {items.length === 0 ? (
                <div style={styles.empty} data-task-panel-empty>
                  No tasks yet. {isLeader ? 'Add some to start grooming.' : ''}
                </div>
              ) : (
                <ul style={styles.list} data-task-panel-list>
                  {items.map((item) => {
                    const isActive = item.id === taskList.activeId;
                    const isDone = scored(item);
                    const isPending = !isActive && !isDone;
                    const clickable = isLeader && isPending;
                    return (
                      <li
                        key={item.id}
                        data-task-item
                        data-task-item-id={item.id}
                        data-task-item-active={isActive ? 'true' : 'false'}
                        data-task-item-done={isDone ? 'true' : 'false'}
                        onClick={clickable ? () => handleRowClick(item) : undefined}
                        style={{
                          ...styles.item,
                          ...(isActive ? styles.itemActive : null),
                          ...(isDone ? styles.itemDone : null),
                          cursor: clickable ? 'pointer' : 'default',
                        }}
                        title={clickable ? 'Click to make this the active task' : undefined}
                      >
                        <span style={styles.marker}>
                          {isActive ? '▶' : isDone ? '✓' : '○'}
                        </span>
                        <span style={styles.title}>{item.title}</span>
                        {item.score != null && (
                          <span style={styles.score}>{item.score}</span>
                        )}
                        {(item.scoreFe != null || item.scoreBe != null) && (
                          <span style={styles.score}>
                            {item.scoreFe ?? '-'}/{item.scoreBe ?? '-'}
                          </span>
                        )}
                        {item.url && (
                          <a
                            data-task-item-link
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={styles.linkIcon}
                            aria-label="Open task link"
                          >
                            🔗
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {isLeader && (
                <div style={styles.leaderActions}>
                  <button
                    type="button"
                    data-task-panel-edit-btn
                    onClick={startEdit}
                    style={styles.actionBtn}
                  >
                    {items.length === 0 ? '+ Add tasks' : '✏ Edit'}
                  </button>
                  {items.length > 0 && (
                    <button
                      type="button"
                      data-task-panel-export
                      onClick={handleExport}
                      style={styles.actionBtn}
                    >
                      📥 Export
                    </button>
                  )}
                </div>
              )}

              {exportStatus && (
                <div data-task-panel-export-status style={styles.exportStatus}>
                  {exportStatus === 'copied' && '✓ Copied to clipboard + downloaded'}
                  {exportStatus === 'downloaded' && '✓ Downloaded (clipboard unavailable)'}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function scored(item) {
  if (!item) return false;
  return item.score != null || item.scoreFe != null || item.scoreBe != null;
}

// Panel sized ~50% larger than the original compact design — the user
// found the smaller variant hard to read and interact with. Widths and
// font sizes were scaled together so the pixel-art proportions stay
// coherent rather than looking zoomed.
const styles = {
  panel: {
    position: 'fixed',
    // Sits below the TaskBar strip so the (now-taller) horizontal chip
    // row stays fully visible on a single wrap line. With many chips
    // wrapping to 3+ rows this panel can still occlude the tail — an
    // accepted trade-off rather than pushing the panel fully off-screen.
    top: 180,
    right: 12,
    zIndex: 50,
    width: 'min(420px, calc(100vw - 24px))',
    background: '#f5f0e4',
    border: '4px solid #d4a853',
    boxShadow: '6px 6px 0 #b8922e',
    fontFamily: pixel,
    color: '#2a2a3a',
  },
  panelCollapsed: {
    // Same surface, just without the body
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '0.75rem 1rem',
    background: '#f0ead8',
    border: 'none',
    borderBottom: '4px solid #d4a853',
    cursor: 'pointer',
    fontFamily: pixel,
    fontSize: '0.9rem',
    color: '#2a2a3a',
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  headerMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '0.8rem',
    color: '#888',
  },
  headerProgress: {
    color: '#b8922e',
    fontWeight: 'bold',
  },
  headerCaret: {
    fontSize: '0.9rem',
  },
  body: {
    padding: '0.75rem 0.9rem',
    maxHeight: '70vh',
    overflowY: 'auto',
  },
  empty: {
    fontSize: '0.75rem',
    color: '#888',
    textAlign: 'center',
    padding: '1.2rem 0',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.5rem 0.6rem',
    fontSize: '0.75rem',
    background: '#fffdf6',
    border: '3px solid #d0c4ae',
    borderRadius: 0,
    color: '#2a2a3a',
  },
  itemActive: {
    background: '#fff3c2',
    borderColor: '#d4a853',
  },
  itemDone: {
    background: '#eae2cf',
    color: '#7a6a44',
  },
  marker: {
    width: '1.2rem',
    textAlign: 'center',
    color: '#b8922e',
    fontSize: '0.9rem',
  },
  title: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  score: {
    padding: '0.2rem 0.5rem',
    background: '#d4a853',
    color: '#1e1e2e',
    fontSize: '0.75rem',
    fontWeight: 'bold',
  },
  linkIcon: {
    textDecoration: 'none',
    fontSize: '0.95rem',
  },
  leaderActions: {
    display: 'flex',
    gap: '0.6rem',
    marginTop: '0.75rem',
    paddingTop: '0.75rem',
    borderTop: '3px solid #e0d6bb',
  },
  actionBtn: {
    flex: 1,
    padding: '0.55rem 0.7rem',
    background: '#2a2a3a',
    color: '#d4a853',
    border: '4px solid #1a1a2a',
    borderRadius: 0,
    cursor: 'pointer',
    fontFamily: pixel,
    fontSize: '0.75rem',
  },
  exportStatus: {
    marginTop: '0.75rem',
    fontSize: '0.75rem',
    color: '#4a7a3a',
    textAlign: 'center',
  },
  editActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.6rem',
    marginTop: '0.9rem',
  },
  cancelBtn: {
    padding: '0.6rem 1rem',
    fontSize: '0.75rem',
    background: 'transparent',
    color: '#888',
    border: '4px solid #d0c4ae',
    borderRadius: 0,
    cursor: 'pointer',
    fontFamily: pixel,
  },
  saveBtn: {
    padding: '0.6rem 1.3rem',
    fontSize: '0.8rem',
    background: '#d4a853',
    color: '#1e1e2e',
    border: '4px solid #b8922e',
    borderRadius: 0,
    cursor: 'pointer',
    fontFamily: pixel,
    boxShadow: '3px 3px 0 #b8922e',
  },
};
