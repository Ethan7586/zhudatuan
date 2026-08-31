import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
          { id: 'groupapplication', title: '築店 · 商城管理', icon: 'application', route: '/scopes/:scopeKind/:scopeId/experience', component: 'experience', order: 10, entry: 'experience.applications.read', disabled: false, children: [] },
          { id: 'groupproduct', title: '商品治理台', icon: 'product', route: '/scopes/:scopeKind/:scopeId/products', component: 'product', order: 20, entry: 'catalog.pools.read', disabled: false, children: [] },
          { id: 'groupreferral', title: '分销返佣系统', icon: 'referral', route: '/scopes/:scopeKind/:scopeId/referral', component: 'referral', order: 25, entry: 'referral.settings.read', disabled: false, children: [] },
          { id: 'groupreporting', title: '数据报表', icon: 'report', route: '/scopes/:scopeKind/:scopeId/reporting', component: 'reporting', order: 30, entry: 'reporting.sales.read', disabled: true, children: [] },
          { id: 'groupsupport', title: '客服系统', icon: 'support', route: '/scopes/:scopeKind/:scopeId/support', component: 'support', order: 40, entry: 'support.cases.read', disabled: false, children: [] },
        ]}
        onNavigate={onNavigate}
        onToggle={vi.fn()}
      />
    );
    const navigation = screen.getByRole('navigation', { name: '工作台与治理系统' });
    const labels = within(navigation)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(labels).toEqual(['築店 · 商城管理', '商品治理台', '分销返佣系统', '数据报表']);
    const support = screen.getByRole('navigation', { name: '客服系统' });
    expect(support.classList.contains('sidebarnavigation')).toBe(true);
    expect(within(support).getByRole('button', { name: '客服系统' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '数据报表' }).getAttribute('disabled')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: '築店 · 商城管理' }));
    expect(onNavigate).toHaveBeenCalledWith('/scopes/:scopeKind/:scopeId/experience');
  });
});
