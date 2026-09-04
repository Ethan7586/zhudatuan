import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext, ConsoleNavigationNode } from '../../../entity/session/ConsoleSession';
import { Component } from './SettingsRoute';

afterEach(cleanup);

describe('SettingsRoute', () => {
  it('renders exactly the enabled modules projected by the server', () => {
    renderRoute([node('member', '成员管理'), node('partner', '合作伙伴', true), node('task', '任务中心')]);
    expect(screen.getByRole('heading', { name: '成员管理' })).toBeTruthy();
    expect(screen.queryByText('合作伙伴')).toBeNull();
    expect(screen.getByRole('heading', { name: '任务中心' })).toBeTruthy();
    expect(screen.queryByText('暂不可用')).toBeNull();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('shows a clear empty state without capability placeholders', () => {
    renderRoute([node('member', '成员管理', true)]);
    expect(screen.getByRole('status').textContent).toContain('当前范围暂无可管理模块');
    expect(screen.queryByText('成员管理')).toBeNull();
  });
});

function renderRoute(nodes: readonly ConsoleNavigationNode[]) {
  const value = context();
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <ConsoleContextProvider value={value}>
        <Routes>
          <Route element={<Outlet context={{ nodes, scope: value.scope }} />}>
            <Route path="settings" element={<Component />} />
          </Route>
        </Routes>
      </ConsoleContextProvider>
    </MemoryRouter>
  );
}

function node(component: ConsoleNavigationNode['experience']['component'], title: string, disabled = false): ConsoleNavigationNode {
  const key = component;
  return {
    key,
    title,
    parent: null,
    order: 10,
    operation: `${component}.read`,
    experience: {
      icon: 'module',
      routeKey: component === 'member' ? 'consolemembers' : component === 'partner' ? 'consolepartners' : 'consoletasks',
      route: `/scopes/:scopeKind/:scopeId/${component}`,
      component,
      placement: 'secondary',
      disabled,
      disabledReason: disabled ? '当前范围暂无可用功能' : null,
      breadcrumbs: [{ key, title }],
    },
    children: [],
  };
}

function context(): ConsoleContext {
  const scope = { kind: 'mall', id: 'mall:one', name: '测试商城' } as const;
  return {
    session: {
      actor: 'actor:one',
      membership: 'membership:one',
      accessVersion: 7,
      permissions: [],
      capabilities: [],
      target: 'console',
      scope,
      scopes: [scope],
      assurance: { level: 2 },
      security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
      csrf: 'csrf-token-value',
      syncedAt: '2026-09-03T00:00:00.000Z',
    },
    profile: { display_name: '管理员', employee_no: null },
    scope,
    scopes: [scope],
  };
}
