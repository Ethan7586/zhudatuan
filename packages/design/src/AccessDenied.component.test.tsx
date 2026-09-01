// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessDenied } from './AccessDenied';

afterEach(cleanup);

describe('AccessDenied', () => {
  it('renders forbidden content as a dark, non-interactive surface', () => {
    render(<AccessDenied resourceLabel="资格管理" actions={{ onReturnToWorkspace: vi.fn(), onRelogin: vi.fn() }} />);

    const surface = screen.getByRole('region', { name: '没有权限' });
    expect(surface.classList.contains('swaccessdeniedforbidden')).toBe(true);
    expect(screen.getByText('「资格管理」不可访问')).toBeTruthy();
    expect(surface.querySelector('svg')).toBeNull();
    expect(within(surface).queryByRole('button')).toBeNull();
    expect(screen.queryByText('申请访问权限')).toBeNull();
    expect(screen.queryByText(/CONTRACT_RESPONSE_INVALID|请求 [0-9a-f-]{20,}/)).toBeNull();
  });

  it('renders a contextual explanation when the caller provides one', () => {
    render(<AccessDenied resourceLabel="经营驾驶舱" description="账号已登录，等待管理员授权。" />);

    expect(screen.getByRole('region', { name: '没有权限' })).toBeTruthy();
    expect(screen.getByText('账号已登录，等待管理员授权。')).toBeTruthy();
    expect(screen.queryByText('「经营驾驶舱」不可访问')).toBeNull();
  });

  it('keeps the login recovery action for an expired session', async () => {
    const user = userEvent.setup();
    const onRelogin = vi.fn();
    render(<AccessDenied kind="unauthenticated" resourceLabel="资格管理" actions={{ onRelogin }} />);

    expect(screen.getByRole('heading', { name: '登录已失效' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '重新登录' }));
    expect(onRelogin).toHaveBeenCalledTimes(1);
  });
});
