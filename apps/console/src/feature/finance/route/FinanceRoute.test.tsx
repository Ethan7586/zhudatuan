import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { ComponentType } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { streamingFile } from '../../../../test/StreamingFile';
import { createConsoleDependencies } from '../../../app/Dependencies';
import { DependencyProvider } from '../../../app/DependencyContext';
import { ConsoleContextProvider } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { StepupProvider } from '../../../entity/session/StepupContext';
import { Component as AuditRoute } from './AuditRoute';
import { Component as EntryRoute } from './EntryRoute';
import { Component as OverviewRoute } from './FinanceRoute';
import { Component as InvoiceRoute } from './InvoiceRoute';
import { Component as ReconciliationRoute } from './ReconciliationRoute';
import { Component as SettlementRoute } from './SettlementRoute';
import { Component as StatementRoute } from './StatementRoute';
import { Component as WithdrawalRoute } from './WithdrawalRoute';

const requests: URL[] = [];
const overviewReads: string[] = [];
const writes: string[] = [];
let command: Readonly<{ body: unknown; headers: Headers }> | undefined;
const sectionCommands: Readonly<{ operation: string; body: unknown; headers: Headers }>[] = [];
const financeImportCommands: Readonly<{ operation: string; body: unknown; headers: Headers }>[] = [];
const row = {
  id: 'reconciliation:wechat:1',
  scope_id: 'enterprise:1',
  provider: 'wechat_pay',
  partner_id: 'mall:1',
  period: '2026-08-24',
  statement_ref: 'statement:1',
  statement_hash: 'a'.repeat(64),
  state: 'difference',
  debit_minor: 31_500,
  credit_minor: 19_600,
  difference_minor: 11_900,
  created_by: 'membership:maker',
  approved_by: null,
  evidence: { statementReference: 'channelstatement:wechat:1', receivedAt: '2026-08-24T13:20:00.000Z', statementHash: 'a'.repeat(64) },
  updated_at: '2026-08-24T13:26:00.000Z',
  version: 7,
  item_counts: { matched: 2, difference: 1 },
  items: [
    {
      id: 'reconciliationdifference:1',
      externalMinor: 11_900,
      internalMinor: 0,
      differenceMinor: 11_900,
      state: 'difference',
      reasonCode: 'INTERNAL_REFERENCE_MISSING',
      evidence: { paymentReference: 'payment:wechat:1', channelLine: 'WX-20260824-0119', matchRule: 'provider-reference' },
      resolution: null,
      resolvedBy: null,
      approvedBy: null,
    },
  ],
} as const;

