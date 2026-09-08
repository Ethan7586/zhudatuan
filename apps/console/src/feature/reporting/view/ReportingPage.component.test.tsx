import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ReportingViewModel } from '../viewmodel/ReportingViewModel';
import { ReportExportDialog } from './ReportExportDialog';
import { ReportingPage } from './ReportingPage';

describe('ReportingPage', () => {
  it('renders authoritative freshness evidence and exposes only supplied actions', async () => {
    const openExport = vi.fn();
    render(
      <ReportingPage
        title="数据报表"
        model={
          {
            view: 'members',
            period: '30days',
            application: '',
            availableViews: ['members'],
            dimensions: { applications: [{ value: 'application:one', label: '总部福利商城' }], pending: false },
            rows: [
              {
                code: 'member.amount',
                version: 1,
                definition: { name: '会员成交金额', formula: '会员支付金额合计', dimensions: ['customer', 'member'], granularity: 'day', owner: 'reporting' },
                scope: 'mall:one',
                period: { from: '2026-09-01T00:00:00.000Z', to: '2026-09-02T00:00:00.000Z', timezone: 'Asia/Shanghai' },
                dimensions: { customer: 'customer:enterprise:verysecret123456', member: 'member:verysecret654321' },
                displayedDimensions: [
                  { code: 'customer', name: '客户范围', value: '示例企业' },
                  { code: 'member', name: '会员', value: '王小明' },
                ],
                value: 3200,
                unit: 'minor',
                currency: 'CNY',
                watermark: '2026-09-02T00:01:00.000Z',
                projectionVersion: 8,
              },
            ],
            preset: {
              code: 'customermember',
              name: '客户 / 会员分层',
              description: '在当前授权客户范围内，按购买会员汇总成交金额与支付订单；只展示授权范围内的会员名称。',
              dimensions: ['customer', 'member'],
              privacy: 'masked',
              version: 1,
              owner: 'reporting',
            },
            count: 1,
            watermark: '2026-09-02T00:01:00.000Z',
            timezone: 'Asia/Shanghai',
            projectionVersion: 8,
            stale: false,
            condition: 'ready',
            export: { open: false, allowed: true, pending: false },
            actions: {
              refresh: vi.fn(),
              view: vi.fn(),
              period: vi.fn(),
              application: vi.fn(),
              refreshDimensions: vi.fn(),
              next: vi.fn(),
              openExport,
              closeExport: vi.fn(),
              submitExport: vi.fn(),
              retryExport: vi.fn(),
              dismissReceipt: vi.fn(),
            },
          } as unknown as ReportingViewModel
        }
      />
    );
    expect(screen.getByRole('heading', { level: 1, name: '数据报表' })).toBeTruthy();
    expect(screen.getByText(/投影版本 v8/)).toBeTruthy();
    expect(screen.getAllByText(/数据截至/)).toHaveLength(2);
    expect(screen.getByRole('table', { name: '报表指标' })).toBeTruthy();
    expect(screen.getByRole('complementary', { name: '当前维度口径' }).textContent).toContain('客户 / 会员分层');
    expect(screen.getAllByText(/会员名称/)).toHaveLength(2);
    expect(screen.getByText(/会员：王小明/)).toBeTruthy();
    expect(screen.queryByText(/verysecret654321/)).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: '导出当前报表' }));
    expect(openExport).toHaveBeenCalledOnce();
  });

  it('does not report success for a rejected file and offers a new export command', async () => {
    const restartExport = vi.fn();
    render(
      <ReportExportDialog
        model={
          {
            view: 'sales',
            period: '30days',
            export: {
              open: true,
              allowed: true,
              pending: false,
              job: {
                id: 'export:rejected',
                scope: 'mall:one',
                report: 'metrics',
                filter: { view: 'sales', period: '30days' },
                snapshot: { filter: { view: 'sales', period: '30days' }, watermark: { event: 'event:one', occurredAt: '2026-09-07T00:00:00.000Z', version: 1 }, generatedAt: '2026-09-07T00:00:01.000Z', generationVersion: 1 },
                state: 'completed',
                cursor: null,
                recordCount: 18,
                objectReference: 'reports/rejected.csv',
                objectHash: 'a'.repeat(64),
                objectSize: 1024,
                scanState: 'rejected',
                expiresAt: null,
                createdAt: '2026-09-07T00:00:02.000Z',
                generatedAt: '2026-09-07T00:00:03.000Z',
              },
            },
            actions: { closeExport: vi.fn(), retryExport: vi.fn(), restartExport, refreshDownload: vi.fn() },
          } as unknown as ReportingViewModel
        }
      />
    );

    const dialog = screen.getByRole('dialog', { name: '导出当前报表' });
    expect(within(dialog).getByText('安全检查未通过')).toBeTruthy();
    expect(within(dialog).getByText(/不能下载/)).toBeTruthy();
    expect(within(dialog).queryByRole('link')).toBeNull();
    await userEvent.setup().click(within(dialog).getByRole('button', { name: '重新创建导出' }));
    expect(restartExport).toHaveBeenCalledOnce();
  });
});
