import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
<<<<<<< HEAD
<<<<<<< HEAD
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
=======
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component } from './FinanceRoute';

const requests: URL[] = [];
<<<<<<< HEAD
<<<<<<< HEAD
const authorityRequests: URL[] = [];
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
const authorityRequests: URL[] = [];
>>>>>>> 018b2a71 (chore(release): capture current production source)
const writes: string[] = [];
const server = setupServer(
  http.get('*/api/v1/finance/overview', () => HttpResponse.json(previewOverview())),
  http.get('*/api/v1/finance/reconciliations', ({ request }) => {
    requests.push(new URL(request.url));
    return HttpResponse.json(previewPage());
  }),
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  http.get('*/api/v1/finance/policies', ({ request }) => {
    authorityRequests.push(new URL(request.url));
    return HttpResponse.json(policyPage());
  }),
  http.get('*/api/v1/finance/audits', ({ request }) => {
    authorityRequests.push(new URL(request.url));
    return HttpResponse.json(auditPage());
  }),
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  http.all('*/api/v1/finance/**', ({ request }) => {
    writes.push(request.method);
    return HttpResponse.json({ code: 'UNEXPECTED_FINANCE_WRITE' }, { status: 500 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  vi.restoreAllMocks();
  server.resetHandlers();
  requests.length = 0;
  authorityRequests.length = 0;
<<<<<<< HEAD
=======
  server.resetHandlers();
  requests.length = 0;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  writes.length = 0;
});
afterAll(() => server.close());

describe('Finance reconciliation workspace', () => {
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  it('shows a dedicated loading state while the authoritative reconciliation read is pending', async () => {
    server.use(
      http.get('*/api/v1/finance/reconciliations', async () => {
        await delay(150);
        return HttpResponse.json(previewPage());
      })
    );
    renderRoute('/finance', previewContext);

    expect(screen.getByText('正在读取对账权威快照…')).toBeTruthy();
    expect(await screen.findByRole('table', { name: '支付对账批次' })).toBeTruthy();
  });

  it('surfaces invalid authoritative responses as a retryable error without rendering a table', async () => {
    server.use(http.get('*/api/v1/finance/reconciliations', () => HttpResponse.json({ items: [{ id: 'malformed' }], count: 1 })));
    renderRoute('/finance', previewContext);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('对账数据读取失败')).toBeTruthy();
    expect(within(alert).getByRole('button', { name: '重试' })).toBeTruthy();
    expect(screen.queryByRole('table', { name: '支付对账批次' })).toBeNull();
  });

  it('renders an explicit server-filtered empty state', async () => {
    server.use(http.get('*/api/v1/finance/reconciliations', () => HttpResponse.json(previewPage([]))));
    renderRoute('/finance', previewContext);

    expect(await screen.findByText('当前服务端筛选没有对账记录。')).toBeTruthy();
    expect(screen.queryByRole('table', { name: '支付对账批次' })).toBeNull();
  });

<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  it('renders the server-backed control surface and never derives the reference totals in the browser', async () => {
    renderRoute('/finance', previewContext);
    expect(await screen.findByRole('table', { name: '支付对账批次' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: '财务与对账系统' })).toBeTruthy();
    expect(screen.getByText('差异待处理').parentElement?.textContent).toContain('1 项');
    expect(screen.getByRole('columnheader', { name: '渠道金额' })).toBeTruthy();
    expect(screen.getByText('¥119.00')).toBeTruthy();
    expect(screen.getByText('1–1 / 共 7 笔')).toBeTruthy();
    expect(requests[0]?.searchParams.get('limit')).toBe('50');
  });

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  it('renders the calm access boundary instead of a finance load failure on 403', async () => {
    server.use(http.get('*/api/v1/finance/reconciliations', () => HttpResponse.json({ code: 'FINANCE_READ_DENIED', requestId: 'request:denied' }, { status: 403 })));
    renderRoute('/finance', previewContext);

    const boundary = await screen.findByRole('region', { name: '没有权限' });
    expect(within(boundary).getByText('「财务与对账系统」不可访问')).toBeTruthy();
    expect(screen.queryByRole('table', { name: '支付对账批次' })).toBeNull();
    expect(screen.queryByText('对账数据读取失败')).toBeNull();
  });

  it('fails closed when cached finance data loses access during refresh', async () => {
    let attempts = 0;
    server.use(
      http.get('*/api/v1/finance/reconciliations', () => {
        attempts += 1;
        return attempts === 1 ? HttpResponse.json(previewPage()) : HttpResponse.json({ code: 'FINANCE_READ_DENIED', requestId: 'request:revoked' }, { status: 403 });
      })
    );
    const user = userEvent.setup();
    renderRoute('/finance', previewContext);
    expect(await screen.findByRole('table', { name: '支付对账批次' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '刷新财务数据' }));
    expect(await screen.findByRole('region', { name: '没有权限' })).toBeTruthy();
    expect(screen.queryByRole('table', { name: '支付对账批次' })).toBeNull();
    expect(screen.queryByText('RCN-20260824-WECHAT-001')).toBeNull();
  });

<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  it('keeps checkbox selection separate from the URL-backed review drawer and fails every final action closed', async () => {
    const user = userEvent.setup();
    renderRoute('/finance?campaign=keep', previewContext);
    await screen.findByRole('table', { name: '支付对账批次' });

    await user.click(screen.getByRole('checkbox', { name: '选择对账批次 RCN-20260824-WECHAT-001' }));
    expect(currentParams().get('selected')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: '查看差异' }));
    const drawer = await screen.findByRole('dialog', { name: '差异处理 · 复核预览' });
    expect(currentParams().get('selected')).toBe(row.id);
    expect(currentParams().get('campaign')).toBe('keep');
    expect(within(drawer).getByRole('heading', { name: '1修复方案（服务端生成）' })).toBeTruthy();
    expect(within(drawer).getByText('preview:sha256:1')).toBeTruthy();
    expect(within(drawer).getByText(/发起人不能审批自己的处理方案/)).toBeTruthy();

    await user.click(within(drawer).getByRole('button', { name: '保存草稿' }));
    expect((await within(drawer).findByRole('status')).textContent).toContain('草稿未写入');
    await user.click(within(drawer).getByRole('button', { name: '提交财务复核' }));
    expect((await within(drawer).findByRole('status')).textContent).toContain('提交已安全拦截');
    expect(writes).toHaveLength(0);

    await user.click(within(drawer).getByRole('button', { name: '关闭复核预览' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(currentParams().get('selected')).toBeNull();
  });

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  it('keeps matched-only reconciliations non-actionable even when the server returns nested items', async () => {
    const user = userEvent.setup();
    server.use(http.get('*/api/v1/finance/reconciliations', () => HttpResponse.json(previewPage([balancedRow]))));
    renderRoute(`/finance?selected=${encodeURIComponent(balancedRow.id)}&campaign=keep`, previewContext);

    const table = await screen.findByRole('table', { name: '支付对账批次' });
    const matched = within(table).getByRole('row', { name: /RCN-20260824-ALIPAY-001/ });
    await waitFor(() => expect(currentParams().get('selected')).toBeNull());
    expect(screen.queryByRole('dialog', { name: '差异处理 · 复核预览' })).toBeNull();
    expect(within(matched).getByRole<HTMLButtonElement>('button', { name: '无差异' }).disabled).toBe(true);
    await user.click(within(matched).getByText('RCN-20260824-ALIPAY-001'));
    expect(screen.queryByRole('dialog', { name: '差异处理 · 复核预览' })).toBeNull();
    expect(currentParams().get('selected')).toBeNull();
    expect(currentParams().get('campaign')).toBe('keep');
  });

<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  it('restores selected difference from the URL and applies preview filters on the server', async () => {
    const user = userEvent.setup();
    renderRoute(`/finance?selected=${encodeURIComponent(row.id)}&cursor=old&campaign=keep`, previewContext);
    expect(await screen.findByRole('dialog', { name: '差异处理 · 复核预览' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '关闭复核预览' }));

    await user.selectOptions(screen.getByRole('combobox', { name: '支付渠道' }), 'wechat');
    await waitFor(() => expect(currentParams().get('channel')).toBe('wechat'));
    expect(currentParams().get('cursor')).toBeNull();
    expect(currentParams().get('campaign')).toBe('keep');
    await waitFor(() => expect(requests.some((url) => url.searchParams.get('channel') === 'wechat')).toBe(true));
  });

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  it('merges consecutive select filters into the URL without dropping an earlier selection', async () => {
    const user = userEvent.setup();
    renderRoute('/finance?campaign=keep', previewContext);
    await screen.findByRole('table', { name: '支付对账批次' });

    await user.selectOptions(screen.getByRole('combobox', { name: '账期' }), '2026-08-24');
    await user.selectOptions(screen.getByRole('combobox', { name: '支付渠道' }), 'wechat');
    await user.selectOptions(screen.getByRole('combobox', { name: '对账状态' }), 'difference');

    await waitFor(() => {
      expect(currentParams().get('reconPeriod')).toBe('2026-08-24');
      expect(currentParams().get('channel')).toBe('wechat');
      expect(currentParams().get('status')).toBe('difference');
    });
    expect(currentParams().get('campaign')).toBe('keep');
  });

  it('keeps authoritative filters enabled while hiding local preview metadata in production scope', async () => {
    const user = userEvent.setup();
<<<<<<< HEAD
    renderRoute('/finance?q=demo&channel=wechat&reconPeriod=2026-08-24&campaign=keep', productionContext);
    expect(await screen.findByRole('table', { name: '支付对账批次' })).toBeTruthy();
    await waitFor(() => expect(currentParams().get('channel')).toBe('wechat'));
    expect(currentParams().get('campaign')).toBe('keep');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: '搜索对账记录' }).disabled).toBe(false);
    expect(screen.getByText('reconciliation:preview:wechat:1')).toBeTruthy();
    expect(screen.queryByText('RCN-20260824-WECHAT-001')).toBeNull();
    expect(screen.getByText('本页 1 笔')).toBeTruthy();
    expect(requests.every((url) => url.searchParams.get('q') === 'demo' && url.searchParams.get('channel') === 'wechat')).toBe(true);

    expect(screen.getByRole<HTMLButtonElement>('button', { name: '导出当前页' }).disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '发起对账' }).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: '查看差异' }));
    const drawer = await screen.findByRole('dialog', { name: '差异处理 · 复核预览' });
    expect(within(drawer).getByText('最终动作未接入')).toBeTruthy();
    expect(within(drawer).getByRole<HTMLButtonElement>('button', { name: '保存草稿' }).disabled).toBe(true);
    expect(within(drawer).getByRole<HTMLButtonElement>('button', { name: '提交财务复核' }).disabled).toBe(true);
    expect(writes).toHaveLength(0);
  });

  it('routes payment and refund tabs through the authoritative reconciliation kind filter', async () => {
=======
  it('removes preview-only filters and hides preview metadata in production scope', async () => {
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    renderRoute('/finance?q=demo&channel=wechat&reconPeriod=2026-08-24&campaign=keep', productionContext);
    expect(await screen.findByRole('table', { name: '支付对账批次' })).toBeTruthy();
    await waitFor(() => expect(currentParams().get('channel')).toBe('wechat'));
    expect(currentParams().get('campaign')).toBe('keep');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: '搜索对账记录' }).disabled).toBe(false);
    expect(screen.getByText('reconciliation:preview:wechat:1')).toBeTruthy();
    expect(screen.queryByText('RCN-20260824-WECHAT-001')).toBeNull();
    expect(screen.getByText('本页 1 笔')).toBeTruthy();
    expect(requests.every((url) => url.searchParams.get('q') === 'demo' && url.searchParams.get('channel') === 'wechat')).toBe(true);

    expect(screen.getByRole<HTMLButtonElement>('button', { name: '导出当前页' }).disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '发起对账' }).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: '查看差异' }));
    const drawer = await screen.findByRole('dialog', { name: '差异处理 · 复核预览' });
    expect(within(drawer).getByText('最终动作未接入')).toBeTruthy();
    expect(within(drawer).getByRole<HTMLButtonElement>('button', { name: '保存草稿' }).disabled).toBe(true);
    expect(within(drawer).getByRole<HTMLButtonElement>('button', { name: '提交财务复核' }).disabled).toBe(true);
    expect(writes).toHaveLength(0);
  });