const server = setupServer(
  http.get('*/api/v1/finance/overview', ({ request }) => {
    overviewReads.push(new URL(request.url).pathname);
    return HttpResponse.json({
      items: [{ currency: 'CNY', balance_minor: 78_599_300, liability_minor: 13_826_400, income_minor: 24_863_200, expense_minor: 6_961_696, cash_minor: 31_500, journal_count: 18_642, watermark: '2026-08-24T13:26:00.000Z' }],
    });
  }),
  http.get('*/api/v1/finance/facets', ({ request }) => {
    overviewReads.push(new URL(request.url).pathname);
    return HttpResponse.json(facets());
  }),
  http.get('*/api/v1/finance/audit', ({ request }) => {
    requests.push(new URL(request.url));
    return HttpResponse.json(audit());
  }),
  http.get('*/api/v1/finance/reconciliations', ({ request }) => {
    requests.push(new URL(request.url));
    return HttpResponse.json({ items: [row], count: 1, nextCursor: 'cursor:next' });
  }),
  http.get('*/api/v1/finance/entries', ({ request }) => {
    requests.push(new URL(request.url));
    return HttpResponse.json({
      items: [
        { id: 'entry:debit:1', side: 'debit', amount_minor: 12_300, code: 'cash.receivable', currency: 'CNY', reference_type: 'order', reference_id: 'order:1', description: '订单应收款入账', posted_at: '2026-09-01T08:00:00.000Z' },
        { id: 'entry:credit:1', side: 'credit', amount_minor: 12_300, code: 'sales.income', currency: 'CNY', reference_type: 'order', reference_id: 'order:1', description: '商品收入入账', posted_at: '2026-09-01T08:00:00.000Z' },
      ],
      count: 2,
    });
  }),
  http.get('*/api/v1/finance/statements', ({ request }) => {
    requests.push(new URL(request.url));
    return HttpResponse.json(statementPage());
  }),
  http.post('*/api/v1/finance/statements/exports', async ({ request }) => {
    sectionCommands.push({ operation: 'statementexport', body: await request.json(), headers: request.headers });
    return HttpResponse.json({
      id: 'export:statement:1',
      scope: 'enterprise:1',
      report: 'finance.statement',
      filter: {},
      state: 'queued',
      cursor: null,
      recordCount: 0,
      objectReference: null,
      objectHash: null,
      objectSize: null,
      scanState: null,
      expiresAt: null,
      createdAt: '2026-09-01T09:00:00.000Z',
      generatedAt: null,
    });
  }),
  http.get('*/api/v1/finance/settlements', ({ request }) => {
    requests.push(new URL(request.url));
    return HttpResponse.json({ items: [settlement()], count: 1 });
  }),
  http.post('*/api/v1/finance/settlements/:id/decide', async ({ request }) => {
    sectionCommands.push({ operation: 'settlementdecide', body: await request.json(), headers: request.headers });
    return HttpResponse.json({ ...settlement(), lines: undefined, splits: undefined, adjustments: undefined, state: 'payable', approved_by: 'membership:checker', approved_at: '2026-09-01T10:00:00.000Z', version: 4 });
  }),
  http.get('*/api/v1/finance/withdrawals', ({ request }) => {
    requests.push(new URL(request.url));
    return HttpResponse.json({ items: [withdrawal()], count: 1 });
  }),
  http.post('*/api/v1/finance/withdrawals', async ({ request }) => {
    sectionCommands.push({ operation: 'withdrawalcreate', body: await request.json(), headers: request.headers });
    return HttpResponse.json({ ...withdrawal(), id: 'withdrawal:new', state: 'submitted', version: 0 }, { status: 201 });
  }),
  http.post('*/api/v1/finance/withdrawals/:id/recover', async ({ request }) => {
    sectionCommands.push({ operation: 'withdrawalrecover', body: await request.json(), headers: request.headers });
    return HttpResponse.json({ ...withdrawal(), state: 'approved', version: 6 }, { status: 202 });
  }),
  http.post('*/api/v1/finance/withdrawals/:id/decide', async ({ request }) => {
    sectionCommands.push({ operation: 'withdrawaldecide', body: await request.json(), headers: request.headers });
    return HttpResponse.json({ ...withdrawal(), state: 'approved', version: 6 });
  }),
  http.get('*/api/v1/invoices/requests', ({ request }) => {
    requests.push(new URL(request.url));
    return HttpResponse.json({ items: [invoiceRequest()], count: 1 });
  }),
  http.delete('*/api/v1/invoices/requests/:id', ({ request }) => {
    sectionCommands.push({ operation: 'invoicecancel', body: {}, headers: request.headers });
    return HttpResponse.json({ ...invoiceRequest(), object_ref: undefined, sha256: undefined, issued_at: undefined, lines: undefined, state: 'cancelled', version: 3 });
  }),
  http.post('*/api/v1/invoices/requests/:id/decide', async ({ request }) => {
    sectionCommands.push({ operation: 'invoicedecide', body: await request.json(), headers: request.headers });
    return HttpResponse.json({ ...invoiceRequest(), object_ref: undefined, sha256: undefined, issued_at: undefined, lines: undefined, state: 'approved', approved_by: 'membership:checker', version: 3 });
  }),
  http.post('*/api/v1/invoices/requests/:id/red', async ({ request }) => {
    sectionCommands.push({ operation: 'invoicered', body: await request.json(), headers: request.headers });
    const source = invoiceRequest();
    return HttpResponse.json({ ...source, object_ref: undefined, sha256: undefined, issued_at: undefined, lines: undefined, id: 'invoice:red:1', state: 'submitted', kind: 'red', red_of_request_id: source.id, version: 0 });
  }),
  http.get('*/api/v1/channels/connections', ({ request }) => {
    financeImportCommands.push({ operation: 'connections', body: {}, headers: request.headers });
    return HttpResponse.json({ items: [statementConnection()], count: 1 });
  }),
  http.post('*/api/v1/runtime/uploads', async ({ request }) => {
    const body = (await request.json()) as Readonly<{ name: string; contentType: string; size: number; sha256: string }>;
    financeImportCommands.push({ operation: 'uploadintent', body, headers: request.headers });
    return HttpResponse.json({
      reference: 'object:finance/statement.csv',
      path: 'imports/finance/statement.csv',
      sha256: body.sha256,
      size: body.size,
      contentType: body.contentType,
      retentionUntil: '2099-09-05T00:00:00.000Z',
      upload: { url: 'https://objects.test/imports/finance/statement.csv', method: 'PUT', headers: { 'content-type': body.contentType }, expiresAt: '2099-09-05T00:00:00.000Z' },
    });
  }),
  http.put('https://objects.test/imports/finance/statement.csv', ({ request }) => {
    financeImportCommands.push({ operation: 'objectupload', body: {}, headers: request.headers });
    return new HttpResponse(null, { status: 204 });
  }),
  http.post('*/api/v1/finance/statement-imports', async ({ request }) => {
    financeImportCommands.push({ operation: 'statementimport', body: await request.json(), headers: request.headers });
    return HttpResponse.json(statementImport('uploaded'), { status: 202 });
  }),
  http.get('*/api/v1/finance/statement-imports/:id', ({ request }) => {
    financeImportCommands.push({ operation: 'statementimportread', body: {}, headers: request.headers });
    return HttpResponse.json({
      ...statementImport('ready'),
      total_count: 2,
      validation_summary: { columns: ['reference', 'type', 'amountMinor', 'taxMinor', 'occurredAt'], previewHash: 'f'.repeat(64) },
      last_error: null,
      errors: [],
    });
  }),
  http.put('*/api/v1/finance/reconciliations/:id', async ({ request }) => {
    writes.push(request.method);
    command = { body: await request.json(), headers: request.headers };
    return HttpResponse.json({
      id: 'reconciliationdifference:1',
      reconciliation_id: row.id,
      statement_line_id: 'statementline:1',
      scope_id: 'enterprise:1',
      internal_type: null,
      internal_id: null,
      external_minor: 11_900,
      internal_minor: 0,
      difference_minor: 11_900,
      state: 'resolutionpending',
      reason_code: 'INTERNAL_REFERENCE_MISSING',
      evidence: {},
      resolution: { reason: '渠道回单已核验' },
      resolved_by: 'actor:finance',
      approved_by: null,
      resolved_at: '2026-08-24T13:30:00.000Z',
      approved_at: null,
      version: 8,
    });
  }),
  http.all('*/api/v1/finance/**', ({ request }) => {
    writes.push(request.method);
    return HttpResponse.json({ code: 'UNEXPECTED_FINANCE_WRITE' }, { status: 500 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  requests.length = 0;
  overviewReads.length = 0;
  writes.length = 0;
  command = undefined;
  sectionCommands.length = 0;
  financeImportCommands.length = 0;
});
afterAll(() => server.close());

describe('Finance MVVM workspace', () => {
  it.each([
    ['财务总览', '/finance', OverviewRoute],
    ['账单', '/finance/statements', StatementRoute],
    ['对账', '/finance/reconciliations', ReconciliationRoute],
    ['财务审计', '/finance/audit?reference=order%3Aone', AuditRoute],
  ] as const)('requires clear second verification before reading %s data', async (title, entry, Route) => {
    renderRoute(entry, Route, {
      ...context,
      session: {
        ...context.session,
        permissions: [...context.session.permissions, 'finance.statement.read', 'audit.read'],
        capabilities: [...context.session.capabilities, 'finance.statements.read', 'finance.audit.read'],
        assurance: { level: 1 },
      },
    });

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(screen.getByText(/请先完成短信二次验证/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '立即完成二次验证' })).toBeTruthy();
    expect(overviewReads).toHaveLength(0);
    expect(requests).toHaveLength(0);
  });

  it('links facts, events and audit evidence by URL business reference while keeping technical trace collapsed', async () => {
    renderRoute('/finance/audit?reference=order%3Aone&campaign=keep', AuditRoute, auditContext);
    expect(await screen.findByRole('heading', { level: 1, name: '财务审计' })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: '业务事实链' })).toBeTruthy();
    expect(screen.getAllByText('账本凭证').length).toBeGreaterThan(0);
    expect(screen.getByText('账务分录已入账')).toBeTruthy();
    expect(screen.getByText('业务操作证据')).toBeTruthy();
    expect(screen.getByText('订单应收会计分录')).toBeTruthy();
    expect(screen.getByText('结算单已冻结')).toBeTruthy();
    expect(screen.getByText('电子发票已开具')).toBeTruthy();
    expect(screen.getByText('差异修复待复核')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '复制追踪编号' })).toHaveLength(2);
    expect(screen.getByText('查看事件技术信息').closest('details')?.hasAttribute('open')).toBe(false);
    expect(requests.some((url) => url.pathname.endsWith('/finance/audit') && url.searchParams.get('reference') === 'order:one')).toBe(true);
    expect(currentParams().get('campaign')).toBe('keep');
  });

  it('hides business audit governance navigation without both audit permission and capability', async () => {
    renderRoute('/finance', OverviewRoute);
    await screen.findByRole('heading', { level: 1, name: '财务总览' });
    expect(screen.queryByRole('button', { name: /业务审计/ })).toBeNull();
  });

  it('fails closed on a direct audit route without operation access', async () => {
    renderRoute('/finance/audit?reference=order%3Aone', AuditRoute, context);
    expect(await screen.findByText('当前账号没有查询财务业务证据链的权限。')).toBeTruthy();
    expect(requests).toHaveLength(0);
  });

  it('shows the authoritative overview instead of invented empty metrics', async () => {
    renderRoute('/finance', OverviewRoute);
    expect(await screen.findByRole('heading', { level: 1, name: '财务总览' })).toBeTruthy();
    expect((await screen.findAllByText('¥785,993.00')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('18,642')).toHaveLength(2);
    expect(screen.queryByText('服务端未提供')).toBeNull();
    expect(screen.queryByRole('button', { name: '发起对账' })).toBeNull();
    const navigation = screen.getByRole('navigation', { name: '财务工作台' });
    expect(
      within(navigation)
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['概览', '账单', '对账', '结算', '提现', '发票']);
    expect(within(navigation).queryByRole('button', { name: '导入账单' })).toBeNull();
    await waitFor(() => expect([...overviewReads].sort()).toEqual(['/api/v1/finance/facets', '/api/v1/finance/overview']));
  });

  it('keeps facets, navigation and the finance entry usable when only overview fails', async () => {
    server.use(
      http.get('*/api/v1/finance/overview', ({ request }) => {
        overviewReads.push(new URL(request.url).pathname);
        return HttpResponse.json({ code: 'FINANCE_OVERVIEW_DELAYED', message: '财务总览暂时不可用。', requestId: 'trace:finance-overview' }, { status: 503 });
      })
    );
    renderRoute('/finance', OverviewRoute);

    expect(await screen.findByRole('heading', { level: 1, name: '财务总览' })).toBeTruthy();
    expect(await screen.findByRole('region', { name: '财务筛选范围摘要' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: '财务工作台' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: '重试' })).toBeTruthy();
    expect(overviewReads).toContain('/api/v1/finance/facets');
  });

  it('prefetches only a permitted adjacent tab and keeps the current tab usable when that prefetch fails', async () => {
    const sectionReads: string[] = [];
    server.use(
      http.get('*/api/v1/finance/statements', ({ request }) => {
        sectionReads.push(new URL(request.url).pathname);
        return HttpResponse.json({
          items: [
            {
              id: 'statement:1',
              scope_id: 'enterprise:1',
              period_start: '2026-08-01',
              period_end: '2026-08-31',
              currency: 'CNY',
              opening_minor: 1_000,
              debit_minor: 600,
              credit_minor: 200,
              closing_minor: 1_400,
              state: 'final',
              object_ref: null,
              sha256: null,
              generated_at: '2026-09-01T00:00:00.000Z',
            },
          ],
          count: 1,
        });
      }),
      http.get('*/api/v1/finance/reconciliations', ({ request }) => {
        sectionReads.push(new URL(request.url).pathname);
        return HttpResponse.json({ code: 'INTERNAL_ERROR' }, { status: 503 });
      })
    );
    renderRoute('/finance/statements', StatementRoute, statementContext);

    expect(await screen.findByRole('table', { name: '账单' })).toBeTruthy();
    expect(screen.getByText('2026年8月1–31日')).toBeTruthy();
    await waitFor(() => expect(sectionReads).toEqual(['/api/v1/finance/statements', '/api/v1/finance/reconciliations']));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(overviewReads).toHaveLength(0);
  });

  it('filters immutable entries on the current page, opens authoritative detail and deep-links to audit evidence', async () => {
    const user = userEvent.setup();
    renderRoute('/finance/entries?campaign=keep', EntryRoute, operationsContext);
    expect(await screen.findByRole('table', { name: '账本分录' })).toBeTruthy();
    expect(screen.getByText('借方分录')).toBeTruthy();
    await user.selectOptions(screen.getByRole('combobox', { name: '筛选本页状态' }), 'credit');
    expect(currentParams().get('status')).toBe('credit');
    expect(screen.queryByText('借方分录')).toBeNull();
    expect(screen.getByText('贷方分录')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '查看详情' }));
    const drawer = await screen.findByRole('dialog', { name: '财务记录详情' });
    expect(within(drawer).getByText('商品收入入账')).toBeTruthy();
    expect(within(drawer).getByText('¥123.00')).toBeTruthy();
    await user.click(within(drawer).getByRole('button', { name: '查看业务证据链' }));
    await waitFor(() => expect(screen.getByTestId('finance-location').textContent).toContain('/finance/audit?reference=order%3A1'));
  });

  it('exports statement filters once with scope, proof, version and idempotency then rereads the list', async () => {
    const user = userEvent.setup();
    renderRoute('/finance/statements', StatementRoute, operationsContext);
    expect(await screen.findByRole('table', { name: '账单' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '导出账单' }));
    const dialog = await screen.findByRole('dialog', { name: '导出账单' });
    await user.type(within(dialog).getByLabelText('开始日期'), '2026-08-01');
    await user.type(within(dialog).getByLabelText('结束日期'), '2026-08-31');
    await user.type(within(dialog).getByLabelText('币种'), 'cny');
    await user.selectOptions(within(dialog).getByLabelText('账单状态'), 'final');
    await user.type(within(dialog).getByLabelText('一次性操作凭证'), 'p'.repeat(43));
    await user.click(within(dialog).getByRole('checkbox', { name: /我已核对操作对象/ }));
    const submit = within(dialog).getByRole('button', { name: '确认导出账单' });
    await user.dblClick(submit);

    expect(await screen.findByRole('heading', { name: '操作已完成' })).toBeTruthy();
    expect(sectionCommands).toHaveLength(1);
    expect(sectionCommands[0]?.body).toEqual({ periodStart: '2026-08-01', periodEnd: '2026-08-31', currency: 'CNY', state: 'final' });
    expect(sectionCommands[0]?.headers.get('if-match')).toBe('"0"');
    expect(sectionCommands[0]?.headers.get('x-action-proof')).toBe('p'.repeat(43));
    expect(sectionCommands[0]?.headers.get('idempotency-key')).toBeTruthy();
  });

  it('imports a statement through Channel Catalog, safe upload and authoritative server preflight before task confirmation', async () => {
    const user = userEvent.setup();
    renderRoute('/finance/statements', StatementRoute, operationsContext);
    await screen.findByRole('table', { name: '账单' });
    await user.click(screen.getByRole('button', { name: '导入账单' }));
    let dialog = await screen.findByRole('dialog', { name: '导入渠道账单' });
    expect(within(dialog).getByText('渠道账单标准模板')).toBeTruthy();
    await waitFor(() => expect(within(dialog).getByRole('option', { name: '自有供应商 · 标准供应商' })).toBeTruthy());
    await user.selectOptions(within(dialog).getByLabelText('账单来源渠道'), 'supplier');
    expect(within(dialog).getByText('连接健康')).toBeTruthy();
    expect(within(dialog).getByText('supplier.v1')).toBeTruthy();
    expect(within(dialog).getByText('reference、type、amountMinor、taxMinor、occurredAt')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: '下一步：上传文件' }));

    dialog = screen.getByRole('dialog', { name: '导入渠道账单' });
    const file = streamingFile('reference,type,amountMinor,taxMinor,occurredAt\npayment:1,payment,1000,0,2026-08-01T00:00:00.000Z\n', 'statement.csv', 'text/csv');
    await user.upload(within(dialog).getByLabelText('选择账单文件'), file);
    await user.click(within(dialog).getByRole('button', { name: '下一步：核对映射' }));

    dialog = screen.getByRole('dialog', { name: '导入渠道账单' });
    expect(within(dialog).getByRole('table', { name: '账单字段映射' })).toBeTruthy();
    await user.type(within(dialog).getByLabelText('结算伙伴'), 'supplier:one');
    await user.type(within(dialog).getByLabelText('账期开始'), '2026-08-01');
    await user.type(within(dialog).getByLabelText('账期结束'), '2026-08-31');
    await user.type(within(dialog).getByLabelText('期初余额（分）'), '1000');
    await user.type(within(dialog).getByLabelText('期末余额（分）'), '2000');
    await user.click(within(dialog).getByRole('checkbox', { name: /我已核对来源、账期和余额/ }));
    await user.dblClick(within(dialog).getByRole('button', { name: '提交并开始服务端预检' }));

    expect(await within(dialog).findByRole('heading', { name: '预检完成，等待确认执行' })).toBeTruthy();
    expect(financeImportCommands.map(({ operation }) => operation)).toEqual(['connections', 'uploadintent', 'objectupload', 'statementimport', 'statementimportread']);
    const upload = financeImportCommands.find(({ operation }) => operation === 'uploadintent');
    const created = financeImportCommands.find(({ operation }) => operation === 'statementimport');
    expect(upload?.body).toMatchObject({ name: 'statement.csv', contentType: 'text/csv', size: file.size });
    expect(created?.body).toEqual({
      objectRef: 'object:finance/statement.csv',
      sha256: (upload?.body as Readonly<{ sha256: string }>).sha256,
      fileName: 'statement.csv',
      provider: 'supplier',
      partnerId: 'supplier:one',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      currency: 'CNY',
      openingMinor: 1000,
      closingMinor: 2000,
    });
    expect(created?.headers.get('idempotency-key')).toBeTruthy();
    expect(created?.headers.get('x-scope-hint')).toBe('enterprise:1');
    expect(writes).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: '前往核对并确认执行' }));
    await waitFor(() => expect(screen.getByTestId('finance-location').textContent).toContain('/scopes/enterprise/enterprise%3A1/imports/finance/import%3Afinance%3A1'));
  });

  it('blocks statement import when Channel Catalog has no healthy enabled Statement provider', async () => {
    server.use(http.get('*/api/v1/channels/connections', () => HttpResponse.json({ items: [{ ...statementConnection(), health_state: 'unhealthy', health_reason: 'PROVIDER_TIMEOUT' }], count: 1 })));
    const user = userEvent.setup();
    renderRoute('/finance/statements', StatementRoute, operationsContext);
    await user.click(await screen.findByRole('button', { name: '导入账单' }));
    const dialog = await screen.findByRole('dialog', { name: '导入渠道账单' });
    expect(await within(dialog).findByText('暂无可用账单渠道')).toBeTruthy();
    expect(within(dialog).getByText('当前范围的账单渠道尚未启用，或最近一次健康检查未通过。')).toBeTruthy();
    expect(within(dialog).queryByLabelText('账单来源渠道')).toBeNull();
    expect(within(dialog).getByRole<HTMLButtonElement>('button', { name: '下一步：上传文件' }).disabled).toBe(true);
    expect(financeImportCommands).toHaveLength(0);
  });

  it('shows complete settlement facts and executes a version-bound checker decision', async () => {
    const user = userEvent.setup();
    renderRoute('/finance/settlements', SettlementRoute, operationsContext);
    await user.click(await screen.findByRole('button', { name: '查看详情' }));
    const drawer = await screen.findByRole('dialog', { name: '财务记录详情' });
    expect(within(drawer).getByText('¥1,200.00')).toBeTruthy();
    expect(within(drawer).getByText('3 条')).toBeTruthy();
    await user.click(within(drawer).getByRole('button', { name: '批准结算' }));
    const dialog = await screen.findByRole('dialog', { name: '批准结算' });
    await user.type(within(dialog).getByLabelText('业务原因'), '账单和分账证据核对一致');
    await user.type(within(dialog).getByLabelText('一次性操作凭证'), 'p'.repeat(43));
    expect(within(dialog).getByLabelText<HTMLInputElement>('一次性操作凭证').value.length).toBe(43);
    await user.click(within(dialog).getByRole('checkbox', { name: /我已核对操作对象/ }));
    const approve = within(dialog).getByRole<HTMLButtonElement>('button', { name: '确认批准结算' });
    expect({ disabled: approve.disabled, proof: within(dialog).getByLabelText<HTMLInputElement>('一次性操作凭证').value.length, validation: dialog.querySelector('.financeactionvalidation')?.textContent }).toEqual({
      disabled: false,
      proof: 43,
      validation: undefined,
    });
    await user.click(approve);
    await waitFor(() => expect(sectionCommands).toHaveLength(1));
    expect(screen.queryByRole('alert')?.textContent).toBeFalsy();
    expect(await screen.findByRole('heading', { name: '操作已完成' })).toBeTruthy();
    expect(sectionCommands[0]?.body).toEqual({ decision: 'approved', reason: '账单和分账证据核对一致' });
    expect(sectionCommands[0]?.headers.get('if-match')).toBe('"3"');
  });

  it('creates a withdrawal with integer minor units and keeps provider recovery facts discoverable', async () => {
    const user = userEvent.setup();
    renderRoute('/finance/withdrawals', WithdrawalRoute, operationsContext);
    expect(await screen.findByRole('table', { name: '提现' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '申请提现' }));
    const dialog = await screen.findByRole('dialog', { name: '申请提现' });
    await user.type(within(dialog).getByLabelText('结算单编号'), 'settlement:1');
    await user.type(within(dialog).getByLabelText('提现金额（分）'), '8800');
    await user.type(within(dialog).getByLabelText('收款目标引用'), 'bankaccount:1');
    await user.type(within(dialog).getByLabelText('业务原因'), '供应商本期结算提现');
    await user.type(within(dialog).getByLabelText('一次性操作凭证'), 'p'.repeat(43));
    await user.click(within(dialog).getByRole('checkbox', { name: /我已核对操作对象/ }));
    await user.click(within(dialog).getByRole('button', { name: '确认申请提现' }));
    expect(await screen.findByRole('heading', { name: '操作已完成' })).toBeTruthy();
    expect(sectionCommands[0]?.body).toEqual({ settlement: 'settlement:1', amountMinor: 8800, destinationRef: 'bankaccount:1', reason: '供应商本期结算提现' });
  });

  it('shows provider failure evidence and recovers a withdrawal with proof and version control', async () => {
    const user = userEvent.setup();
    renderRoute('/finance/withdrawals', WithdrawalRoute, operationsContext);
    await user.click(await screen.findByRole('button', { name: '查看详情' }));
    const drawer = await screen.findByRole('dialog', { name: '财务记录详情' });
    expect(within(drawer).getByText('微信')).toBeTruthy();
    expect(within(drawer).getAllByText('失败').length).toBeGreaterThan(0);
    await user.click(within(drawer).getByRole('button', { name: '恢复提现' }));
    const dialog = await screen.findByRole('dialog', { name: '恢复提现' });
    await user.type(within(dialog).getByLabelText('业务原因'), '渠道异常已核实且收款目标有效');
    await user.type(within(dialog).getByLabelText('一次性操作凭证'), 'r'.repeat(43));
    await user.click(within(dialog).getByRole('checkbox', { name: /我已核对操作对象/ }));
    await user.click(within(dialog).getByRole('button', { name: '确认恢复提现' }));
    expect(await screen.findByRole('heading', { name: '操作已完成' })).toBeTruthy();
    expect(sectionCommands[0]?.operation).toBe('withdrawalrecover');
    expect(sectionCommands[0]?.body).toEqual({ reason: '渠道异常已核实且收款目标有效' });
    expect(sectionCommands[0]?.headers.get('if-match')).toBe('"5"');
    expect(sectionCommands[0]?.headers.get('x-action-proof')).toBe('r'.repeat(43));
  });

  it('opens an invoice request with source facts and performs only its permitted real action', async () => {
    const user = userEvent.setup();
    renderRoute('/finance/invoices', InvoiceRoute, operationsContext);
    await user.click(await screen.findByRole('button', { name: '查看详情' }));
    const drawer = await screen.findByRole('dialog', { name: '财务记录详情' });
    expect(within(drawer).getByText('发票')).toBeTruthy();
    expect(within(drawer).getByText('2 条')).toBeTruthy();
    await user.click(within(drawer).getByRole('button', { name: '取消申请' }));
    const dialog = await screen.findByRole('dialog', { name: '取消申请' });
    expect(within(dialog).queryByLabelText('一次性操作凭证')).toBeNull();
    await user.click(within(dialog).getByRole('checkbox', { name: /我已核对操作对象/ }));
    const cancel = within(dialog).getByRole<HTMLButtonElement>('button', { name: '确认取消申请' });
    expect({ disabled: cancel.disabled, validation: dialog.querySelector('.financeactionvalidation')?.textContent }).toEqual({ disabled: false, validation: undefined });
    await user.click(cancel);
    expect(await screen.findByRole('heading', { name: '操作已完成' })).toBeTruthy();
    expect(sectionCommands).toHaveLength(1);
    expect(sectionCommands[0]?.headers.get('if-match')).toBe('"2"');
  });

  it('offers red issuance only for an issued original invoice and rereads after the real command', async () => {
    server.use(
      http.get('*/api/v1/invoices/requests', ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json({ items: [{ ...invoiceRequest(), state: 'issued', issued_at: '2026-09-01T09:00:00.000Z' }], count: 1 });
      })
    );
    const user = userEvent.setup();
    renderRoute('/finance/invoices', InvoiceRoute, operationsContext);
    await user.click(await screen.findByRole('button', { name: '查看详情' }));
    const drawer = await screen.findByRole('dialog', { name: '财务记录详情' });
    expect(within(drawer).queryByRole('button', { name: '取消申请' })).toBeNull();
    await user.click(within(drawer).getByRole('button', { name: '申请红冲' }));
    const dialog = await screen.findByRole('dialog', { name: '申请红冲' });
    expect(within(dialog).queryByLabelText('一次性操作凭证')).toBeNull();
    await user.type(within(dialog).getByLabelText('业务原因'), '原发票信息有误，按审批结果红冲');
    await user.click(within(dialog).getByRole('checkbox', { name: /我已核对操作对象/ }));
    await user.click(within(dialog).getByRole('button', { name: '确认申请红冲' }));
    expect(await screen.findByRole('heading', { name: '操作已完成' })).toBeTruthy();
    expect(sectionCommands[0]?.operation).toBe('invoicered');
    expect(sectionCommands[0]?.body).toEqual({ reason: '原发票信息有误，按审批结果红冲' });
    expect(sectionCommands[0]?.headers.get('if-match')).toBeNull();
    expect(requests.filter(({ pathname }) => pathname.endsWith('/invoices/requests'))).toHaveLength(2);
  });

  it('retains the authoritative reconciliation list and URL-driven detail', async () => {
    const user = userEvent.setup();
    renderRoute('/finance/reconciliations?campaign=keep', ReconciliationRoute);
    expect(await screen.findByRole('table', { name: '支付对账批次' })).toBeTruthy();
    expect(screen.getByText(/^对账批次 \d{4} \d{4}$/)).toBeTruthy();
    expect(screen.getByText('微信支付')).toBeTruthy();
    expect(screen.queryByText(row.id)).toBeNull();
    expect(screen.getByText('¥119.00')).toBeTruthy();
    expect(requests[0]?.searchParams.get('limit')).toBe('50');

    await user.click(screen.getByRole('checkbox', { name: /^选择对账批次 \d{4} \d{4}$/ }));
    expect(currentParams().get('selected')).toBeNull();
    await user.click(screen.getByRole('button', { name: '查看差异' }));
    const drawer = await screen.findByRole('dialog', { name: '对账差异详情' });
    expect(currentParams().get('selected')).toBe(row.id);
    expect(currentParams().get('campaign')).toBe('keep');
    expect(within(drawer).getByText('内部引用缺失')).toBeTruthy();
    expect(within(drawer).getAllByText('¥119.00').length).toBeGreaterThanOrEqual(2);
    expect(within(drawer).getByRole('region', { name: '匹配证据' })).toBeTruthy();
    expect(within(drawer).getByText('支付凭证')).toBeTruthy();
    expect(within(drawer).getByText('尚未复核')).toBeTruthy();
    expect(within(drawer).getByText('审批与修复状态轨迹')).toBeTruthy();
    await user.click(within(drawer).getByRole('button', { name: '预览处理建议' }));
    expect(within(drawer).getByRole('region', { name: '处理建议预览' }).textContent).toContain('补齐业务映射后重新匹配');
    expect(within(drawer).getByText(/不会提交、审批、记账或改变当前状态/)).toBeTruthy();
    expect(writes).toHaveLength(0);
    expect(currentParams().get('selected')).toBe(row.id);
    expect(within(drawer).queryByText('最终动作未接入')).toBeNull();
    expect(within(drawer).queryByRole('button', { name: '保存草稿' })).toBeNull();
    await user.click(within(drawer).getByRole('button', { name: '关闭差异详情' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes).toHaveLength(0);
  });

  it('keeps supported server facet filters, removes unsupported search state and exposes only the six primary sections', async () => {
    renderRoute('/finance/reconciliations?q=demo&channel=wechat&reconPeriod=2026-08-24&campaign=keep', ReconciliationRoute);
    await screen.findByRole('table', { name: '支付对账批次' });
    await screen.findByRole('form', { name: '对账筛选' });
    await waitFor(() => expect(currentParams().get('channel')).toBe('wechat'));
    expect(currentParams().has('q')).toBe(false);
    expect(currentParams().get('reconPeriod')).toBe('2026-08-24');
    expect(currentParams().get('campaign')).toBe('keep');
    expect(screen.queryByRole('textbox', { name: '搜索对账记录' })).toBeNull();
    expect(screen.getAllByRole('navigation', { name: '财务工作台' })[0]?.querySelectorAll('button')).toHaveLength(6);
    expect(screen.queryByText('退款对账')).toBeNull();
    expect(requests.some((url) => url.searchParams.get('provider') === 'wechat' && url.searchParams.get('period') === '2026-08-24')).toBe(true);
    expect(requests.every((url) => !url.searchParams.has('q'))).toBe(true);
  });

  it('keeps the reconciliation workspace usable when only the facet query fails', async () => {
    server.use(http.get('*/api/v1/finance/facets', () => HttpResponse.json({ code: 'INTERNAL_ERROR' }, { status: 503 })));
    const user = userEvent.setup();
    renderRoute('/finance/reconciliations', ReconciliationRoute);

    expect(await screen.findByRole('table', { name: '支付对账批次' })).toBeTruthy();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('依赖服务暂时不可用，请稍后重试。')).toBeTruthy();
    expect(within(alert).getByRole('button', { name: '重新读取' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '查看差异' }));
    expect(await screen.findByRole('dialog', { name: '对账差异详情' })).toBeTruthy();
  });

  it('executes a permitted reconciliation command with confirmation, proof, version and authoritative reread', async () => {
    const user = userEvent.setup();
    renderRoute('/finance/reconciliations', ReconciliationRoute, authorizedContext);
    await user.click(await screen.findByRole('button', { name: '查看差异' }));
    const drawer = await screen.findByRole('dialog', { name: '对账差异详情' });
    await user.selectOptions(within(drawer).getByLabelText('处理方式'), 'resolve');
    await user.type(within(drawer).getByLabelText('处理原因'), '渠道回单已核验');
    await user.type(within(drawer).getByLabelText('一次性操作凭证'), 'a'.repeat(43));
    await user.click(within(drawer).getByRole('checkbox', { name: /我已核对批次/ }));
    await user.click(within(drawer).getByRole('button', { name: '提交差异处理' }));
    expect(await within(drawer).findByRole('heading', { name: '操作已完成' })).toBeTruthy();
    expect(command?.body).toEqual({ action: 'resolve', item: 'reconciliationdifference:1', reason: '渠道回单已核验' });
    expect(command?.headers.get('if-match')).toBe('"7"');
    expect(command?.headers.get('x-action-proof')).toBe('a'.repeat(43));
    expect(requests).toHaveLength(2);
  });
});

