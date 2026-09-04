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
import { Component } from './PartnerRoute';

const server = setupServer(http.get('*/api/v1/partners', () => HttpResponse.json({ items: [partner], count: 1 })));
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('PartnerRoute', () => {
  it('renders service-owned supplier scope and qualification summary', async () => {
    renderRoute();
    expect(await screen.findByText('云海供应商')).toBeTruthy();
    expect(screen.getByText('2 项')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: '查看' }));
    expect(screen.getByText('1 / 0 / 0')).toBeTruthy();
  });

  it('creates a real supplier with version, csrf and idempotency protection', async () => {
    server.use(
      http.put('*/api/v1/partners/:id', async ({ request, params }) => {
        expect(request.headers.get('if-match')).toBe('"0"');
        expect(request.headers.get('x-csrf-token')).toBe('csrf-token');
        expect(request.headers.get('idempotency-key')).toBeTruthy();
        expect(await request.json()).toEqual({ kind: 'supplier', name: '新供应商', status: 'pending' });
        return HttpResponse.json({ ...partner, id: String(params.id), name: '新供应商', status: 'pending', version: 0 });
      })
    );
    renderRoute();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '新建供应商' }));
    await user.type(screen.getByLabelText('名称'), '新供应商');
    await user.click(screen.getByRole('button', { name: '预览变更' }));
    await user.click(screen.getByRole('button', { name: '确认保存' }));
    expect(await screen.findByText('保存成功')).toBeTruthy();
  });

  it('adds the Customer tab while exposing only masked fields to read-only operators', async () => {
    server.use(http.get('*/api/v1/partners/customers', () => HttpResponse.json({ items: [customer], count: 1 })));
    renderRoute(customerReadContext);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '客户' }));
    expect(await screen.findByText('华东福利客户')).toBeTruthy();
    expect(screen.getByText('9131****0ABC')).toBeTruthy();
    expect(screen.getByText(/张\*\*/)).toBeTruthy();
    expect(screen.queryByText('13800138000')).toBeNull();
    expect(screen.queryByRole('button', { name: '新建客户' })).toBeNull();
    expect(screen.queryByRole('button', { name: '查看客户' })).toBeNull();
    expect(screen.queryByRole('button', { name: '编辑客户' })).toBeNull();
    expect(screen.queryByRole('button', { name: '停用客户' })).toBeNull();
  });

  it('loads customer details through its dedicated permission without exposing plaintext fields', async () => {
    server.use(
      http.get('*/api/v1/partners/customers', () => HttpResponse.json({ items: [customer], count: 1 })),
      http.get('*/api/v1/partners/customers/:id', () => HttpResponse.json(customer)),
    );
    renderRoute(customerContext);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '客户' }));
    await user.click(await screen.findByRole('button', { name: '查看客户' }));
    expect(await screen.findByText(/有效 · contract:one/)).toBeTruthy();
    expect(screen.getAllByText(/138\*\*\*\*8000/).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('13800138000');
    expect(screen.getByText(/只有明确重填才会由服务端加密替换/)).toBeTruthy();
  });

  it('creates a customer through the precise create permission without reading back plaintext', async () => {
    let body: unknown;
    server.use(
      http.get('*/api/v1/partners/customers', () => HttpResponse.json({ items: [customer], count: 1 })),
      http.post('*/api/v1/partners/customers', async ({ request }) => {
        expect(request.headers.get('x-csrf-token')).toBe('csrf-token');
        expect(request.headers.get('idempotency-key')).toBeTruthy();
        expect(request.headers.get('if-match')).toBeNull();
        body = await request.json();
        return HttpResponse.json({ ...customer, id: 'partnercustomer:created', identifierMasked: '9131****5678', name: '新企业客户', status: 'draft', version: 1 });
      })
    );
    renderRoute(customerContext);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '客户' }));
    await user.click(await screen.findByRole('button', { name: '新建客户' }));
    await user.type(screen.getByLabelText('客户识别号'), '91310000TEST5678');
    await user.type(screen.getByLabelText('客户名称'), '新企业客户');
    await user.type(screen.getByLabelText('姓名'), '王小明');
    await user.type(screen.getByLabelText('手机'), '13900139000');
    await user.click(screen.getByRole('button', { name: '预览影响' }));
    expect(screen.getByRole('region', { name: '客户字段变更预演' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '确认执行' }));
    expect(await screen.findByText('客户已保存')).toBeTruthy();
    expect(body).toEqual({ identifier: '91310000TEST5678', name: '新企业客户', kind: 'enterprise', contact: { kind: 'primary', name: '王小明', phone: '13900139000' } });
    expect(document.body.textContent).not.toContain('13900139000');
  });

  it('previews downstream impact before performing a versioned customer disable', async () => {
    let command: unknown;
    server.use(
      http.get('*/api/v1/partners/customers', () => HttpResponse.json({ items: [customer], count: 1 })),
      http.post('*/api/v1/partners/customers/:id/disable', async ({ request }) => {
        expect(request.headers.get('if-match')).toBe('"3"');
        command = await request.json();
        return HttpResponse.json({ ...customer, status: 'disabled', version: 4 });
      })
    );
    renderRoute(customerContext);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '客户' }));
    await user.click(await screen.findByRole('button', { name: '停用客户' }));
    expect(screen.getByRole('region', { name: '停用影响预演' }).textContent).toContain('从新备券、发券和渠道业务的可选客户中移除');
    await user.type(screen.getByLabelText('操作原因'), '合作协议已到期');
    await user.click(screen.getByRole('button', { name: '预览影响' }));
    await user.click(screen.getByRole('button', { name: '确认执行' }));
    expect(await screen.findByText('客户已保存')).toBeTruthy();
    expect(command).toEqual({ reason: '合作协议已到期' });
  });

  it('preserves the customer draft and rereads authoritative fields after a version conflict', async () => {
    let reads = 0;
    server.use(
      http.get('*/api/v1/partners/customers', () => HttpResponse.json({ items: [{ ...customer, ...(reads++ === 0 ? {} : { name: '人事已更新客户名', version: 4 }) }], count: 1 })),
      http.patch('*/api/v1/partners/customers/:id', () => HttpResponse.json({ code: 'VERSION_CONFLICT', message: 'VERSION_CONFLICT', requestId: 'request:customer-conflict', retryable: true }, { status: 409 }))
    );
    renderRoute(customerContext);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '客户' }));
    await user.click(await screen.findByRole('button', { name: '编辑客户' }));
    await user.clear(screen.getByLabelText('客户名称'));
    await user.type(screen.getByLabelText('客户名称'), '本地草稿客户名');
    await user.click(screen.getByRole('button', { name: '预览影响' }));
    await user.click(screen.getByRole('button', { name: '确认执行' }));
    const conflict = await screen.findByRole('alert', { name: '客户并发冲突' });
    expect(conflict.textContent).toContain('数据版本：第 3 版 → 第 4 版');
    expect(screen.getByLabelText<HTMLInputElement>('客户名称').value).toBe('本地草稿客户名');
    await user.click(screen.getByRole('button', { name: '使用最新状态继续编辑' }));
    expect(screen.getByLabelText<HTMLInputElement>('客户名称').value).toBe('本地草稿客户名');
  });
});

