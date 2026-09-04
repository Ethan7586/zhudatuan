import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InvitationReceipt } from '../model/Invitation';
import { InvitationReceiptDialog } from './InvitationReceiptDialog';

afterEach(cleanup);

describe('InvitationReceiptDialog', () => {
  it('copies only the raw one-time code and requires confirmation before clearing it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const discard = vi.fn();
    const view = render(<InvitationReceiptDialog receipt={receipt} organization="示例企业" onDiscard={discard} />);

    expect(screen.getByLabelText('一次性邀请码').textContent).toBe('ABCD EFGH IJKL MNOP QRST UVWX YZ12 3456');
    fireEvent.click(screen.getByRole('button', { name: '复制邀请码' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(receipt.code));
    expect(screen.getByRole('button', { name: '已复制邀请码' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '完成并关闭' }));
    expect(screen.getByRole('alert').textContent).toContain('无法再次查看或恢复');
    fireEvent.click(screen.getByRole('button', { name: '关闭并清除' }));
    expect(discard).toHaveBeenCalledOnce();

    view.rerender(<InvitationReceiptDialog organization="示例企业" onDiscard={discard} />);
    expect(screen.queryByLabelText('一次性邀请码')).toBeNull();
  });

  it('offers a manual-copy fallback without discarding the receipt', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    render(<InvitationReceiptDialog receipt={receipt} organization="示例企业" onDiscard={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '复制邀请码' }));
    expect((await screen.findByRole('alert')).textContent).toContain('请选中邀请码手动复制');
    expect(screen.getByLabelText('一次性邀请码')).toBeTruthy();
  });
});

const receipt: InvitationReceipt = {
  id: 'invitation:one',
  kind: 'enrollment',
  target: 'storefront',
  status: 'active',
  code: 'ABCD EFGH IJKL MNOP QRST UVWX YZ12 3456',
  organizationId: 'enterprise:one',
  recipientMasked: '138****8000',
  employee: { displayName: '张三', employeeNo: 'E001' },
  maxUses: 1,
  useCount: 0,
  expiresAt: '2099-09-09T00:00:00.000Z',
  version: 1,
};
