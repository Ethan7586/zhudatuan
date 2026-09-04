import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createConsoleDependencies } from '../../../app/Dependencies';
import { DependencyProvider } from '../../../app/DependencyContext';
import { ConsoleContextProvider } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext, ConsoleScope } from '../../../entity/session/ConsoleSession';
import { StepupProvider } from '../../../entity/session/StepupContext';
import { Component } from './ControlRoute';

const server = setupServer(
  http.get('*/api/v1/organizations/layers', ({ request }) => {
    expect(request.headers.get('x-scope-hint')).toBe('platform:one');
    expect(request.headers.get('x-access-version')).toBe('7');
    return HttpResponse.json({ items: [{ id: 'enterprise:one', kind: 'enterprise', parent_id: 'platform:one', parent_name: '福利商城平台', name: '鸿泰集团', timezone: 'Asia/Shanghai', status: 'active', version: 2 }], count: 1 });
  }),
  http.get('*/api/v1/channels/distributors', ({ request }) => {
    expect(request.headers.get('x-scope-hint')).toBe('distributor:root');
    return HttpResponse.json({
      items: [
        {
          id: 'distributor:one',
          organization_id: 'distributor:one',
          code: 'D001',
          name: '华东分销',
          settlement_mode: 'monthly',
          metadata: {},
          status: 'active',
          tenant_count: 3,
          created_at: '2026-08-29T00:00:00Z',
          updated_at: '2026-08-30T00:00:00Z',
        },
      ],
      count: 1,
    });
  }),
  http.get('*/health/dependency', ({ request }) => {
    expect(request.headers.get('x-scope-hint')).toBe('enterprise:one');
    return HttpResponse.json(runtimeHealth());
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Control MVVM workspace', () => {
  it('preserves the platform organization model and authoritative presentation', async () => {
    renderRoute({ kind: 'platform', id: 'platform:one' });
    expect(await screen.findByRole('heading', { level: 1, name: '平台层' })).toBeTruthy();
    expect(await screen.findByText('鸿泰集团')).toBeTruthy();
    expect(screen.getByText('福利商城平台')).toBeTruthy();
    expect(screen.getByText('企业')).toBeTruthy();
    expect(screen.queryByText('platform:one')).toBeNull();
  });

  it('preserves the distribution model without adding unapproved platform requirements', async () => {
    renderRoute({ kind: 'distributor', id: 'distributor:root' });
    expect(await screen.findByRole('heading', { level: 1, name: '分销层' })).toBeTruthy();
    expect(await screen.findByText('华东分销')).toBeTruthy();
    expect(screen.getByText('D001')).toBeTruthy();
    expect(screen.getByText('按月')).toBeTruthy();
    expect(screen.queryByText('monthly')).toBeNull();
  });

  it('preserves the runtime model and maps its facts inside the ViewModel', async () => {
    renderRoute({ kind: 'enterprise', id: 'enterprise:one' });
    expect(await screen.findByRole('heading', { level: 1, name: '智慧翼中控台' })).toBeTruthy();
    expect(await screen.findByText('任务队列')).toBeTruthy();
    expect(screen.getByText('数据库迁移、运行配置与接口协议一致')).toBeTruthy();
    expect(screen.getByText('注册 11 · 健康 11 · 异常 0')).toBeTruthy();
  });

  it('turns protected runtime health into a real verification journey', async () => {
    const request = vi.fn();
    server.use(http.get('*/health/dependency', () => HttpResponse.json({ code: 'STEPUP_REQUIRED', message: 'STEPUP_REQUIRED', requestId: 'request:control', retryable: false }, { status: 403 })));
    renderRoute({ kind: 'enterprise', id: 'enterprise:one' }, request);
    const action = await screen.findByRole('button', { name: '立即完成二次验证' });
    expect(screen.getByText(/运行状态包含数据库、任务队列与扩展健康信息/)).toBeTruthy();
    expect(screen.queryByText(/request:control/)).toBeNull();
    fireEvent.click(action);
    expect(request).toHaveBeenCalledOnce();
  });
});

function renderRoute(scope: ConsoleScope, request = vi.fn()) {
  const context: ConsoleContext = {
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
      syncedAt: '2026-08-30T00:00:00Z',
    },
    profile: { display_name: '平台管理员', employee_no: null },
    scope,
    scopes: [scope],
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <DependencyProvider value={createConsoleDependencies()}>
          <ConsoleContextProvider value={context}>
            <StepupProvider controller={{ request }}>
              <Component />
            </StepupProvider>
          </ConsoleContextProvider>
        </DependencyProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

function runtimeHealth() {
  return {
    status: 'available',
    queue: { queued: 2, running: 1, deadletters: 0, oldest_seconds: 3 },
    cache: { available: true },
    databaseQueries: [],
    readiness: {
      healthy: true,
      condition: 'ready',
      degraded: [],
      configuration: { checksum: 'config', matches: true },
      contract: { checksum: 'contract-checksum', matches: true },
      migration: { head: '20260831045000', matches: true },
      registries: { operations: 269, events: 100, jobs: 30, checksum: 'registry' },
      database: { writable: true, migration: true, contract: true, role: true, operations: 269, capabilities: 269, events: 100, invitationKeys: true },
      extensions: { registered: 11, healthy: 11, unhealthy: 0, checksum: 'extensions' },
    },
  };
}