<<<<<<< HEAD
  it('routes supported tabs and labels unavailable read contracts honestly', async () => {
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  it('routes payment and refund tabs through the authoritative reconciliation kind filter', async () => {
>>>>>>> 018b2a71 (chore(release): capture current production source)
    const user = userEvent.setup();
    renderRoute('/finance', previewContext);
    await screen.findByRole('table', { name: '支付对账批次' });
    await user.click(screen.getByRole('button', { name: '退款对账' }));
<<<<<<< HEAD
<<<<<<< HEAD
    expect(await screen.findByRole('table', { name: '退款对账批次' })).toBeTruthy();
    expect(currentParams().get('tab')).toBe('refunds');
    await waitFor(() => expect(requests.some((url) => url.searchParams.get('kind') === 'refund')).toBe(true));
=======
    expect(await screen.findByRole('heading', { name: '退款对账' })).toBeTruthy();
    expect(screen.getByText(/不会用演示数据替代生产事实/)).toBeTruthy();
    expect(currentParams().get('tab')).toBe('refunds');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    expect(await screen.findByRole('table', { name: '退款对账批次' })).toBeTruthy();
    expect(currentParams().get('tab')).toBe('refunds');
    await waitFor(() => expect(requests.some((url) => url.searchParams.get('kind') === 'refund')).toBe(true));
>>>>>>> 018b2a71 (chore(release): capture current production source)

    await user.click(screen.getByRole('button', { name: '结算单' }));
    expect(currentLocation()).toContain('/finance/settlements');
  });

<<<<<<< HEAD
<<<<<<< HEAD
  it('renders authoritative rules and audit records as read-only typed pages', async () => {
    const user = userEvent.setup();
    renderRoute('/finance?tab=rules&limit=20&cursor=policy%3Apage%3A2', previewContext);

    const policies = await screen.findByRole('table', { name: '对账规则' });
    expect(within(policies).getByText('finance.policy.reconciliation.wechat')).toBeTruthy();
    expect(within(policies).getByText('reconciliation')).toBeTruthy();
    expect(within(policies).getByText('{"provider":"wechat_pay","matchMode":"one-to-one","toleranceMinor":0}')).toBeTruthy();
    expect(within(policies).getByText('active')).toBeTruthy();
    expect(within(policies).getByText('v3')).toBeTruthy();
    expect(within(policies).getByRole<HTMLButtonElement>('button', { name: '编辑规则 finance.policy.reconciliation.wechat（未启用）' }).disabled).toBe(true);
    expect(screen.getByText(/LOCAL PREVIEW FIXTURE/)).toBeTruthy();
    expect(authorityRequests[0]?.searchParams.get('limit')).toBe('20');
    expect(authorityRequests[0]?.searchParams.get('cursor')).toBe('policy:page:2');
    expect(currentParams().get('limit')).toBe('20');
    expect(currentParams().get('cursor')).toBe('policy:page:2');

    await user.click(screen.getByRole('button', { name: '审计记录' }));
    const audits = await screen.findByRole('table', { name: '审计记录' });
    expect(within(audits).getByText('finance.reconciliations.approve')).toBeTruthy();
    expect(within(audits).getByText(/member · actor:finance:reviewer/)).toBeTruthy();
    expect(within(audits).getByText(/finance:reconciliation:1/)).toBeTruthy();
    expect(within(audits).getByText('previous ·', { exact: false })).toBeTruthy();
    expect(within(audits).getByText('record ·', { exact: false })).toBeTruthy();
    expect(within(audits).getByText('{"fourEyes":true,"effectId":"effect:1"}')).toBeTruthy();
    expect(within(audits).getByRole<HTMLButtonElement>('button', { name: '审计记录 audit:finance:1 不可变' }).disabled).toBe(true);
    expect(writes).toHaveLength(0);
  });

  it('covers loading, empty, and malformed authority responses without a fixture fallback', async () => {
    server.use(
      http.get('*/api/v1/finance/policies', async () => {
        await delay(100);
        return HttpResponse.json({ items: [], count: 0 });
      })
    );
    renderRoute('/finance?tab=rules', productionContext);
    expect(screen.getByText('正在读取对账规则权威快照…')).toBeTruthy();
    expect(await screen.findByText('当前范围没有对账规则。')).toBeTruthy();
    expect(screen.queryByText(/LOCAL PREVIEW FIXTURE/)).toBeNull();
    expect(screen.getByText(/没有演示 fallback/)).toBeTruthy();
    cleanup();

    server.use(http.get('*/api/v1/finance/audits', () => HttpResponse.json({ items: [{ id: 'malformed' }], count: 1 })));
    renderRoute('/finance?tab=audit', productionContext);
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('审计记录读取失败')).toBeTruthy();
    expect(within(alert).getByRole('button', { name: '重试' })).toBeTruthy();
    expect(screen.queryByRole('table', { name: '审计记录' })).toBeNull();
  });

  it('renders production policy facts only from the validated response', async () => {
    server.use(http.get('*/api/v1/finance/policies', () => HttpResponse.json(productionPolicyPage())));
    renderRoute('/finance?tab=rules', productionContext);

    const policies = await screen.findByRole('table', { name: '对账规则' });
    expect(within(policies).getByText('finance.policy.production.scope')).toBeTruthy();
    expect(within(policies).queryByText('finance.policy.reconciliation.wechat')).toBeNull();
    expect(screen.queryByText(/LOCAL PREVIEW FIXTURE/)).toBeNull();
    expect(screen.getByText(/只展示通过 Zod 校验的服务端响应/)).toBeTruthy();
  });

  it('downloads payment and refund current pages, opens local import, and preserves the start boundary', async () => {
    const user = userEvent.setup();
    const download = captureDownload();
    renderRoute('/finance', previewContext);
    await screen.findByRole('table', { name: '支付对账批次' });
    const paymentRequestCount = requests.length;

    await user.click(screen.getByRole('button', { name: '导出当前页' }));
    expect(download.filenames[0]).toMatch(/^finance-payments-current-page-\d{8}-\d{6}\.csv$/);
    const paymentCsv = await readBlob(download.blobs[0]!);
    expect(paymentCsv.split('\r\n')[1]?.startsWith('payments,')).toBe(true);
    expect(csvRowCount(paymentCsv)).toBe(previewPage().items.length + 1);
    expect(requests).toHaveLength(paymentRequestCount);

    await user.click(screen.getByRole('button', { name: '导入' }));
    expect(await screen.findByRole('dialog', { name: '导入财务数据' })).toBeTruthy();
    await user.click(within(screen.getByRole('dialog', { name: '导入财务数据' })).getByRole('button', { name: '取消' }));

    await user.click(screen.getByRole('button', { name: '退款对账' }));
    await screen.findByRole('table', { name: '退款对账批次' });
    const refundRequestCount = requests.length;
    await user.click(screen.getByRole('button', { name: '导出当前页' }));
    expect(download.filenames[1]).toMatch(/^finance-refunds-current-page-\d{8}-\d{6}\.csv$/);
    const refundCsv = await readBlob(download.blobs[1]!);
    expect(refundCsv.split('\r\n')[1]?.startsWith('refunds,')).toBe(true);
    expect(csvRowCount(refundCsv)).toBe(previewPage().items.length + 1);
    expect(requests).toHaveLength(refundRequestCount);

=======
  it('shows only non-mutating safety dialogs for preview header actions', async () => {
=======
  it('renders authoritative rules and audit records as read-only typed pages', async () => {
>>>>>>> 018b2a71 (chore(release): capture current production source)
    const user = userEvent.setup();
    renderRoute('/finance?tab=rules&limit=20&cursor=policy%3Apage%3A2', previewContext);

    const policies = await screen.findByRole('table', { name: '对账规则' });
    expect(within(policies).getByText('finance.policy.reconciliation.wechat')).toBeTruthy();
    expect(within(policies).getByText('reconciliation')).toBeTruthy();
    expect(within(policies).getByText('{"provider":"wechat_pay","matchMode":"one-to-one","toleranceMinor":0}')).toBeTruthy();
    expect(within(policies).getByText('active')).toBeTruthy();
    expect(within(policies).getByText('v3')).toBeTruthy();
    expect(within(policies).getByRole<HTMLButtonElement>('button', { name: '编辑规则 finance.policy.reconciliation.wechat（未启用）' }).disabled).toBe(true);
    expect(screen.getByText(/LOCAL PREVIEW FIXTURE/)).toBeTruthy();
    expect(authorityRequests[0]?.searchParams.get('limit')).toBe('20');
    expect(authorityRequests[0]?.searchParams.get('cursor')).toBe('policy:page:2');
    expect(currentParams().get('limit')).toBe('20');
    expect(currentParams().get('cursor')).toBe('policy:page:2');

    await user.click(screen.getByRole('button', { name: '审计记录' }));
    const audits = await screen.findByRole('table', { name: '审计记录' });
    expect(within(audits).getByText('finance.reconciliations.approve')).toBeTruthy();
    expect(within(audits).getByText(/member · actor:finance:reviewer/)).toBeTruthy();
    expect(within(audits).getByText(/finance:reconciliation:1/)).toBeTruthy();
    expect(within(audits).getByText('previous ·', { exact: false })).toBeTruthy();
    expect(within(audits).getByText('record ·', { exact: false })).toBeTruthy();
    expect(within(audits).getByText('{"fourEyes":true,"effectId":"effect:1"}')).toBeTruthy();
    expect(within(audits).getByRole<HTMLButtonElement>('button', { name: '审计记录 audit:finance:1 不可变' }).disabled).toBe(true);
    expect(writes).toHaveLength(0);
  });

  it('covers loading, empty, and malformed authority responses without a fixture fallback', async () => {
    server.use(
      http.get('*/api/v1/finance/policies', async () => {
        await delay(100);
        return HttpResponse.json({ items: [], count: 0 });
      })
    );
    renderRoute('/finance?tab=rules', productionContext);
    expect(screen.getByText('正在读取对账规则权威快照…')).toBeTruthy();
    expect(await screen.findByText('当前范围没有对账规则。')).toBeTruthy();
    expect(screen.queryByText(/LOCAL PREVIEW FIXTURE/)).toBeNull();
    expect(screen.getByText(/没有演示 fallback/)).toBeTruthy();
    cleanup();

    server.use(http.get('*/api/v1/finance/audits', () => HttpResponse.json({ items: [{ id: 'malformed' }], count: 1 })));
    renderRoute('/finance?tab=audit', productionContext);
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('审计记录读取失败')).toBeTruthy();
    expect(within(alert).getByRole('button', { name: '重试' })).toBeTruthy();
    expect(screen.queryByRole('table', { name: '审计记录' })).toBeNull();
  });

  it('renders production policy facts only from the validated response', async () => {
    server.use(http.get('*/api/v1/finance/policies', () => HttpResponse.json(productionPolicyPage())));
    renderRoute('/finance?tab=rules', productionContext);

    const policies = await screen.findByRole('table', { name: '对账规则' });
    expect(within(policies).getByText('finance.policy.production.scope')).toBeTruthy();
    expect(within(policies).queryByText('finance.policy.reconciliation.wechat')).toBeNull();
    expect(screen.queryByText(/LOCAL PREVIEW FIXTURE/)).toBeNull();
    expect(screen.getByText(/只展示通过 Zod 校验的服务端响应/)).toBeTruthy();
  });

  it('downloads payment and refund current pages, opens local import, and preserves the start boundary', async () => {
    const user = userEvent.setup();
    const download = captureDownload();
    renderRoute('/finance', previewContext);
    await screen.findByRole('table', { name: '支付对账批次' });
<<<<<<< HEAD
    await user.click(screen.getByRole('button', { name: '导出对账单' }));
    const exportDialog = await screen.findByRole('dialog', { name: '导出对账单 · 安全预览' });
    expect(within(exportDialog).getByText(/当前不会生成或下载正式账单/)).toBeTruthy();
    await user.click(within(exportDialog).getByRole('button', { name: '我知道了' }));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    const paymentRequestCount = requests.length;

    await user.click(screen.getByRole('button', { name: '导出当前页' }));
    expect(download.filenames[0]).toMatch(/^finance-payments-current-page-\d{8}-\d{6}\.csv$/);
    const paymentCsv = await readBlob(download.blobs[0]!);
    expect(paymentCsv.split('\r\n')[1]?.startsWith('payments,')).toBe(true);
    expect(csvRowCount(paymentCsv)).toBe(previewPage().items.length + 1);
    expect(requests).toHaveLength(paymentRequestCount);

    await user.click(screen.getByRole('button', { name: '导入' }));
    expect(await screen.findByRole('dialog', { name: '导入财务数据' })).toBeTruthy();
    await user.click(within(screen.getByRole('dialog', { name: '导入财务数据' })).getByRole('button', { name: '取消' }));

    await user.click(screen.getByRole('button', { name: '退款对账' }));
    await screen.findByRole('table', { name: '退款对账批次' });
    const refundRequestCount = requests.length;
    await user.click(screen.getByRole('button', { name: '导出当前页' }));
    expect(download.filenames[1]).toMatch(/^finance-refunds-current-page-\d{8}-\d{6}\.csv$/);
    const refundCsv = await readBlob(download.blobs[1]!);
    expect(refundCsv.split('\r\n')[1]?.startsWith('refunds,')).toBe(true);
    expect(csvRowCount(refundCsv)).toBe(previewPage().items.length + 1);
    expect(requests).toHaveLength(refundRequestCount);

>>>>>>> 018b2a71 (chore(release): capture current production source)
    await user.click(screen.getByRole('button', { name: '发起对账' }));
    const startDialog = await screen.findByRole('dialog', { name: '发起对账 · 安全预览' });
    expect(within(startDialog).getByText(/不会创建对账批次/)).toBeTruthy();
    expect(writes).toHaveLength(0);
  });
});

const row = {
  id: 'reconciliation:preview:wechat:1',
  scope_id: 'platform:preview',
  provider: 'wechat_pay',
  partner_id: 'mall:1',
  period: '2026-08-24',
  statement_ref: 'statement:1',
  statement_hash: 'a'.repeat(64),
  debit_minor: 31_500,
  credit_minor: 19_600,
  difference_minor: 11_900,
  state: 'difference',
  evidence: {},
  approved_by: null,
  updated_at: '2026-08-24T13:26:00.000Z',
  version: 7,
  item_counts: { matched: 2, difference: 1 },
  preview: {
    source: 'local-preview',
    batchId: 'RCN-20260824-WECHAT-001',
    accountingDate: '2026-08-24',
    channelLabel: '微信支付',
    dataSourceLabel: '渠道账单',
    scopeLabel: '鸿泰集团 / 鸿泰惠民通',
    expectedCount: 3,
    matchedCount: 2,
    differenceCount: 1,
    paymentChannel: 'wechat',
    mall: 'mall:1',
    differenceType: 'journal-missing',
    completedAt: '2026-08-24T13:26:00.000Z',
  },
  items: [
    {
      id: 'DIFF-20260824-0001',
<<<<<<< HEAD
<<<<<<< HEAD
      version: 7,
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      version: 7,
>>>>>>> 018b2a71 (chore(release): capture current production source)
      externalMinor: 11_900,
      internalMinor: 0,
      differenceMinor: 11_900,
      state: 'difference',
      reasonCode: 'INTERNAL_REFERENCE_MISSING',
      evidence: {},
      resolution: null,
      resolvedBy: null,
      approvedBy: null,
      preview: repairPreview(),
    },
  ],
};

<<<<<<< HEAD
<<<<<<< HEAD
function previewPage(items: readonly unknown[] = [row]) {
  return {
    items,
    count: items.length,
=======
function previewPage() {
  return {
    items: [row],
    count: 1,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
function previewPage(items: readonly unknown[] = [row]) {
  return {
    items,
    count: items.length,
>>>>>>> 018b2a71 (chore(release): capture current production source)
    preview: {
      source: 'local-preview',
      total: 7,
      page: 1,
      asOf: '2026-08-24T13:31:00.000Z',
      accountingDate: '2026-08-24',
      lastReconciledAt: '2026-08-24T13:26:00.000Z',
      pendingDifferenceCount: 1,
      pendingReviewCount: 0,
      facets: {
        periods: [{ value: '2026-08-24', label: '2026-08-24', count: 7 }],
        channels: [{ value: 'wechat', label: '微信支付', count: 1 }],
        malls: [{ value: 'mall:1', label: '鸿泰惠民通', count: 7 }],
        statuses: [{ value: 'difference', label: '有差异', count: 1 }],
        differenceTypes: [{ value: 'journal-missing', label: '记账事件缺失', count: 1 }],
      },
    },
  };
}

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
const balancedRow = {
  ...row,
  id: 'reconciliation:preview:alipay:1',
  provider: 'alipay',
  statement_ref: 'statement:alipay:1',
  statement_hash: 'b'.repeat(64),
  debit_minor: 42_600,
  credit_minor: 42_600,
  difference_minor: 0,
  state: 'balanced',
  version: 3,
  item_counts: { matched: 1, difference: 0 },
  preview: {
    ...row.preview,
    batchId: 'RCN-20260824-ALIPAY-001',
    channelLabel: '支付宝',
    expectedCount: 1,
    matchedCount: 1,
    differenceCount: 0,
    paymentChannel: 'alipay',
    differenceType: 'none',
  },
  items: [
    {
      ...row.items[0]!,
      id: 'reconciliationitem:preview:alipay:1',
      externalMinor: 42_600,
      internalMinor: 42_600,
      differenceMinor: 0,
      state: 'matched',
      reasonCode: null,
      preview: undefined,
    },
  ],
};

<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
function previewOverview() {
  return {
    items: [
      {
        currency: 'CNY',
        balance_minor: 78_599_300,
        liability_minor: 13_826_400,
        income_minor: 24_863_200,
        expense_minor: 6_961_696,
        cash_minor: 31_500,
        journal_count: 18_642,
        watermark: '2026-08-24T13:26:00.000Z',
      },
    ],
    preview: {
      source: 'local-preview',
      asOf: '2026-08-24T13:31:00.000Z',
      accountingDate: '2026-08-24',
      lastReconciledAt: '2026-08-24T13:26:00.000Z',
      pendingDifferenceCount: 1,
      pendingReviewCount: 0,
    },
  };
}

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
function policyPage() {
  return {
    items: [
      {
        id: 'finance.policy.reconciliation.wechat',
        scope_id: 'platform:preview',
        kind: 'reconciliation',
        rule: { provider: 'wechat_pay', matchMode: 'one-to-one', toleranceMinor: 0 },
        state: 'active',
        version: '3',
      },
    ],
    count: 1,
    preview: { source: 'local-preview', total: 1, page: 2, previousCursor: 'start' },
  };
}

function productionPolicyPage() {
  return {
    items: [
      {
        id: 'finance.policy.production.scope',
        scope_id: 'enterprise:1',
        kind: 'threshold',
        rule: { amountMinor: 100_000 },
        state: 'active',
        version: 9,
      },
    ],
    count: 1,
  };
}

function auditPage() {
  return {
    items: [
      {
        id: 'audit:finance:1',
        scope_id: 'platform:preview',
        actor_id: 'actor:finance:reviewer',
        actor_type: 'member',
        action: 'finance.reconciliations.approve',
        resource_type: 'finance',
        resource_id: 'reconciliation:1',
        before_hash: '1'.repeat(64),
        after_hash: '2'.repeat(64),
        evidence: { fourEyes: true, effectId: 'effect:1' },
        trace_id: 'trace:finance:1',
        previous_hash: '3'.repeat(64),
        record_hash: '4'.repeat(64),
        recorded_at: '2026-08-24T13:29:00.000Z',
      },
    ],
    count: 1,
    preview: { source: 'local-preview', total: 1, page: 1 },
  };
}

<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
function repairPreview() {
  return {
    source: 'local-preview',
    status: 'service-preview',
    expiresAt: '2026-08-24T13:46:00.000Z',
    plan: { title: '重放缺失记账事件', description: '不修改历史账本', operation: 'finance.reconciliation.replay', relatedPayment: 'PAY-20260824-0119', accountingDate: '2026-08-24', scope: '鸿泰集团 / 鸿泰惠民通' },
    entries: [
      { side: 'debit', account: 'cash', amountMinor: 11_900, currency: 'CNY' },
      { side: 'credit', account: 'commerce.clearing', amountMinor: 11_900, currency: 'CNY' },
    ],
    result: { ledgerBeforeMinor: 19_600, ledgerAfterMinor: 31_500, differenceBeforeMinor: 11_900, differenceAfterMinor: 0, settlementImpact: '重新计算当前结算基础' },
    checks: [{ label: '财务权限与 Level 3', state: 'passed', detail: '已验证' }],
    reason: '记账事件未消费',
    evidence: [{ label: '渠道账单', value: 'SHA-256' }],
    previewHash: 'preview:sha256:1',
    idempotencyKey: 'FIN-20260824-0001',
    sourceHash: 'source:sha256:1',
    itemVersion: 7,
    previewVersion: 7,
  };
}

const previewScope = { kind: 'platform', id: 'platform:preview' } as const;
const productionScope = { kind: 'enterprise', id: 'enterprise:1' } as const;
const previewContext = context(previewScope);
const productionContext = context(productionScope);

function context(scope: ConsoleContext['scope']): ConsoleContext {
  return {
    session: { actor: 'actor:finance', membership: 'membership:finance', accessVersion: 7, permissions: [], capabilities: [], target: 'console', scope, scopes: [scope], assurance: { level: 3 }, syncedAt: '2026-08-24T13:31:00.000Z' },
    profile: { display_name: '测试财务', employee_no: null },
    scope,
    scopes: [scope],
  };
}

function renderRoute(entry: string, initialContext: ConsoleContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={initialContext}>
          <Component />
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)

function captureDownload() {
  const blobs: Blob[] = [];
  const filenames: string[] = [];
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:finance-${blobs.length}`;
    }),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function captureFilename(this: HTMLAnchorElement) {
    filenames.push(this.download);
  });
  return { blobs, filenames };
}

async function readBlob(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsText(blob);
  });
}

function csvRowCount(csv: string): number {
  return csv.split('\r\n').filter((line) => line !== '').length;
}
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="finance-location">
      {location.pathname}
      {location.search}
    </output>
  );
}
function currentLocation(): string {
  return screen.getByTestId('finance-location').textContent ?? '';
}
function currentParams(): URLSearchParams {
  return new URL(currentLocation(), 'https://console.test').searchParams;
}
