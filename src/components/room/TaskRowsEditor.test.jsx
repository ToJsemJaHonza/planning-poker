import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import TaskRowsEditor from './TaskRowsEditor';

// Tiny wrapper that owns the rows state so we can assert realistic
// controlled-input behavior without reimplementing the editor.
function Harness({ initial = [{ title: '', url: '' }], onSpy }) {
  const [rows, setRows] = useState(initial);
  return (
    <TaskRowsEditor
      rows={rows}
      onChange={(next) => {
        setRows(next);
        onSpy?.(next);
      }}
    />
  );
}

describe('TaskRowsEditor', () => {
  it('renders one input pair per row', () => {
    const { container } = render(
      <Harness initial={[{ title: 'A', url: 'https://a' }, { title: 'B', url: '' }]} />,
    );
    expect(container.querySelectorAll('[data-task-row]').length).toBe(2);
    expect(container.querySelectorAll('[data-task-title-input]').length).toBe(2);
    expect(container.querySelectorAll('[data-task-url-input]').length).toBe(2);
  });

  it('typing in a title input updates the controlled state', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    const { container } = render(<Harness onSpy={spy} />);
    const titleInput = container.querySelector('[data-task-title-input]');

    await user.type(titleInput, 'hello');
    // Last call reflects the latest controlled rows
    const last = spy.mock.calls.at(-1)[0];
    expect(last[0].title).toBe('hello');
  });

  it('clicking + Add row appends a new empty row', () => {
    const { container } = render(<Harness />);
    expect(container.querySelectorAll('[data-task-row]').length).toBe(1);
    fireEvent.click(container.querySelector('[data-task-row-add]'));
    expect(container.querySelectorAll('[data-task-row]').length).toBe(2);
  });

  it('pressing Enter in the last URL field appends a new row', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const urlInput = container.querySelector('[data-task-url-input]');
    await user.click(urlInput);
    await user.keyboard('{Enter}');
    expect(container.querySelectorAll('[data-task-row]').length).toBe(2);
  });

  it('does NOT append a row when Enter is pressed in a non-last URL field', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Harness initial={[{ title: 'A', url: '' }, { title: 'B', url: '' }]} />,
    );
    const firstUrlInput = container.querySelectorAll('[data-task-url-input]')[0];
    await user.click(firstUrlInput);
    await user.keyboard('{Enter}');
    expect(container.querySelectorAll('[data-task-row]').length).toBe(2);
  });

  it('✕ removes a row when more than one is present', () => {
    const { container } = render(
      <Harness initial={[{ title: 'A', url: '' }, { title: 'B', url: '' }]} />,
    );
    fireEvent.click(container.querySelectorAll('[data-task-row-remove]')[0]);
    expect(container.querySelectorAll('[data-task-row]').length).toBe(1);
  });

  it('✕ on the only row clears it instead of leaving the list empty', () => {
    const spy = vi.fn();
    const { container } = render(
      <Harness initial={[{ title: 'A', url: 'https://x' }]} onSpy={spy} />,
    );
    fireEvent.click(container.querySelector('[data-task-row-remove]'));
    expect(container.querySelectorAll('[data-task-row]').length).toBe(1);
    const last = spy.mock.calls.at(-1)[0];
    expect(last).toEqual([{ title: '', url: '' }]);
  });
});
