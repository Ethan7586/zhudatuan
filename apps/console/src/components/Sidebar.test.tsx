import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleScope } from '../entity/session/ConsoleSession';
import { navigationAccessRequirements } from '../route/NavigationAccess';
import { professionalRoutes } from '../route/ProfessionalRouteCatalog';
import { workstations } from '../shell/Workstation';
import { Sidebar } from './Sidebar';

const navigationCss = readFileSync('src/shell/navigation.css', 'utf8');

afterEach(cleanup);

describe('Sidebar commerce navigation', () => {
  it('places commerce after control and before products', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderSidebar('enterprise', false, onNavigate);
    const navigation = screen.getByRole('navigation', { name: '工作台与治理系统' });
    const labels = within(navigation).getAllByRole('button').map((button) => button.getAttribute('aria-label'));
    expect(labels.indexOf('智慧翼中控台')).toBeLessThan(labels.indexOf('築店 · 商城管理'));
    expect(labels.indexOf('築店 · 商城管理')).toBeLessThan(labels.indexOf('商品治理台'));

    await user.click(screen.getByRole('button', { name: '築店 · 商城管理' }));
    expect(onNavigate).toHaveBeenCalledWith('applications');
  });

  it.each([
    ['platform', '築店 · 应用治理'],
    ['distributor', '築店 · 应用治理'],
    ['tenant', '築店 · 应用治理'],
    ['enterprise', '築店 · 商城管理'],
    ['mall', '築店 · 店铺装修'],
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

  it('darkens unavailable systems and prevents navigation', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderSidebar('mall', false, onNavigate, {
      permissions: ['referral.settings.read'],
      capabilities: ['referral.settings.read'],
    });

    const unavailable = screen.getByRole('button', { name: '渠道接入系统，没有权限' });
    expect(unavailable.hasAttribute('disabled')).toBe(true);
    expect(unavailable.getAttribute('aria-disabled')).toBe('true');
    expect(within(unavailable).getByText('没有权限')).toBeTruthy();
    await user.click(unavailable);
    expect(onNavigate).not.toHaveBeenCalled();

    const referral = screen.getByRole('button', { name: '分销返佣系统' });
    expect(referral.hasAttribute('disabled')).toBe(false);
  });

  it('exposes reporting and notification routes from the primary navigation', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderSidebar('platform', false, onNavigate);

    await user.click(screen.getByRole('button', { name: '数据报表' }));
    await user.click(screen.getByRole('button', { name: '通知管理' }));
    expect(onNavigate).toHaveBeenNthCalledWith(1, 'reports');
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'settings/notification');
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
});

const allPermissions = [...new Set(Object.values(navigationAccessRequirements).flatMap((requirements) =>
  requirements.map(({ permission }) => permission)))];
const allCapabilities = [...new Set(Object.values(navigationAccessRequirements).flatMap((requirements) =>
  requirements.map(({ capability }) => capability)))];

function renderSidebar(
  kind: ConsoleScope['kind'],
  collapsed: boolean,
  onNavigate: (suffix: string) => void,
  access = { permissions: allPermissions, capabilities: allCapabilities },
) {
  return render(<div className="consolelayout" data-visual-theme="admin-web-v1">
    <Sidebar active="applications" collapsed={collapsed} displayName="商城管理员" roleLabel="当前范围"
      scopeKind={kind} professionalRoutes={professionalRoutes} workstations={workstations}
      permissions={access.permissions} capabilities={access.capabilities}
      onNavigate={onNavigate} onToggle={vi.fn()} />
  </div>);
}
