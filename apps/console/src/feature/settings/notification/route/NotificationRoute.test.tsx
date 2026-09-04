import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
import { Component } from './NotificationRoute';

const templates = { items: [], count: 0 };
const server = setupServer(http.get('*/api/v1/notifications/templates', () => HttpResponse.json(templates)));
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('NotificationRoute', () => {
  it('publishes a validated preview with approval proof and rereads the server', async () => {
    let reads = 0;
    server.use(
      http.get('*/api/v1/notifications/templates', () => {
        reads += 1;
        return HttpResponse.json(templates);
      }),
      http.put('*/api/v1/notifications/templates/:id', async ({ request, params }) => {
        expect(request.headers.get('if-match')).toBe('"0"');
        expect(request.headers.get('x-action-proof')).toBe('p'.repeat(43));
        expect(request.headers.get('idempotency-key')).toBeTruthy();
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).toMatchObject({ channel: 'inapp', eventType: 'order.paid', status: 'active', body: '订单 {{orderId}} 已支付' });
        return HttpResponse.json({
          id: String(params.id),
          scope_id: 'mall:one',
          channel: 'inapp',
          event_type: 'order.paid',
          version: 1,
          variable_schema: { orderId: 'string' },
          provider_template: null,
          subject: '支付成功',
          body: '订单 {{orderId}} 已支付',
          purpose: 'transactional',
          mandatory: false,
          status: 'active',
          created_at: '2026-09-03T00:00:00.000Z',
          matches: true,
          inserted: true,
        });
      })
    );
    renderRoute();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '新建模板' }));
    await user.type(screen.getByLabelText('事件类型'), 'order.paid');
    await user.type(screen.getByLabelText('主题（可选）'), '支付成功');
    fireEvent.change(screen.getByLabelText('正文'), { target: { value: '订单 {{orderId}} 已支付' } });
    fireEvent.change(screen.getByLabelText('变量定义（JSON）'), { target: { value: '{"orderId":"string"}' } });
    fireEvent.change(screen.getByLabelText('预览数据（JSON）'), { target: { value: '{"orderId":"ORDER-1001"}' } });
    await user.selectOptions(screen.getByLabelText('目标状态'), 'active');
    await user.click(screen.getByRole('button', { name: '校验并预览' }));
    expect(screen.getByText('订单 ORDER-1001 已支付')).toBeTruthy();
    await user.type(screen.getByLabelText('一次性复核凭证'), 'p'.repeat(43));
    await user.click(screen.getByLabelText('我已核对渠道、受众、时间、变量和最终预览内容'));
    await user.click(screen.getByRole('button', { name: '审批并提交' }));
    expect(await screen.findByText('服务端已保存')).toBeTruthy();
    expect(reads).toBeGreaterThanOrEqual(2);
  });

  it('keeps a rejected publish inside the dialog without replacing the template workspace', async () => {
    server.use(
      http.put('*/api/v1/notifications/templates/:id', () =>
        HttpResponse.json({ code: 'DEPENDENCY_UNAVAILABLE', message: '通知模板服务暂时不可用。', requestId: 'request:notification-template', retryable: true }, { status: 503 })
      )
    );
    renderRoute();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '新建模板' }));
    await user.type(screen.getByLabelText('事件类型'), 'order.paid');
    fireEvent.change(screen.getByLabelText('正文'), { target: { value: '订单 {{orderId}} 已支付' } });
    fireEvent.change(screen.getByLabelText('变量定义（JSON）'), { target: { value: '{"orderId":"string"}' } });
    fireEvent.change(screen.getByLabelText('预览数据（JSON）'), { target: { value: '{"orderId":"ORDER-1001"}' } });
    await user.click(screen.getByRole('button', { name: '校验并预览' }));
    await user.type(screen.getByLabelText('一次性复核凭证'), 'p'.repeat(43));
    await user.click(screen.getByLabelText('我已核对渠道、受众、时间、变量和最终预览内容'));
    await user.click(screen.getByRole('button', { name: '审批并提交' }));
    expect((await screen.findByRole('alert')).textContent).toContain('依赖服务暂时不可用，请稍后重试');
    expect(screen.getByRole('dialog', { name: '新建通知模板' })).toBeTruthy();
    expect(document.body.textContent).toContain('全部模板');
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

const scope = { kind: 'mall', id: 'mall:one', name: '测试商城' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    accessVersion: 7,
    permissions: ['notification.template.read', 'notification.template.manage', 'notification.announcement.read', 'notification.announcement.manage'],
    capabilities: ['notification.templates.read', 'notification.templates.manage', 'notification.announcements.read', 'notification.announcements.manage'],
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
