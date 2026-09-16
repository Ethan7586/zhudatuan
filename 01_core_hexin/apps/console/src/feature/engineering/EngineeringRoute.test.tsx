import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { Component as EngineeringWorkspaceRoute } from './EngineeringWorkspaceRoute';
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
    renderPage('system/engineering');
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

  it('presents ERA 2.0 with its exact assurance boundary', () => {
    renderPage('system/engineering');
    expect(screen.getByRole('heading', { name: 'ERA 2.0 工程与架构中心' })).toBeTruthy();
    expect(screen.getByText('ERA 2.0 · Engineering Readiness & Assurance')).toBeTruthy();
    expect(screen.getByText('12/12 MET · DEV VERIFIED')).toBeTruthy();
    expect(screen.getByText(/12\/12 MET · DEV VERIFIED · NOT REVIEWED/)).toBeTruthy();
    expect(screen.getByText(/不参与发布与部署门禁/)).toBeTruthy();
  });

  it('keeps unadopted MB slices dark and locally adopted but unverified code gray', () => {
    renderPage('system/engineering');
    const directory = screen.getByText('会员目录').closest('.engineeringkernelslice');
    const detail = screen.getByText('会员基础档案读取').closest('.engineeringkernelslice');
    const custom = screen.getByText('自定义档案字段校验').closest('.engineeringkernelslice');
    expect(directory?.getAttribute('data-state')).toBe('legacy');
    expect(detail?.getAttribute('data-state')).toBe('legacy');
    expect(custom?.getAttribute('data-state')).toBe('pending');
    expect(screen.queryByText('线上已验证')).toBeNull();
  });

  it('routes the four center tabs within the current scope', () => {
    renderPage('system/engineering');
    const tabs = screen.getByRole('navigation', { name: '工程与架构中心页面' });
    expect(within(tabs).getAllByRole('link').map((link) => link.textContent))
      .toEqual(['工程与架构', '运行状态', '发布与版本', '故障与技术']);
    expect(screen.getByRole('link', { name: '运行状态' }).getAttribute('href'))
      .toBe('/scopes/platform/organization-platform-root/system/status');
    expect(screen.getByRole('link', { name: '发布与版本' }).getAttribute('href'))
      .toBe('/scopes/platform/organization-platform-root/system/releases');
    expect(screen.getByRole('link', { name: '工程与架构' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: '故障与技术' }).getAttribute('href'))
      .toBe('/scopes/platform/organization-platform-root/system/incidents');
  });

  it.each([
    ['system/status', '系统运行状态', '实时运行数据尚未接入'],
    ['system/incidents', '故障与技术支持', '故障数据尚未接入'],
  ] as const)('renders an honest %s page without invented live state', (suffix, title, notice) => {
    renderPage(suffix);
    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getByText(notice)).toBeTruthy();
  });

  it('renders the Chinese production release ledger newest first', () => {
    renderPage('system/releases');
    expect(screen.getByRole('heading', { name: '发布与版本' })).toBeTruthy();
    expect(screen.getByText('版本登记规则')).toBeTruthy();
    const versions = screen.getAllByText(/^v\d+\.\d+\.\d+$/).map((node) => node.textContent);
    expect(versions).toEqual(['v1.1.0', 'v1.0.4', 'v1.0.3']);
    expect(screen.getByText('工程与架构中心正式上线')).toBeTruthy();
    expect(screen.getByText('中文版本更新账本')).toBeTruthy();
  });

  it('keeps the engineering frame mounted while switching internal tabs', () => {
    renderPage('system/engineering');
    const brand = screen.getByAltText('MORVIA · zhudatuan 主打团');
    fireEvent.click(screen.getByRole('link', { name: '发布与版本' }));
    expect(screen.getByAltText('MORVIA · zhudatuan 主打团')).toBe(brand);
    expect(screen.getByRole('heading', { name: '发布与版本' })).toBeTruthy();
    expect(screen.getByText('系统架构关系').closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(true);
  });

  it('restores the scroll position independently for each internal tab', () => {
    const { container } = renderPage('system/engineering');
    const workspace = container.querySelector<HTMLElement>('.workspacebody');
    expect(workspace).not.toBeNull();
    if (workspace === null) return;
    workspace.scrollTop = 144;
    fireEvent.click(screen.getByRole('link', { name: '发布与版本' }));
    expect(workspace.scrollTop).toBe(0);
    workspace.scrollTop = 287;
    fireEvent.click(screen.getByRole('link', { name: '工程与架构' }));
    expect(workspace.scrollTop).toBe(144);
  });
});

function renderPage(suffix: string) {
  const path = `/scopes/platform/organization-platform-root/${suffix}`;
  return render(<div className="workspacebody"><MemoryRouter initialEntries={[path]}><Routes>
      <Route path="/scopes/:scopeKind/:scopeId">
        {engineeringModule.routes.map((route) => <Route key={route.id} path={route.path}
          element={<EngineeringWorkspaceRoute />} />)}
      </Route>
    </Routes></MemoryRouter></div>);
}
