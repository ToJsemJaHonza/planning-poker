import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import TaskBar from './TaskBar';

describe('TaskBar — legacy free-text mode', () => {
  it('renders the task text when no list is active', () => {
    const { container } = render(
      <TaskBar task="Write RFC" canControl={false} phase="voting" onSave={() => {}} />,
    );
    expect(container.textContent).toContain('Write RFC');
    expect(container.querySelector('[data-task-list-mode]')).toBeNull();
  });

  it('leader can click to edit free-text task', () => {
    const onSave = vi.fn();
    const { container } = render(
      <TaskBar task="" canControl={true} phase="voting" onSave={onSave} />,
    );
    fireEvent.click(container.querySelector('[data-task-display]'));
    const input = container.querySelector('[data-task-input]');
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: 'New task' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith('New task');
  });
});

describe('TaskBar — list mode (horizontal strip)', () => {
  const taskList = {
    activeId: 't2',
    items: {
      t1: { title: 'Login page', url: 'https://jira/1', order: 0, score: '5' },
      t2: { title: 'Signup', url: 'https://jira/2', order: 1 },
      t3: { title: 'Dashboard', url: null, order: 2 },
    },
  };

  it('renders one chip per backlog item, ordered by `order`', () => {
    const { container } = render(
      <TaskBar
        task="Signup"
        canControl={true}
        phase="voting"
        onSave={() => {}}
        taskList={taskList}
      />,
    );
    expect(container.querySelector('[data-task-list-mode]')).not.toBeNull();
    const chips = container.querySelectorAll('[data-task-chip]');
    expect(chips.length).toBe(3);
    // Chip text order matches the `order` field.
    const titles = Array.from(chips).map((c) => c.textContent);
    expect(titles[0]).toContain('Login page');
    expect(titles[1]).toContain('Signup');
    expect(titles[2]).toContain('Dashboard');
  });

  it('marks the active item with data-task-chip-active="true"', () => {
    const { container } = render(
      <TaskBar task="Signup" canControl={false} phase="voting" onSave={() => {}} taskList={taskList} />,
    );
    const active = container.querySelectorAll('[data-task-chip-active="true"]');
    expect(active.length).toBe(1);
    expect(active[0].getAttribute('data-task-chip-id')).toBe('t2');
    expect(active[0].textContent).toContain('Signup');
  });

  it('shows scores on done items (normal + split)', () => {
    const splitList = {
      activeId: 't3',
      items: {
        t1: { title: 'Simple', order: 0, score: '8' },
        t2: { title: 'Split', order: 1, scoreFe: '3', scoreBe: '5' },
        t3: { title: 'Active', order: 2 },
      },
    };
    const { container } = render(
      <TaskBar task="Active" canControl={false} phase="voting" onSave={() => {}} taskList={splitList} />,
    );
    const scores = Array.from(container.querySelectorAll('[data-task-chip-score]')).map((el) => el.textContent);
    expect(scores).toContain('8');
    expect(scores).toContain('3/5');
    // The active chip has no score yet → only 2 score badges rendered.
    expect(scores.length).toBe(2);
  });

  it('wraps the title in a safe anchor for every item that has a url', () => {
    const { container } = render(
      <TaskBar task="Signup" canControl={false} phase="voting" onSave={() => {}} taskList={taskList} />,
    );
    const links = container.querySelectorAll('[data-task-link]');
    // t1 and t2 have urls (t3 is url-less), so exactly 2 title links.
    expect(links.length).toBe(2);
    const hrefs = Array.from(links).map((a) => a.getAttribute('href')).sort();
    expect(hrefs).toEqual(['https://jira/1', 'https://jira/2']);
    links.forEach((a) => {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
      // The clickable title carries the visible task name.
      expect(a.textContent).toMatch(/Login page|Signup/);
      // Underline is the only visual affordance for clickability.
      expect(a.style.textDecoration).toContain('underline');
    });
  });

  it('renders the title as a plain span (no underline) when there is no url', () => {
    const { container } = render(
      <TaskBar task="Dashboard" canControl={false} phase="voting" onSave={() => {}} taskList={taskList} />,
    );
    // t3 has no url — its chip should not contain an anchor.
    const t3 = container.querySelector('[data-task-chip-id="t3"]');
    expect(t3).not.toBeNull();
    expect(t3.querySelector('[data-task-link]')).toBeNull();
    expect(t3.textContent).toContain('Dashboard');
  });

  it('does not render any link when no item has a url', () => {
    const noUrls = {
      activeId: 'a',
      items: {
        a: { title: 'Alpha', order: 0 },
        b: { title: 'Beta', order: 1 },
      },
    };
    const { container } = render(
      <TaskBar task="Alpha" canControl={false} phase="voting" onSave={() => {}} taskList={noUrls} />,
    );
    expect(container.querySelectorAll('[data-task-link]').length).toBe(0);
  });

  it('does NOT open free-text edit mode in list mode', () => {
    const onSave = vi.fn();
    const { container } = render(
      <TaskBar task="Signup" canControl={true} phase="voting" onSave={onSave} taskList={taskList} />,
    );
    // Clicking the bar (or a chip) must not open the legacy inline edit input.
    fireEvent.click(container.firstChild);
    expect(container.querySelector('[data-task-input]')).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('renders the strip even without an active item (pre-grooming state)', () => {
    const preGroom = {
      activeId: null,
      items: {
        t1: { title: 'A', order: 0 },
        t2: { title: 'B', order: 1 },
      },
    };
    const { container } = render(
      <TaskBar task="" canControl={false} phase="voting" onSave={() => {}} taskList={preGroom} />,
    );
    expect(container.querySelector('[data-task-list-mode]')).not.toBeNull();
    expect(container.querySelectorAll('[data-task-chip]').length).toBe(2);
    expect(container.querySelectorAll('[data-task-chip-active="true"]').length).toBe(0);
  });

  it('falls back to legacy mode when taskList has no items', () => {
    const emptyList = { activeId: null, items: {} };
    const { container } = render(
      <TaskBar task="Legacy" canControl={false} phase="voting" onSave={() => {}} taskList={emptyList} />,
    );
    expect(container.querySelector('[data-task-list-mode]')).toBeNull();
    expect(container.textContent).toContain('Legacy');
  });
});
