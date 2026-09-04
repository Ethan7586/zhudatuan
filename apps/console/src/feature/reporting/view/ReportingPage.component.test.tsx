import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ReportingViewModel } from '../viewmodel/ReportingViewModel';
import { ReportingPage } from './ReportingPage';

describe('ReportingPage', () => {
  it('renders authoritative freshness evidence and exposes only supplied actions', async () => {
    const openExport = vi.fn();
    render(
      <ReportingPage
        title="数据报表"
        model={
          {
            view: 'categories',
            period: '30days',
            applicationDraft: '',
            availableViews: ['categories'],
            rows: [
              {
                code: 'category.amount',
                version: 1,
                scope: 'mall:one',
                period: { from: '2026-09-01T00:00:00.000Z', to: '2026-09-02T00:00:00.000Z', timezone: 'Asia/Shanghai' },
                dimensions: { category: '生鲜' },
                value: 3200,
                unit: 'minor',
                watermark: '2026-09-02T00:01:00.000Z',
                projectionVersion: 8,
              },
            ],
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
              applyApplication: vi.fn(),
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
    await userEvent.setup().click(screen.getByRole('button', { name: '导出当前报表' }));
    expect(openExport).toHaveBeenCalledOnce();
  });
});
