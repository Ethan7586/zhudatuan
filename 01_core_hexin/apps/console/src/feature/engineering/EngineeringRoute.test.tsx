import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { Component as EngineeringRoute } from './EngineeringRoute';
import { Component as IncidentTechnologyRoute } from './IncidentTechnologyRoute';
import { Component as ReleaseVersionRoute } from './ReleaseVersionRoute';
import { Component as RuntimeStatusRoute } from './RuntimeStatusRoute';
import { engineeringModule } from './manifest';

afterEach(cleanup);

describe('Engineering and architecture center', () => {
  it('registers one platform-preferred entry and reuses the existing runtime read capability for all routes', () => {
    expect(engineeringModule.navigation).toMatchObject({
      placement: 'bottom', order: 120, label: '工程与架构', preferredScopeKind: 'platform',
    });
    expect(engineeringModule.routes).toHaveLength(4);
    expect(engineeringModule.routes.every(({ operations }) =>
      operations.length === 1 && operations[0] === 'runtime.health.dependency')).toBe(true);
  });

  it('keeps Storefront and Console in L1 while H6 remains in L2', () => {
    renderPage(<EngineeringRoute />, 'system/engineering');
    const l1 = screen.getByRole('heading', { name: '公共平台与运行服务' }).closest('section');
    const l2 = screen.getByRole('heading', { name: '商城与业务入口' }).closest('section');
    expect(l1).not.toBeNull();
    expect(l2).not.toBeNull();
    if (l1 === null || l2 === null) return;
    expect(within(l1).getByText('Storefront / Console')).toBeTruthy();
    expect(within(l1).queryByText('H6 体验入口')).toBeNull();
    expect(within(l2).getByText('H6 体验入口')).toBeTruthy();
    expect(within(l2).queryByText('Storefront / Console')).toBeNull();
  });

  it('routes the four center tabs within the current scope', () => {
    renderPage(<EngineeringRoute />, 'system/engineering');
    expect(screen.getByRole('link', { name: '运行状态' }).getAttribute('href'))
      .toBe('/scopes/platform/organization-platform-root/system/status');
    expect(screen.getByRole('link', { name: '发布与版本' }).getAttribute('href'))
      .toBe('/scopes/platform/organization-platform-root/system/releases');
    expect(screen.getByRole('link', { name: '工程与架构' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: '故障与技术' }).getAttribute('href'))
      .toBe('/scopes/platform/organization-platform-root/system/incidents');
  });

  it.each([
    [RuntimeStatusRoute, 'system/status', '系统运行状态', '实时运行数据尚未接入'],
    [ReleaseVersionRoute, 'system/releases', '发布与版本', '这是只读版本中心'],
    [IncidentTechnologyRoute, 'system/incidents', '故障与技术支持', '故障数据尚未接入'],
  ] as const)('renders an honest %s page without invented live state', (Page, suffix, title, notice) => {
    renderPage(<Page />, suffix);
    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getByText(notice)).toBeTruthy();
  });
});

function renderPage(element: React.ReactNode, suffix: string) {
  const path = `/scopes/platform/organization-platform-root/${suffix}`;
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/scopes/:scopeKind/:scopeId/*" element={element} />
  </Routes></MemoryRouter>);
}
