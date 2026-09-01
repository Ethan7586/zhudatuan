import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleScope } from '../entity/session/ConsoleSession';
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
    expect(labels.indexOf('智慧翼中控台')).toBeLessThan(labels.indexOf('商城管理'));
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

function renderSidebar(kind: ConsoleScope['kind'], collapsed: boolean, onNavigate: (suffix: string) => void) {
  return render(<div className="consolelayout" data-visual-theme="admin-web-v1">
    <Sidebar active="applications" collapsed={collapsed} displayName="商城管理员" roleLabel="当前范围"
      scopeKind={kind} professionalRoutes={professionalRoutes} workstations={workstations}
      onNavigate={onNavigate} onToggle={vi.fn()} />
  </div>);
}
