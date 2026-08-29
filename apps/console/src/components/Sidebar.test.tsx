import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleScope } from '../entity/session/ConsoleSession';
import { professionalRoutes } from '../route/ProfessionalRouteCatalog';
import { workstations } from '../shell/Workstation';
import { Sidebar } from './Sidebar';

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
});

function renderSidebar(kind: ConsoleScope['kind'], collapsed: boolean, onNavigate: (suffix: string) => void) {
  return render(<Sidebar active="applications" collapsed={collapsed} displayName="商城管理员" roleLabel="当前范围"
    scopeKind={kind} professionalRoutes={professionalRoutes} workstations={workstations}
    onNavigate={onNavigate} onToggle={vi.fn()} />);
}