function renderRoute(value: ConsoleContext = context) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <DependencyProvider value={createConsoleDependencies()}>
          <ConsoleContextProvider value={value}>
            <StepupProvider controller={{ request: () => undefined }}>
              <Component />
            </StepupProvider>
          </ConsoleContextProvider>
        </DependencyProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}
const qualification = { valid: 2, pending: 1, rejected: 0, expired: 0, nearest_expiry: '2027-01-01T00:00:00.000Z' };
const partner = { id: 'supplier:one', scope_id: 'enterprise:server', kind: 'supplier', name: '云海供应商', status: 'active', version: 3, qualification, created_at: '2026-09-03T00:00:00.000Z', updated_at: '2026-09-03T00:00:00.000Z' };
const customer = {
  id: 'partnercustomer:one', scopeId: 'enterprise:one', identifierMasked: '9131****0ABC', name: '华东福利客户', kind: 'enterprise', status: 'active', version: 3,
  contacts: [{ id: 'customercontact:one', kind: 'primary', nameMasked: '张**', phoneMasked: '138****8000', emailMasked: null, configured: true, version: 1 }],
  agreement: { id: 'customeragreement:one', contractRef: 'contract:one', contractHash: 'a'.repeat(64), capabilities: ['voucher.issue'], status: 'active', effectiveAt: '2026-01-01T00:00:00.000Z', expiresAt: '2027-01-01T00:00:00.000Z', version: 2 },
  createdAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z',
};
const scope = { kind: 'enterprise', id: 'enterprise:one', name: '测试集团' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    accessVersion: 7,
    permissions: ['partner.read', 'partner.manage'],
    capabilities: ['partner.partners.read', 'partner.partners.manage', 'organization.stores.read', 'organization.stores.manage'],
    target: 'console',
    scope,
    scopes: [scope],
    assurance: { level: 2 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    csrf: 'csrf-token',
    syncedAt: '2026-09-03T00:00:00.000Z',
  },
  profile: { display_name: '管理员', employee_no: 'A001' },
  scope,
  scopes: [scope],
};
const customerReadContext: ConsoleContext = { ...context, session: { ...context.session, permissions: ['partner.read', 'partner.customer.read'], capabilities: ['partner.partners.read', 'partner.customers.list'] } };
const customerContext: ConsoleContext = {
  ...context,
  session: {
    ...context.session,
    permissions: ['partner.read', 'partner.customer.read', 'partner.customer.manage'],
    capabilities: ['partner.partners.read', 'partner.customers.list', 'partner.customers.get', 'partner.customers.create', 'partner.customers.update', 'partner.customers.enable', 'partner.customers.disable'],
  },
};
