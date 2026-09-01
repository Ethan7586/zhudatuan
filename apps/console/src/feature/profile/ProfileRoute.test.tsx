import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext, ConsoleScope } from '../../entity/session/ConsoleSession';
import { Component } from './ProfileRoute';

const server = setupServer(
  http.get('*/api/v1/access/center', () => HttpResponse.json({
    items: [{
      id: 'membership:owner', status: 'active', access_version: '7',
      member_id: 'member:owner', display_name: 'Ethan', employee_no: 'ETHAN-001',
      roles: [
        { role: 'role-platform-owner-v2', name: '平台业主', scope: {
          kind: 'tenant', id: 'tenant:zhudatuan', tenant: 'tenant:zhudatuan', name: '主打团商户',
        }, scope_source: 'direct', effective_at: '2026-08-29T00:00:00.000Z', expires: null },
        { role: 'role-finance', name: '财务', scope: {
          kind: 'tenant', id: 'tenant:zhudatuan', tenant: 'tenant:zhudatuan', name: '主打团商户',
        }, scope_source: 'direct', effective_at: '2026-08-29T00:00:00.000Z', expires: null },
      ],
      scopes: [{
        id: 'scope:merchant', kind: 'tenant', scope: 'tenant-zhudatuan', effect: 'allow', expires: null,
      }],
      denies: [],
      effective_permissions: ['access.center.read', 'order.read'],
    }],
    roles: [],
    count: 1,
  })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('personal profile workspace', () => {
  it('renders real account, identity, permission, scope, path, and session data without legacy product copy', async () => {
    renderProfile(context);

    expect(screen.getByRole('heading', { level: 1, name: '个人信息' })).toBeTruthy();
    expect(screen.getAllByText('Ethan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ETHAN-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('134****7586').length).toBeGreaterThan(0);
    expect(await screen.findByRole('status', { name: '当前治理身份：平台 Owner' })).toBeTruthy();
    expect(screen.getAllByText('平台 Owner').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('财务').length).toBeGreaterThan(0);
    expect(screen.getByText('access.center.read')).toBeTruthy();
    expect(screen.getByText('order.read')).toBeTruthy();
    expect(screen.getAllByText(/主打团商户/).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('租户');
    expect(document.body.textContent).not.toContain('Smart Wing');
    expect(document.body.textContent).not.toContain('智慧翼');
    expect(document.body.textContent).not.toContain('築店');
  });

  it('shows explicit empty states instead of inventing missing profile or assignment data', () => {
    renderProfile({
      ...context,
      session: { ...context.session, permissions: [], security: undefined },
      profile: { display_name: '测试成员', employee_no: null },
    });

    expect(screen.getByText('员工号')).toBeTruthy();
    expect(screen.getByText('未设置')).toBeTruthy();
    expect(screen.getAllByText('未返回').length).toBeGreaterThan(0);
    expect(screen.getAllByText('当前会话未授权读取身份分配。').length).toBeGreaterThan(0);
    expect(screen.getByText('当前会话没有返回任何生效权限。')).toBeTruthy();
  });

  it('shows an explicit degraded profile state without hiding the workspace', () => {
    renderProfile({
      ...context,
      profile: { display_name: '当前用户', employee_no: null },
      profileState: 'unavailable',
    });

    expect(screen.getByText('个人资料暂不可用')).toBeTruthy();
    expect(screen.getByText('工作空间和业务功能仍可继续使用，请稍后刷新重试。')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: '个人信息' })).toBeTruthy();
  });

  it('locks the desktop, narrow-tablet, mobile, and minimum-width responsive modes', () => {
    const css = ['profile.css', 'profile-access.css', 'profile-responsive.css']
      .map((file) => readFileSync(`src/feature/profile/${file}`, 'utf8')).join('\n');
    expect(css).toMatch(/@media \(max-width: 82\.125rem\)/);
    expect(css).toMatch(/\.profilemasterdetail[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
    expect(css).toMatch(/@media \(min-width: 40\.0625rem\) and \(max-width: 82\.125rem\)/);
    expect(css).toMatch(/grid-template-areas:[\s\S]*'avatar name'[\s\S]*'avatar status'/);
    expect(css).toMatch(/@media \(max-width: 22rem\)/);
    expect(css).toMatch(/overflow-wrap: anywhere/);
  });
});

const tenantScope: ConsoleScope = {
  kind: 'tenant', id: 'tenant:zhudatuan', tenant: 'tenant:zhudatuan', name: '主打团租户',
  path: [{ kind: 'platform', id: 'organization-platform-root' }],
};

const context: ConsoleContext = {
  session: {
    actor: 'principal:owner',
    membership: 'membership:owner',
    accessVersion: 7,
    permissions: ['access.center.read', 'order.read', 'catalog.listing.read', 'finance.overview.read'],
    capabilities: ['access.center.read'],
    assurance: { level: 2 },
    security: { hasLocalCredential: true, phoneMasked: '134****7586', passwordChangedAt: null },
    target: 'console',
    scope: tenantScope,
    scopes: [tenantScope],
    syncedAt: '2026-09-01T06:09:00.000Z',
  },
  profile: {
    id: 'member:owner', display_name: 'Ethan', employee_no: 'ETHAN-001', status: 'active', mobile_bound: true,
    membership_id: 'membership:owner', organization_id: 'tenant:zhudatuan', joined_at: '2026-08-29T00:00:00.000Z', access_version: 7,
  },
  scope: tenantScope,
  scopes: [tenantScope],
};

function renderProfile(value: ConsoleContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConsoleContextProvider value={value}>
        <Component />
      </ConsoleContextProvider>
    </QueryClientProvider>,
  );
}
