import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DependencyProvider } from '../../../../app/DependencyContext';
import { createConsoleDependencies } from '../../../../app/Dependencies';
import { ConsoleContextProvider } from '../../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { StepupProvider } from '../../../../entity/session/StepupContext';
import { Component } from './DirectoryRoute';

const server = setupServer(
  http.get('*/api/v1/organization/directories', () => HttpResponse.json({ items: [directory], count: 1 })),
  http.get('*/api/v1/organization/directories/:id/syncruns', () => HttpResponse.json({ items: [run], count: 1 }))
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('DirectoryRoute', () => {
  it('shows task watermark and resumes a failed run through the backend', async () => {
    server.use(
      http.post('*/api/v1/organization/directories/:id/syncs', async ({ request }) => {
        expect(request.headers.get('x-action-proof')).toBe('p'.repeat(43));
        expect(await request.json()).toEqual({ action: 'resume', run: run.id });
        return HttpResponse.json({ id: '20000000-0000-4000-8000-000000000002', state: 'queued', mode: 'incremental', preview: false });
      })
    );
    renderRoute();
    expect(await screen.findByText('源版本 29')).toBeTruthy();
    expect(await screen.findByText('读取 10 · 新增 3 · 更新 2 · 冻结 1 · 恢复 2 · 冲突 1 · 忽略 1')).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '恢复' }));
    await user.type(screen.getByLabelText('一次性操作凭证'), 'p'.repeat(43));
    await user.click(screen.getByLabelText('我已核对目录连接、同步模式与影响范围'));
    await user.click(screen.getByRole('button', { name: '确认恢复任务' }));
    expect(await screen.findByText('任务状态已更新')).toBeTruthy();
  });

  it('isolates a history read failure without crashing the directory list', async () => {
    server.use(
      http.get('*/api/v1/organization/directories/:id/syncruns', () =>
        HttpResponse.json({ code: 'DEPENDENCY_UNAVAILABLE', message: '同步历史暂时不可用。', requestId: 'request:directory-history', retryable: true }, { status: 503 })
      )
    );
    renderRoute();
    expect((await screen.findByRole('alert')).textContent).toContain('依赖服务暂时不可用，请稍后重试');
    expect(screen.getByRole('button', { name: '预览差异' })).toBeTruthy();
    expect(screen.getByText('可恢复任务历史')).toBeTruthy();
  });
});

function renderRoute() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <DependencyProvider value={createConsoleDependencies()}>
          <ConsoleContextProvider value={context}>
            <StepupProvider controller={{ request: () => undefined }}>
              <Component />
            </StepupProvider>
          </ConsoleContextProvider>
        </DependencyProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const directory = {
  id: '10000000-0000-4000-8000-000000000001',
  organization_id: 'mall:one',
  type: 'wecomcorp',
  status: 'enabled',
  successful_version: 29,
  version: 4,
  updated_at: '2026-09-03T00:11:00.000Z',
  last_success_at: '2026-09-03T00:10:00.000Z',
};
const run = {
  id: '20000000-0000-4000-8000-000000000001',
  mode: 'incremental',
  state: 'failed',
  preview: false,
  read_count: 10,
  applied_count: 8,
  create_count: 3,
  update_count: 2,
  freeze_count: 1,
  restore_count: 2,
  conflict_count: 1,
  ignored_count: 1,
  watermark: '2026-09-03T00:09:00.000Z',
  started_at: '2026-09-03T00:08:00.000Z',
  completed_at: '2026-09-03T00:10:00.000Z',
  created_at: '2026-09-03T00:08:00.000Z',
};
const scope = { kind: 'mall', id: 'mall:one', name: '测试商城' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    accessVersion: 7,
    permissions: ['organization.directory.read', 'organization.directory.sync'],
    capabilities: ['organization.directories.read', 'organization.directories.syncruns.read', 'organization.directories.sync'],
    target: 'console',
    scope,
    scopes: [scope],
    assurance: { level: 3 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    csrf: 'csrf-token',
    syncedAt: '2026-09-03T00:00:00.000Z',
  },
  profile: { display_name: '管理员', employee_no: 'A001' },
  scope,
  scopes: [scope],
};
