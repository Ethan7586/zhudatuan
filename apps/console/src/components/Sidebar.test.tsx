import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleScope } from '../entity/session/ConsoleSession';
import { selectConsoleNavigationItems } from '../entity/navigation/ConsoleNavigation';
import type { ConsoleModuleManifest } from '../entity/navigation/ConsoleModuleManifest';
import { consoleModules } from '../route/ConsoleModuleRegistry';
import { Sidebar } from './Sidebar';

const navigationCss = readFileSync('src/shell/navigation.css', 'utf8');

afterEach(cleanup);

describe('Sidebar commerce navigation', () => {
  it('keeps merchant governance out of ordinary navigation and places commerce before products', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderSidebar('enterprise', false, onNavigate);
    const navigation = screen.getByRole('navigation', { name: '工作台与治理系统' });
    const labels = within(navigation).getAllByRole('button').map((button) => button.getAttribute('aria-label'));
    expect(labels).not.toContain('商家管理');
    expect(labels.indexOf('商城管理')).toBeLessThan(labels.indexOf('商品治理台'));

    await user.click(screen.getByRole('button', { name: '商城管理' }));
    expect(onNavigate).toHaveBeenCalledWith('applications');
  });

  it.each([
    ['platform', '商城管理'],
    ['distributor', '应用治理'],
    ['tenant', '应用治理'],
    ['enterprise', '商城管理'],
    ['mall', '店铺装修'],
  ] as const)('uses %s scope navigation label %s', (kind, expected) => {
    renderSidebar(kind, true, vi.fn());
    const target = screen.getByRole('button', { name: expected });
    expect(target.getAttribute('title')).toBe(expected);
  });

  it('opens the referral workspace independently from B2B channels', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderSidebar('mall', false, onNavigate);

    await user.click(screen.getByRole('button', { name: '分销返佣系统' }));
    expect(onNavigate).toHaveBeenCalledWith('referral/settings');
    expect(screen.getByRole('button', { name: '渠道接入系统' })).toBeTruthy();
  });

  it('keeps all 11 ordinary main items in order, then profile, then bottom support', () => {
    const { container } = renderSidebar('enterprise', false, vi.fn());
    const primaryNavigation = screen.getByRole('navigation', { name: '工作台与治理系统' });
    const labels = within(primaryNavigation).getAllByRole('button').map((button) => button.getAttribute('aria-label'));
    const profile = container.querySelector('.sidebarprofile');
    const supportNavigation = screen.getByRole('navigation', { name: '客服系统' });

    expect(labels).toEqual([
      '经营驾驶舱', '数据报表', '商城管理', '商品治理台', '订单管理系统', '分销返佣系统',
      '渠道接入系统', '卡券治理台', '财务与对账台', '会员与权限', '系统治理台',
    ]);
    expect(primaryNavigation.nextElementSibling).toBe(profile);
    expect(profile?.nextElementSibling).toBe(supportNavigation);
  });

  it('opens the personal center from the profile control and marks it active', async () => {
    const user = userEvent.setup();
    const onOpenProfile = vi.fn();
    renderSidebar('enterprise', false, vi.fn(), consoleModules, onOpenProfile, 'profile');

    const profile = screen.getByRole('button', { name: '个人中心：商城管理员' });
    expect(profile.getAttribute('aria-current')).toBe('page');
    await user.click(profile);
    expect(onOpenProfile).toHaveBeenCalledOnce();
  });

  it('keeps disabled navigation visible and clickable without native disabling', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderSidebar('enterprise', false, onNavigate, withStatus('products', 'disabled'));
    const target = screen.getByRole('button', { name: '商品治理台（已停用）' });

    expect(target.getAttribute('data-status')).toBe('disabled');
    expect(target.getAttribute('aria-disabled')).toBe('true');
    expect(target.hasAttribute('disabled')).toBe(false);
    await user.click(target);
    expect(onNavigate).toHaveBeenCalledWith('products');
  });

  it.each([false, true])('keeps the profile above bottom-pinned customer service when collapsed=%s', async (collapsed) => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const { container } = renderSidebar('mall', collapsed, onNavigate);
    const primaryNavigation = screen.getByRole('navigation', { name: '工作台与治理系统' });
    const supportNavigation = screen.getByRole('navigation', { name: '客服系统' });
    const supportButton = within(supportNavigation).getByRole('button', { name: '客服系统' });
    const profile = container.querySelector('.sidebarprofile');

    expect(profile).toBeInstanceOf(HTMLElement);
    expect(primaryNavigation.nextElementSibling).toBe(profile);
    expect(profile?.nextElementSibling).toBe(supportNavigation);
    expect(navigationCss).toMatch(/\.sidebarnavigation\s*\{[^}]*flex:\s*0 1 auto;/);
    expect(navigationCss).toMatch(/\.sidebarsupport\s*\{[^}]*margin-top:\s*auto;/);
    expect(navigationCss).toMatch(/\.consolesidebar > \.sidebarprofile\s*\{[^}]*margin-top:\s*0;/);
    expect(supportButton.getAttribute('title')).toBe(collapsed ? '客服系统' : null);
    await user.click(supportButton);
    expect(onNavigate).toHaveBeenCalledWith('support');
  });

  it('does not import legacy route catalogs, workstations, or feature modules', () => {
    const source = readFileSync('src/components/Sidebar.tsx', 'utf8');
    expect(source).not.toMatch(/ProfessionalRouteCatalog|Workstation|\.\.\/feature\//);
  });
});

function renderSidebar(
  kind: ConsoleScope['kind'],
  collapsed: boolean,
  onNavigate: (suffix: string) => void,
  modules: readonly ConsoleModuleManifest[] = consoleModules,
  onOpenProfile = vi.fn(),
  active = 'applications',
) {
  const items = selectConsoleNavigationItems(modules, kind);
  return render(<div className="consolelayout" data-visual-theme="admin-web-v1">
    <Sidebar active={active} collapsed={collapsed} displayName="商城管理员" roleLabel="当前范围"
      mainItems={items.filter(({ placement }) => placement === 'main')}
      bottomItems={items.filter(({ placement }) => placement === 'bottom')}
      onNavigate={onNavigate} onOpenProfile={onOpenProfile} onToggle={vi.fn()} />
  </div>);
}

function withStatus(
  moduleId: ConsoleModuleManifest['id'],
  status: ConsoleModuleManifest['status'],
): readonly ConsoleModuleManifest[] {
  return consoleModules.map((module) => module.id === moduleId ? { ...module, status } : module);
}
