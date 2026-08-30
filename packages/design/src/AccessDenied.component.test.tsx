// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessDenied } from './AccessDenied';

afterEach(cleanup);

describe('AccessDenied', () => {
  it('presents a calm permission request without technical diagnostics', async () => {
    const user = userEvent.setup();
    render(<AccessDenied resourceLabel="资格管理" actions={{ onReturnToWorkspace: vi.fn(), onRelogin: vi.fn() }} />);

    expect(screen.getByRole('heading', { name: '需要访问权限' })).toBeTruthy();
    expect(screen.queryByText(/CONTRACT_RESPONSE_INVALID|请求 [0-9a-f-]{20,}/)).toBeNull();
    expect(screen.queryByRole('button', { name: '重新登录' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '申请访问权限' }));
    expect(screen.getByRole('status').textContent).toContain('资格管理');
    expect(screen.getByRole('status').textContent).toContain('不会自动提交申请');
  });
});