const context: ConsoleContext = {
  session: {
    actor: 'actor:finance',
    membership: 'membership:finance',
    accessVersion: 7,
    permissions: ['finance.overview.read', 'finance.reconciliation.read'],
    capabilities: ['finance.overview.read', 'finance.facets.read', 'finance.reconciliations.read'],
    target: 'console',
    scope: { kind: 'enterprise', id: 'enterprise:1' },
    scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
    assurance: { level: 3 },
    security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null },
    syncedAt: '2026-08-24T13:31:00.000Z',
  },
  profile: { display_name: '测试财务', employee_no: null },
  scope: { kind: 'enterprise', id: 'enterprise:1' },
  scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
};
const authorizedContext: ConsoleContext = {
  ...context,
  session: { ...context.session, csrf: 'csrf:finance', permissions: [...context.session.permissions, 'finance.reconciliation.manage'], capabilities: [...context.session.capabilities, 'finance.reconciliations.manage'] },
};
const auditContext: ConsoleContext = { ...context, session: { ...context.session, permissions: [...context.session.permissions, 'audit.read'], capabilities: [...context.session.capabilities, 'finance.audit.read'] } };
const statementContext: ConsoleContext = { ...context, session: { ...context.session, permissions: ['finance.statement.read', 'finance.reconciliation.read'], capabilities: ['finance.statements.read', 'finance.reconciliations.read'] } };
const operationsContext: ConsoleContext = {
  ...context,
  session: {
    ...context.session,
    csrf: 'csrf:finance',
    permissions: [
      'audit.read',
      'finance.entry.read',
      'finance.statement.read',
      'finance.statement.export',
      'finance.reconciliation.read',
      'finance.settlement.read',
      'finance.settlement.decide',
      'finance.withdrawal.read',
      'finance.withdrawal.create',
      'finance.withdrawal.decide',
      'finance.withdrawal.recover',
      'invoice.request.read',
      'invoice.request.cancel',
      'invoice.request.decide',
      'invoice.request.red',
      'finance.statement.import',
      'runtime.import.manage',
      'runtime.task.read',
      'channel.connection.read',
    ],
    capabilities: [
      'finance.audit.read',
      'finance.entries.read',
      'finance.statements.read',
      'finance.statements.export',
      'finance.reconciliations.read',
      'finance.settlements.read',
      'finance.settlements.decide',
      'finance.withdrawals.read',
      'finance.withdrawals.create',
      'finance.withdrawals.decide',
      'finance.withdrawals.recover',
      'invoice.requests.read',
      'invoice.requests.cancel',
      'invoice.requests.decide',
      'invoice.requests.red',
      'finance.statementimports.create',
      'finance.statementimports.read',
      'runtime.uploads.create',
      'runtime.jobs.read',
      'runtime.imports.read',
      'runtime.imports.confirm',
      'channel.connections.read',
    ],
  },
};

