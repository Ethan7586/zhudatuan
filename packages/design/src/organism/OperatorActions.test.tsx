// @vitest-environment jsdom

import { actionField } from '@shop/presentation/actions';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OperatorActions } from './OperatorActions';

const action = Object.freeze({ id: 'ship', label: '确认发货', description: '录入物流单号。', tone: 'primary', fields: Object.freeze([actionField('tracking', '物流单号', { kind: 'scan' })]) } as const);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('OperatorActions', () => {
  it('supports scanner-keyboard input and submits only after server confirmation', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    const execute = vi.fn().mockResolvedValue({ message: '服务端已确认发货。' });
    const user = userEvent.setup();
    render(<OperatorActions actions={[action]} execute={execute} />);

    await user.click(screen.getByRole('button', { name: /确认发货/ }));
    await user.type(screen.getByLabelText('物流单号（必填）'), 'SF123456');
    await user.click(screen.getByRole('button', { name: '确认确认发货' }));

    await waitFor(() => expect(execute).toHaveBeenCalledWith(action, { tracking: 'SF123456' }));
    expect(await screen.findByText('服务端已确认发货。')).toBeTruthy();
  });

  it('never calls a command or shows success while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const execute = vi.fn();
    const user = userEvent.setup();
    render(<OperatorActions actions={[action]} execute={execute} />);

    await user.click(screen.getByRole('button', { name: /确认发货/ }));
    await user.type(screen.getByLabelText('物流单号（必填）'), 'SF123456');
    await user.click(screen.getByRole('button', { name: '确认确认发货' }));

    expect((await screen.findByRole('alert')).textContent).toContain('网络不可用，操作尚未提交');
    expect(execute).not.toHaveBeenCalled();
  });

  it('explains the scanner fallback when camera scanning is unavailable', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    const user = userEvent.setup();
    render(<OperatorActions actions={[action]} execute={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /确认发货/ }));
    await user.click(screen.getByRole('button', { name: '相机扫码' }));
    expect((await screen.findByRole('alert')).textContent).toContain('请使用扫码枪或键盘输入');
  });
});
