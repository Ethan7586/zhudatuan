import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Header, type HeaderProps } from './Header';

afterEach(cleanup);

describe('Header secondary verification', () => {
  it('opens secondary verification for a base session', () => {
    const onStepup = vi.fn();
    render(<Header {...props({ assuranceLevel: 2, onStepup })} />);
    fireEvent.click(screen.getByLabelText('打开 测试用户 的账户菜单'));
    fireEvent.click(screen.getByRole('button', { name: '开启二次验证' }));
    expect(onStepup).toHaveBeenCalledExactlyOnceWith();
  });

  it('closes an elevated session', () => {
    const onDisableStepup = vi.fn();
    render(<Header {...props({ assuranceLevel: 3, onDisableStepup })} />);
    fireEvent.click(screen.getByLabelText('打开 测试用户 的账户菜单'));
    fireEvent.click(screen.getByRole('button', { name: '关闭二次验证' }));
    expect(onDisableStepup).toHaveBeenCalledExactlyOnceWith();
  });

  it('searches only projected navigation destinations and opens the selected page', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<Header {...props({ onNavigate })} />);

    await user.click(screen.getByRole('button', { name: '搜索已授权页面' }));
    await user.type(screen.getByRole('searchbox'), '订单');

    expect(screen.getByRole('status').textContent).toBe('找到 1 个页面');
    await user.click(screen.getByRole('button', { name: /订单与售后/ }));
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith('/scopes/:scopeKind/:scopeId/orders');
  });

  it('opens real notification and support destinations', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<Header {...props({ onNavigate })} />);

    await user.click(screen.getByRole('button', { name: '打开通知管理' }));
    await user.click(screen.getByRole('button', { name: '打开客服系统' }));

    expect(onNavigate.mock.calls).toEqual([['/scopes/:scopeKind/:scopeId/settings/messages'], ['/scopes/:scopeKind/:scopeId/support']]);
    expect(screen.queryByText('最新运行状态已同步。')).toBeNull();
  });
});

function props(overrides: Partial<HeaderProps> = {}): HeaderProps {
  return {
    title: '控制台',
    summary: '已授权工作区',
    scopeLabel: '集团 · 测试集团',
    displayName: '测试用户',
    assuranceLevel: 2,
    syncedAt: '2026-09-01T00:00:00Z',
    loggingOut: false,
    disablingStepup: false,
    taskCenter: <span />,
    destinations: [
      { key: 'orders', title: '订单与售后', detail: '交易履约 › 订单与售后', route: '/scopes/:scopeKind/:scopeId/orders', icon: 'orders', component: 'order' },
      { key: 'members', title: '成员管理', detail: '会员与权限 › 成员管理', route: '/scopes/:scopeKind/:scopeId/settings/members', icon: 'member', component: 'member' },
    ],
    notification: { key: 'notification', title: '通知管理', detail: '系统治理 › 通知管理', route: '/scopes/:scopeKind/:scopeId/settings/messages', icon: 'notification', component: 'notification' },
    support: { key: 'support', title: '客服系统', detail: '服务 › 客服系统', route: '/scopes/:scopeKind/:scopeId/support', icon: 'support', component: 'support' },
    onStepup: vi.fn(),
    onDisableStepup: vi.fn(),
    onLogout: vi.fn(),
    onNavigate: vi.fn(),
    onOpenNavigation: vi.fn(),
    ...overrides,
  };
}
