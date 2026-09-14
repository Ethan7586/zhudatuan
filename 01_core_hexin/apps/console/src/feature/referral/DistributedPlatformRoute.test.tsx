import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component } from './DistributedPlatformRoute';

let createdBody: unknown;
let createdIdempotency: string | null;
let retriedTaskId: string | undefined;

const server = setupServer(
  http.get('*/api/v1/experiences/applications', () => HttpResponse.json({
    items: [{
      id: 'application:benefits',
      code: 'BENEFITS',
      public_slug: 'benefits',
      name: '鸿泰惠民通',
      status: 'active',
      version: 12,
      head_sequence: 8,
      head_validation_state: 'valid',
      published_sequence: 8,
      domain: 'benefits.example.cn',
      mall_id: 'mall:benefits',
      pool_id: 'pool:benefits',
      updated_at: '2026-08-27T04:00:00.000Z',
    }],
    count: 1,
  })),
  http.post('*/api/v1/provisioning/malls', async ({ request }) => {
    createdBody = await request.json();
    createdIdempotency = request.headers.get('idempotency-key');
    return HttpResponse.json({
      mallId: 'mall:huazhong',
      enterpriseId: 'mall:benefits',
      applicationId: 'application:huazhong',
      poolId: 'pool:huazhong',
      organizationId: 'mall:huazhong',
      scopeId: 'mall:huazhong',
      parentId: 'mall:benefits',
      ownerMembershipId: 'membership:huazhong-owner',
      ownerMemberId: 'member:commerce',
      ownerPrincipalId: 'actor:commerce',
      code: 'HUAZHONG',
      publicSlug: 'h6',
      name: '华中甄选平台',
      createdAt: '2026-09-14T03:00:00.000Z',
      state: 'ready',
      publicationState: 'draft',
      nodeTask: taskReceipt('QUEUED', 0),
    }, { status: 201 });
  }),
  http.get('*/api/v1/provisioning/node-tasks/:taskid', ({ params }) => String(params.taskid) === 'task:mall:huazhong'
    ? HttpResponse.json(taskReceipt('SUCCEEDED', 100))
    : HttpResponse.json({ code: 'RESOURCE_NOT_FOUND', message: 'RESOURCE_NOT_FOUND', requestId: 'request:task-missing' },
      { status: 404 })),
  http.post('*/api/v1/provisioning/node-tasks/:taskid/retry', ({ params }) => {
    retriedTaskId = String(params.taskid);
    return HttpResponse.json(taskReceipt('QUEUED', 0), { status: 202 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  createdBody = undefined;
  createdIdempotency = null;
  retriedTaskId = undefined;
});
afterAll(() => server.close());

describe('Distributed platform workspace', () => {
  it('combines the signed node manifest with real mall applications', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter initialEntries={['/platforms']}>
        <QueryClientProvider client={client}>
          <ConsoleContextProvider value={context}>
            <Component />
          </ConsoleContextProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: '分布式平台' })).toBeTruthy();
    expect((await screen.findAllByText('node:local-development:l0')).length).toBeGreaterThan(0);
    expect(screen.getByText('NodeManifest')).toBeTruthy();
    expect(screen.getByText('鸿泰惠民通')).toBeTruthy();
    expect(await screen.findByText('暂无平台生产任务')).toBeTruthy();
    expect(screen.getByRole('button', { name: '树状视图' }).getAttribute('aria-pressed')).toBe('true');

    await user.click(screen.getByRole('button', { name: '链路视图' }));
    expect(screen.getByRole('button', { name: '链路视图' }).getAttribute('aria-pressed')).toBe('true');

    await user.click(screen.getByText('鸿泰惠民通'));
    expect(screen.getAllByText('mall:benefits').length).toBeGreaterThan(0);
    expect(screen.getByText('已经拥有独立商城与 H5 内容；建立独立 NodeManifest、身份入口和发布指针后，才成为完整下级平台。')).toBeTruthy();
  });

  it('creates a real hosted platform core through the existing mall provisioning operation', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter initialEntries={['/platforms']}>
        <QueryClientProvider client={client}>
          <ConsoleContextProvider value={context}>
            <Component />
          </ConsoleContextProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { level: 1, name: '分布式平台' });
    await user.click(screen.getByRole('button', { name: '创建下级平台' }));
    expect(screen.getAllByText('L0').length).toBeGreaterThan(0);
    expect(screen.getByText('L1')).toBeTruthy();

    await user.type(screen.getByLabelText('平台名称'), '华中甄选平台');
    await user.type(screen.getByLabelText('平台代码'), 'huazhong');
    await user.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByText('标准托管平台')).toBeTruthy();
    expect(screen.getByText('只展示本次会真实生成的内容，不收集无落点资料。')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '下一步' }));
    await user.click(screen.getByRole('button', { name: '确认创建' }));

    expect(await screen.findByText('独立节点已激活')).toBeTruthy();
    expect(screen.getByText('https://h6.hbbtzn.com')).toBeTruthy();
    expect(createdBody).toEqual({
      enterpriseId: 'mall:benefits',
      name: '华中甄选平台',
      code: 'HUAZHONG',
      publicSlug: 'auto-h5',
    });
    expect(createdIdempotency).toBeTruthy();
  });

  it('renders running progress and persisted successful outputs exactly as returned', async () => {
    let task = taskReceipt('RUNNING', 35, { mallId: 'mall:benefits', taskId: 'task:mall:benefits' });
    server.use(http.get('*/api/v1/provisioning/node-tasks/:taskid', () => HttpResponse.json(task)));
    const running = render(
      <MemoryRouter initialEntries={['/platforms']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ConsoleContextProvider value={context}><Component /></ConsoleContextProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('执行中')).toBeTruthy();
    expect(screen.getByText('35%')).toBeTruthy();
    running.unmount();

    task = taskReceipt('SUCCEEDED', 100, { mallId: 'mall:benefits', taskId: 'task:mall:benefits' });
    render(
      <MemoryRouter initialEntries={['/platforms']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ConsoleContextProvider value={context}><Component /></ConsoleContextProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('已完成')).toBeTruthy();
    expect(screen.getByText('manifest:h6:l1')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'H5 · https://h6.hbbtzn.com' }).getAttribute('href'))
      .toBe('https://h6.hbbtzn.com');
  });

  it('restores a persisted failed task and retries the same task chain once', async () => {
    let history = taskReceipt('FAILED_RETRYABLE', 35, {
      lastError: 'DNS_PROVIDER_TEMPORARY_FAILURE',
      mallId: 'mall:benefits',
      taskId: 'task:mall:benefits',
    });
    server.use(
      http.get('*/api/v1/provisioning/node-tasks/:taskid', () => HttpResponse.json(history)),
      http.post('*/api/v1/provisioning/node-tasks/:taskid/retry', ({ params }) => {
        retriedTaskId = String(params.taskid);
        history = taskReceipt('QUEUED', 0, { mallId: 'mall:benefits', taskId: retriedTaskId });
        return HttpResponse.json(history, { status: 202 });
      }),
    );
    const user = userEvent.setup();
    const firstClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const first = render(
      <MemoryRouter initialEntries={['/platforms']}>
        <QueryClientProvider client={firstClient}>
          <ConsoleContextProvider value={context}><Component /></ConsoleContextProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('执行失败')).toBeTruthy();
    expect(screen.getAllByText('DNS_PROVIDER_TEMPORARY_FAILURE')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: '重试一次' }));
    expect(retriedTaskId).toBe('task:mall:benefits');
    expect(await screen.findByText('排队中')).toBeTruthy();

    first.unmount();
    const restoredClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter initialEntries={['/platforms']}>
        <QueryClientProvider client={restoredClient}>
          <ConsoleContextProvider value={context}><Component /></ConsoleContextProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('排队中')).toBeTruthy();
    expect(screen.getByText('task:mall:benefits')).toBeTruthy();
  });

  it('shows task read failures and missing task permission explicitly', async () => {
    server.use(http.get('*/api/v1/provisioning/node-tasks/:taskid', () => new HttpResponse(null, { status: 503 })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const failed = render(
      <MemoryRouter initialEntries={['/platforms']}>
        <QueryClientProvider client={client}>
          <ConsoleContextProvider value={context}><Component /></ConsoleContextProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('任务记录读取失败')).toBeTruthy();
    failed.unmount();

    const deniedContext: ConsoleContext = { ...context, session: { ...context.session,
      capabilities: context.session.capabilities.filter((capability) => capability !== 'provisioning.nodetasks.read') } };
    render(
      <MemoryRouter initialEntries={['/platforms']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ConsoleContextProvider value={deniedContext}><Component /></ConsoleContextProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText('当前身份无任务读取权限')).toBeTruthy();
  });
});

const scope = { kind: 'mall' as const, id: 'mall:benefits', name: '鸿泰惠民通' };
const context: ConsoleContext = {
  session: {
    actor: 'actor:commerce',
    membership: 'membership:commerce',
    scope,
    scopes: [scope],
    accessVersion: 11,
    permissions: ['experience.application.read', 'organization.layer.read', 'organization.layer.manage'],
    capabilities: ['experience.applications.read', 'provisioning.malls.create', 'provisioning.nodetasks.read',
      'provisioning.nodetasks.retry'],
    assurance: { level: 3, verified: '2026-09-14T00:00:00.000Z' },
    security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null },
    csrf: 'csrf-token-for-test',
    target: 'console',
    syncedAt: '2026-09-14T00:00:00.000Z',
  },
  profile: { display_name: '商城运营', employee_no: null },
  scope,
  scopes: [scope],
};

