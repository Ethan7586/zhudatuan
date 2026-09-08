// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupportComposer } from './SupportComposer';

afterEach(cleanup);

describe('SupportComposer', () => {
  it('lets the user remove a rejected attachment and recover the composer', () => {
    const remove = vi.fn();
    render(<SupportComposer value="" unavailable="" sending={false} uploading={false} failed={false} attachments={[{ id: 'evidence:1', name: '问题截图.png', state: 'rejected' }]} onChange={vi.fn()} onSend={vi.fn()} onRetry={vi.fn()} onFile={vi.fn()} onRemove={remove} />);
    expect((screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '移除附件问题截图.png' }));
    expect(remove).toHaveBeenCalledWith('evidence:1');
  });
});