function renderRoute(entry: string, Route: ComponentType, routeContext = context) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <DependencyProvider value={createConsoleDependencies()}>
        <QueryClientProvider client={client}>
          <ConsoleContextProvider value={routeContext}>
            <StepupProvider controller={{ request: () => undefined }}>
              <Route />
            </StepupProvider>
          </ConsoleContextProvider>
        </QueryClientProvider>
      </DependencyProvider>
    </MemoryRouter>
  );
}

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="finance-location">
      {location.pathname}
      {location.search}
    </output>
  );
}
function currentParams(): URLSearchParams {
  return new URL(screen.getByTestId('finance-location').textContent ?? '', 'https://console.test').searchParams;
}

function facets() {
  const group = (items: readonly Readonly<{ value: string; label: string; count: number }>[], reason: string | null = null) => ({ items, reason });
  return {
    periods: group([{ value: '2026-08-24', label: '2026-08-24', count: 1 }]),
    providers: { items: [{ value: 'wechat', label: '微信支付', count: 1, available: true }], reason: null },
    malls: group([{ value: 'enterprise:1', label: '测试商城', count: 1 }]),
    states: group([{ value: 'difference', label: '有差异', count: 1 }]),
    differenceTypes: group([{ value: 'INTERNAL_REFERENCE_MISSING', label: '内部引用缺失', count: 1 }]),
    watermark: '2026-08-24T13:26:00.000Z',
  };
}