type TaskStatus = 'QUEUED' | 'RUNNING' | 'WAITING_EXTERNAL' | 'FAILED_RETRYABLE' | 'SUCCEEDED';

function taskReceipt(status: TaskStatus, progress: number, options: Readonly<{
  lastError?: string;
  mallId?: string;
  taskId?: string;
}> = {}) {
  const succeeded = status === 'SUCCEEDED';
  return {
    schema_version: 'sfl.autonode-control-task-receipt.v1',
    task_id: options.taskId ?? 'task:mall:huazhong',
    action: 'ACTIVATE',
    node_id: 'node:h6:l1',
    status,
    phase: succeeded ? 'ACTIVE' : status === 'FAILED_RETRYABLE' ? 'FAILED' : status,
    progress,
    plan_digest: succeeded ? 'sha256:plan' : null,
    activation_status: succeeded ? 'ACTIVE' : status === 'FAILED_RETRYABLE' ? 'FAILED_RETRYABLE' : null,
    waiting_external: [],
    last_error: options.lastError === undefined ? null : { message: options.lastError },
    platform: { mall_id: options.mallId ?? 'mall:huazhong', application_id: null,
      name: options.mallId === 'mall:benefits' ? '鸿泰惠民通' : '华中甄选平台', public_slug: 'h6' },
    result: succeeded ? { manifest_id: 'manifest:h6:l1', access_entries: [
      { surface_ref: 'surface:storefront', url: 'https://h6.hbbtzn.com' },
    ] } : null,
    events: [{ phase: succeeded ? 'ACTIVE' : status === 'FAILED_RETRYABLE' ? 'FAILED' : status,
      message: options.lastError ?? (succeeded ? '独立平台已经完成首次激活' : '平台创建任务已进入执行队列'),
      occurred_at: '2026-09-14T03:00:00.000Z' }],
    created_at: '2026-09-14T03:00:00.000Z',
    updated_at: '2026-09-14T03:00:00.000Z',
    started_at: succeeded || status === 'FAILED_RETRYABLE' ? '2026-09-14T03:00:00.000Z' : null,
    finished_at: succeeded || status === 'FAILED_RETRYABLE' ? '2026-09-14T03:01:00.000Z' : null,
  };
}
