import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskListPanel from './TaskListPanel';

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalClipboard = navigator.clipboard;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob://fake');
  URL.revokeObjectURL = vi.fn();
  // Stub writeText so the export path doesn't throw in jsdom.
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  Object.defineProperty(navigator, 'clipboard', {
    value: originalClipboard,
    configurable: true,
  });
});

const sampleList = {
  activeId: 't2',
  items: {
    t1: { title: 'Login page', url: 'https://j/1', order: 0, score: '5' },
    t2: { title: 'Signup form', url: 'https://j/2', order: 1 },
    t3: { title: 'Password reset', url: null, order: 2 },
  },
};

describe('TaskListPanel — rendering', () => {
  it('renders nothing for non-leader when there are no items', () => {
    const { container } = render(
      <TaskListPanel taskList={null} isLeader={false} />,
    );
    expect(container.querySelector('[data-task-list-panel]')).toBeNull();
  });

  it('renders empty-state for leader with no items', () => {
    const { container } = render(
      <TaskListPanel taskList={null} isLeader={true} />,
    );
    expect(container.querySelector('[data-task-list-panel]')).not.toBeNull();
    expect(container.querySelector('[data-task-panel-empty]')).not.toBeNull();
  });

  it('renders items sorted by order with correct status markers', () => {
    const { container } = render(
      <TaskListPanel taskList={sampleList} isLeader={false} />,
    );
    const items = container.querySelectorAll('[data-task-item]');
    expect(items.length).toBe(3);
    // First rendered is order 0 = t1 (scored)
    expect(items[0].getAttribute('data-task-item-id')).toBe('t1');
    expect(items[0].getAttribute('data-task-item-done')).toBe('true');
    // Second is t2 (active)
    expect(items[1].getAttribute('data-task-item-active')).toBe('true');
    // Third is t3 (pending)
    expect(items[2].getAttribute('data-task-item-id')).toBe('t3');
    expect(items[2].getAttribute('data-task-item-done')).toBe('false');
    expect(items[2].getAttribute('data-task-item-active')).toBe('false');
  });

  it('shows N/M progress in the header', () => {
    const { container } = render(
      <TaskListPanel taskList={sampleList} isLeader={false} />,
    );
    const progress = container.querySelector('[data-task-panel-progress]');
    expect(progress.textContent).toBe('1/3');
  });

  it('renders a safe target=_blank anchor for items with a url', () => {
    const { container } = render(
      <TaskListPanel taskList={sampleList} isLeader={false} />,
    );
    const links = container.querySelectorAll('[data-task-item-link]');
    expect(links.length).toBe(2); // t1 + t2 have urls, t3 does not
    links.forEach((a) => {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });
});

describe('TaskListPanel — leader interactions', () => {
  it('leader clicking a pending item calls onSetActive with its id', () => {
    const onSetActive = vi.fn();
    const { container } = render(
      <TaskListPanel taskList={sampleList} isLeader={true} onSetActive={onSetActive} />,
    );
    const pending = container.querySelector('[data-task-item-id="t3"]');
    fireEvent.click(pending);
    expect(onSetActive).toHaveBeenCalledWith('t3');
  });

  it('clicking the active item does NOT call onSetActive', () => {
    const onSetActive = vi.fn();
    const { container } = render(
      <TaskListPanel taskList={sampleList} isLeader={true} onSetActive={onSetActive} />,
    );
    fireEvent.click(container.querySelector('[data-task-item-id="t2"]'));
    expect(onSetActive).not.toHaveBeenCalled();
  });

  it('clicking a scored item does NOT call onSetActive', () => {
    const onSetActive = vi.fn();
    const { container } = render(
      <TaskListPanel taskList={sampleList} isLeader={true} onSetActive={onSetActive} />,
    );
    fireEvent.click(container.querySelector('[data-task-item-id="t1"]'));
    expect(onSetActive).not.toHaveBeenCalled();
  });

  it('non-leader click on a pending item does NOT call onSetActive', () => {
    const onSetActive = vi.fn();
    const { container } = render(
      <TaskListPanel taskList={sampleList} isLeader={false} onSetActive={onSetActive} />,
    );
    const pending = container.querySelector('[data-task-item-id="t3"]');
    fireEvent.click(pending);
    expect(onSetActive).not.toHaveBeenCalled();
  });

  it('clicking an item link stops propagation (does not change active)', () => {
    const onSetActive = vi.fn();
    const { container } = render(
      <TaskListPanel taskList={sampleList} isLeader={true} onSetActive={onSetActive} />,
    );
    const link = container.querySelector('[data-task-item-id="t2"] [data-task-item-link]');
    fireEvent.click(link);
    expect(onSetActive).not.toHaveBeenCalled();
  });
});

describe('TaskListPanel — edit mode', () => {
  it('leader clicking Edit opens the TaskRowsEditor seeded from current items', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TaskListPanel taskList={sampleList} isLeader={true} onEdit={() => {}} />,
    );
    await user.click(container.querySelector('[data-task-panel-edit-btn]'));
    expect(container.querySelector('[data-task-panel-edit]')).not.toBeNull();
    // Three rows match the three items we seeded.
    expect(container.querySelectorAll('[data-task-row]').length).toBe(3);
  });

  it('Save passes the edited rows (including preserved ids) to onEdit', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn().mockResolvedValue();
    const { container } = render(
      <TaskListPanel taskList={sampleList} isLeader={true} onEdit={onEdit} />,
    );
    await user.click(container.querySelector('[data-task-panel-edit-btn]'));
    // Add a fresh row, then save.
    await user.click(container.querySelector('[data-task-row-add]'));
    const titleInputs = container.querySelectorAll('[data-task-title-input]');
    await user.type(titleInputs[titleInputs.length - 1], 'NEW');
    await user.click(container.querySelector('[data-task-panel-save]'));

    expect(onEdit).toHaveBeenCalledTimes(1);
    const rows = onEdit.mock.calls[0][0];
    // Existing rows preserved with their id
    expect(rows[0]).toMatchObject({ id: 't1', title: 'Login page' });
    expect(rows[1]).toMatchObject({ id: 't2', title: 'Signup form' });
    expect(rows[2]).toMatchObject({ id: 't3', title: 'Password reset' });
    // New row has no id (so upsertTasks will mint one)
    expect(rows[3]).toMatchObject({ title: 'NEW' });
    expect(rows[3].id).toBeUndefined();
  });

  it('Cancel returns to the list without calling onEdit', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const { container, getByText } = render(
      <TaskListPanel taskList={sampleList} isLeader={true} onEdit={onEdit} />,
    );
    await user.click(container.querySelector('[data-task-panel-edit-btn]'));
    await user.click(getByText('Cancel'));
    expect(onEdit).not.toHaveBeenCalled();
    expect(container.querySelector('[data-task-panel-list]')).not.toBeNull();
  });
});

describe('TaskListPanel — export', () => {
  it('clicking Export triggers a download and shows a success message', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TaskListPanel taskList={sampleList} isLeader={true} roomCode="ABC123" />,
    );
    await user.click(container.querySelector('[data-task-panel-export]'));

    expect(URL.createObjectURL).toHaveBeenCalled();
    await waitFor(() =>
      expect(container.querySelector('[data-task-panel-export-status]')).not.toBeNull(),
    );
  });

  it('Export button is hidden for non-leaders', () => {
    const { container } = render(
      <TaskListPanel taskList={sampleList} isLeader={false} />,
    );
    expect(container.querySelector('[data-task-panel-export]')).toBeNull();
  });
});