function audit() {
  return {
    reference: 'order:one',
    facts: [
      { id: 'journal:one', kind: 'journal', label: '账本凭证', business_reference: 'order:one', state: 'posted', amount_minor: 100, currency: 'CNY', occurred_at: '2026-09-05T10:00:00.000Z', version: 1 },
      { id: 'entry:one', kind: 'entry', label: '订单应收会计分录', business_reference: 'order:one', state: 'debit', amount_minor: 100, currency: 'CNY', occurred_at: '2026-09-05T10:00:00.000Z', version: null },
      { id: 'settlement:one', kind: 'settlement', label: '结算单已冻结', business_reference: 'settlement:one', state: 'frozen', amount_minor: 100, currency: 'CNY', occurred_at: '2026-09-05T10:01:00.000Z', version: 2 },
      { id: 'invoice:one', kind: 'invoice', label: '电子发票已开具', business_reference: 'invoice:one', state: 'issued', amount_minor: 100, currency: 'CNY', occurred_at: '2026-09-05T10:02:00.000Z', version: 3 },
      { id: 'repair:one', kind: 'repair', label: '差异修复待复核', business_reference: 'statement:one', state: 'submitted', amount_minor: null, currency: null, occurred_at: '2026-09-05T10:03:00.000Z', version: 1 },
    ],
    events: [{ id: 'event:one', type: 'finance.entry.posted', event_version: 1, aggregate_type: 'journal', aggregate_id: 'journal:one', state: 'published', occurred_at: '2026-09-05T10:00:01.000Z', trace_id: 'trace:one' }],
    records: [
      {
        id: 'audit:one',
        kind: 'command',
        action: 'finance.post',
        resource_type: 'journal',
        resource_id: 'journal:one',
        actor_id: 'actor:one',
        actor_type: 'member',
        before_hash: null,
        after_hash: 'a'.repeat(64),
        record_hash: 'b'.repeat(64),
        evidence: {},
        occurred_at: '2026-09-05T10:00:02.000Z',
        trace_id: 'trace:one',
      },
    ],
    watermark: '2026-09-05T10:00:02.000Z',
  };
}

