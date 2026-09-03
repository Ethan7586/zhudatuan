// @vitest-environment jsdom

import { useRef, useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

afterEach(cleanup);

describe('Dialog', () => {
  it('provides a described modal, initial focus and trigger focus restoration', async () => {
    const user = userEvent.setup();
    const closed = vi.fn();
    render(<DialogHarness onClose={closed} />);

    const trigger = screen.getByRole('button', { name: '打开确认框' });
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: '确认操作', description: '请核对后继续。' });
    const description = screen.getByText('请核对后继续。');
    expect(dialog.getAttribute('aria-describedby')).toBe(description.id);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '确认' })));

    await user.click(screen.getByRole('button', { name: '关闭' }));
    await waitFor(() => expect(document.body.contains(dialog)).toBe(false));
    expect(closed).toHaveBeenCalledOnce();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('disables close and Escape dismissal for a required decision', async () => {
    const user = userEvent.setup();
    const closed = vi.fn();
    render(<DialogHarness dismissable={false} onClose={closed} />);

    await user.click(screen.getByRole('button', { name: '打开确认框' }));
    expect(await screen.findByRole('dialog', { name: '确认操作' })).toBeTruthy();
    expect((screen.getByRole('button', { name: '关闭' }) as HTMLButtonElement).disabled).toBe(true);

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: '确认操作' })).toBeTruthy();
    expect(closed).not.toHaveBeenCalled();
  });
});

function DialogHarness({ dismissable = true, onClose }: Readonly<{ dismissable?: boolean; onClose: () => void }>) {
  const [open, setOpen] = useState(false);
  const initialFocus = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        打开确认框
      </button>
      <Dialog
        open={open}
        title="确认操作"
        description="请核对后继续。"
        dismissable={dismissable}
        initialFocus={initialFocus}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
      >
        <button ref={initialFocus} type="button">
          确认
        </button>
      </Dialog>
    </>
  );
}
