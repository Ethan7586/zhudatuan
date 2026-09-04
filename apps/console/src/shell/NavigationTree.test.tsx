import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleNavigationNode } from '../entity/session/ConsoleSession';
import { NavigationTree } from './NavigationTree';

afterEach(cleanup);

describe('server-driven navigation tree', () => {
  it('renders server order, labels, disabled state and routes', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <NavigationTree
        active="experience"
        collapsed={false}
        displayName="商城管理员"
        roleLabel="当前范围"
        nodes={[
          node('groupapplication', '築店 · 商城管理', 'application', 'consoleexperience', '/scopes/:scopeKind/:scopeId/experience', 'experience', 10),
          node('groupproduct', '商品治理台', 'product', 'consoleproducts', '/scopes/:scopeKind/:scopeId/products', 'product', 20),
          node('groupreferral', '分销返佣系统', 'referral', 'consolereferral', '/scopes/:scopeKind/:scopeId/referral', 'referral', 25),
          node('groupreporting', '数据报表', 'report', 'consolereporting', '/scopes/:scopeKind/:scopeId/reporting', 'reporting', 30, true),
          node('groupsupport', '客服系统', 'support', 'consolesupport', '/scopes/:scopeKind/:scopeId/support', 'support', 40),
        ]}
        onNavigate={onNavigate}
        onToggle={vi.fn()}
      />
    );
    const navigation = screen.getByRole('navigation', { name: '工作台与治理系统' });
    const labels = within(navigation)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(labels).toEqual(['築店 · 商城管理', '商品治理台', '分销返佣系统', '数据报表', '客服系统']);
    expect(screen.getByRole('button', { name: '数据报表' }).getAttribute('disabled')).not.toBeNull();
    expect(screen.getByText('当前范围暂无可用功能')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: '築店 · 商城管理' }));
    expect(onNavigate).toHaveBeenCalledWith('/scopes/:scopeKind/:scopeId/experience');
  });

  it('expands only the active branch and marks the exact active page', () => {
    const members = node('groupmembers', '成员管理', 'member', 'consolemembers', '/scopes/:scopeKind/:scopeId/settings/members', 'member', 10, false, 'groupsettings', 'secondary');
    const notices = node('groupmessage', '通知管理', 'notification', 'consolenotifications', '/scopes/:scopeKind/:scopeId/settings/messages', 'notification', 20, false, 'groupsettings', 'secondary');
    const settings = node('groupsettings', '设置', 'settings', 'consolesettings', '/scopes/:scopeKind/:scopeId/settings', 'settings', 90, false, null, 'secondary', [members, notices]);
    const productChild = node('productdetail', '商品详情', 'product', 'consoleproductdetail', '/scopes/:scopeKind/:scopeId/products/:productId', 'product', 10, false, 'groupproduct', 'secondary');
    const product = node('groupproduct', '商品治理台', 'product', 'consoleproducts', '/scopes/:scopeKind/:scopeId/products', 'product', 20, false, null, 'primary', [productChild]);

    render(<NavigationTree active="groupmembers" collapsed={false} displayName="商城管理员" roleLabel="集团 · 鸿泰" nodes={[product, settings]} onNavigate={vi.fn()} onToggle={vi.fn()} />);

    expect(screen.getByRole('button', { name: '设置' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: '成员管理' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: '商品治理台' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: '商品详情' })).toBeNull();
  });
});

function node(
  key: string,
  title: string,
  icon: string,
  routeKey: string,
  route: string,
  component: string,
  order: number,
  disabled = false,
  parent: string | null = null,
  placement: 'primary' | 'secondary' | 'contextual' = 'primary',
  children: readonly ConsoleNavigationNode[] = []
): ConsoleNavigationNode {
  return {
    key,
    title,
    parent,
    order,
    operation: 'navigation.test.read',
    experience: { icon, routeKey, route, component, placement, disabled, disabledReason: disabled ? '当前范围暂无可用功能' : null, breadcrumbs: [...(parent === null ? [] : [{ key: parent, title: '父级' }]), { key, title }] },
    children,
  };
}