function statementPage() {
  return {
    items: [
      {
        id: 'statement:1',
        scope_id: 'enterprise:1',
        period_start: '2026-08-01',
        period_end: '2026-08-31',
        currency: 'CNY',
        opening_minor: 110_000,
        debit_minor: 32_000,
        credit_minor: 22_000,
        closing_minor: 120_000,
        state: 'final',
        object_ref: 'object:statement:1',
        sha256: 'a'.repeat(64),
        generated_at: '2026-09-01T00:00:00.000Z',
      },
    ],
    count: 1,
  };
}

function settlement() {
  return {
    id: 'settlement:1',
    partner_id: 'supplier:1',
    period: '2026-08',
    reconciliation_id: 'reconciliation:1',
    amount_minor: 120_000,
    currency: 'CNY',
    state: 'draft',
    scope_id: 'enterprise:1',
    requested_by: 'membership:maker',
    approved_by: null,
    frozen_at: '2026-09-01T00:00:00.000Z',
    approved_at: null,
    paid_at: null,
    evidence: {},
    version: 3,
    gross_minor: 128_000,
    fee_minor: 8_000,
    invoice_basis: 'taxincluded',
    input_hash: 'b'.repeat(64),
    input_count: 3,
    input_minor: 128_000,
    input_watermark: '2026-09-01T00:00:00.000Z',
    lines: [
      { id: 'line:1', sourceType: 'order', sourceId: 'order:1', amountMinor: 50_000, taxMinor: 3_000, state: 'frozen', adjustmentOf: null },
      { id: 'line:2', sourceType: 'order', sourceId: 'order:2', amountMinor: 40_000, taxMinor: 2_000, state: 'frozen', adjustmentOf: null },
      { id: 'line:3', sourceType: 'order', sourceId: 'order:3', amountMinor: 38_000, taxMinor: 3_000, state: 'frozen', adjustmentOf: null },
    ],
    splits: [{ id: 'split:1', beneficiaryType: 'supplier', beneficiaryId: 'supplier:1', amountMinor: 120_000, basisPoints: 10_000, state: 'frozen' }],
    adjustments: [],
  };
}

function withdrawal() {
  return {
    id: 'withdrawal:1',
    scope_id: 'enterprise:1',
    settlement_id: 'settlement:1',
    amount_minor: 8_800,
    currency: 'CNY',
    destination_ref: 'bankaccount:1',
    state: 'failed',
    requested_by: 'membership:maker',
    approved_by: 'membership:checker',
    reason: '供应商本期结算提现',
    evidence: {},
    provider_reference: 'provider:withdrawal:1',
    provider: 'wechat',
    provider_state: 'failed',
    request_hash: 'c'.repeat(64),
    input_watermark: '2026-09-01T00:00:00.000Z',
    response_hash: 'd'.repeat(64),
    created_at: '2026-09-01T08:00:00.000Z',
    updated_at: '2026-09-01T08:05:00.000Z',
    paid_at: null,
    version: 5,
  };
}

function invoiceRequest() {
  return {
    id: 'invoice:1',
    profile_id: 'invoiceprofile:1',
    settlement_id: 'settlement:1',
    amount_minor: 120_000,
    currency: 'CNY',
    state: 'submitted',
    created_at: '2026-09-01T08:00:00.000Z',
    version: 2,
    requested_by: 'membership:maker',
    approved_by: null,
    reason: '供应商申请开票',
    evidence: {},
    source_hash: 'e'.repeat(64),
    kind: 'original',
    red_of_request_id: null,
    issue_hash: null,
    issue_count: null,
    issue_watermark: null,
    provider: null,
    provider_reference: null,
    response_hash: null,
    object_ref: null,
    sha256: null,
    issued_at: null,
    lines: [
      { settlementLine: 'line:1', amountMinor: 60_000, taxMinor: 3_000, sourceHash: 'f'.repeat(64) },
      { settlementLine: 'line:2', amountMinor: 60_000, taxMinor: 3_000, sourceHash: '0'.repeat(64) },
    ],
  };
}

function statementConnection() {
  return {
    id: 'connection:supplier:one',
    provider: 'supplier',
    scope_id: 'enterprise:1',
    status: 'enabled',
    region: 'CN',
    connection_timeout_ms: 500,
    response_timeout_ms: 1_000,
    total_deadline_ms: 2_000,
    max_concurrency: 8,
    requests_per_second: 20,
    max_attempts: 3,
    failure_threshold: 5,
    recovery_ms: 30_000,
    version: 2,
    contract_version: 'supplier.v1',
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    has_secret: true,
    capabilities: ['Statement'],
    health_state: 'healthy',
    health_latency_ms: 30,
    health_reason: null,
    checked_at: '2026-09-01T00:00:00.000Z',
  };
}

function statementImport(state: string) {
  return { id: 'import:finance:1', state, total_count: 0, cursor_value: 0, success_count: 0, failure_count: 0, created_at: '2026-09-01T01:00:00.000Z', updated_at: '2026-09-01T01:00:00.000Z' };
}
