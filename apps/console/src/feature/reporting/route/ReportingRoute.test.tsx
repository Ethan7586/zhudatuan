import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createConsoleDependencies } from '../../../app/Dependencies';
import { DependencyProvider } from '../../../app/DependencyContext';
import { ConsoleContextProvider } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { StepupProvider } from '../../../entity/session/StepupContext';
import { Component } from './ReportingRoute';

let exportCommand: Readonly<{ body: unknown; headers: Headers }> | undefined;
const server = setupServer(
  http.get('*/api/v1/reports/sales', () => HttpResponse.json(reportPage())),
  http.post('*/api/v1/reports/exports', async ({ request }) => {
    exportCommand = { body: await request.json(), headers: request.headers };
    return HttpResponse.json(exportJob('queued'));
  }),
  http.get('*/api/v1/reports/exports/:id', () => HttpResponse.json(exportJob('completed')))
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  exportCommand = undefined;
});
afterAll(() => server.close());

describe('Reporting route', () => {
  it('freezes the displayed watermark and completes a real downloadable export', async () => {
    const user = userEvent.setup();
    renderRoute();

    expect(await screen.findByRole('table', { name: '报表指标' })).toBeTruthy();
    expect(screen.getAllByText(/数据截至/)).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: '导出当前报表' }));
    const dialog = await screen.findByRole('dialog', { name: '导出当前报表' });
    await user.click(within(dialog).getByRole('button', { name: '确认创建导出' }));

    const download = await within(dialog).findByRole('link', { name: '下载 CSV（短期有效）' });
    expect(download.getAttribute('href')).toBe('https://objects.example/report.csv?token=one');
    expect(within(dialog).getByText('安全检查通过')).toBeTruthy();
    expect(await screen.findByText('操作已完成')).toBeTruthy();
    expect(exportCommand?.headers.get('idempotency-key')).toBeTruthy();
    expect(exportCommand?.headers.get('x-csrf-token')).toBe('csrf:reporting');
    expect(exportCommand?.body).toMatchObject({
      report: 'metrics',
      filter: { view: 'sales', period: '30days' },
      snapshot: { watermark: { event: 'event:reporting', version: 8 } },
    });
  });
});

function renderRoute() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/scopes/enterprise/enterprise:one/reporting?view=sales&period=30days']}>
      <DependencyProvider value={createConsoleDependencies()}>
        <QueryClientProvider client={client}>
          <ConsoleContextProvider value={context}>
            <StepupProvider controller={{ request: () => undefined }}>
              <Component />
            </StepupProvider>
          </ConsoleContextProvider>
        </QueryClientProvider>
      </DependencyProvider>
    </MemoryRouter>
  );
}

const scope = { kind: 'enterprise' as const, id: 'enterprise:one' };
const context: ConsoleContext = {
  scope,
  scopes: [scope],
  profile: { display_name: '报表管理员', employee_no: null },
  session: {
    actor: 'actor:reporting', membership: 'membership:reporting', accessVersion: 7, csrf: 'csrf:reporting',
    permissions: ['reporting.sales.read', 'reporting.export.manage', 'reporting.export.read'],
    capabilities: ['reporting.sales.read', 'reporting.exports.create', 'reporting.exports.read'],
    target: 'console', scope, scopes: [scope], assurance: { level: 3 },
    security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null },
    syncedAt: '2026-09-07T00:00:00.000Z',
  },
};

function reportPage() {
  return {
    items: [{
      code: 'sales.amount', version: 2,
      definition: { name: '净销售额', formula: '支付金额减退款金额', dimensions: ['mall'], granularity: 'day', owner: 'reporting' },
      scope: 'enterprise:one', period: { from: '2026-08-09T00:00:00.000Z', to: '2026-09-07T00:00:00.000Z', timezone: 'Asia/Shanghai' },
      dimensions: { mall: '华东商城' }, value: 128800, unit: 'minor', currency: 'CNY',
      watermark: '2026-09-07T00:00:00.000Z', projectionVersion: 8,
    }],
    count: 1,
    snapshot: {
      query: { scope: 'enterprise:one', dimension: 'sales', period: '30days', application: null },
      watermark: { event: 'event:reporting', occurredAt: '2026-09-07T00:00:00.000Z', version: 8 },
      generatedAt: '2026-09-07T00:00:01.000Z', generationVersion: 3,
    },
    preset: null,
  };
}

function exportJob(state: 'queued' | 'completed') {
  const completed = state === 'completed';
  return {
    id: 'export:reporting', scope: 'enterprise:one', report: 'metrics', filter: { view: 'sales', period: '30days' },
    snapshot: { filter: { view: 'sales', period: '30days' }, watermark: reportPage().snapshot.watermark, generatedAt: reportPage().snapshot.generatedAt, generationVersion: 3 },
    state, cursor: null, recordCount: completed ? 1 : 0, objectReference: completed ? 'reports/export.csv' : null,
    objectHash: completed ? 'a'.repeat(64) : null, objectSize: completed ? 128 : null, scanState: completed ? 'clean' : null,
    expiresAt: completed ? '2026-09-08T00:00:00.000Z' : null, createdAt: '2026-09-07T00:00:02.000Z', generatedAt: completed ? '2026-09-07T00:00:03.000Z' : null,
    ...(completed ? { download: { url: 'https://objects.example/report.csv?token=one', expiresAt: '2026-09-07T00:05:03.000Z' } } : {}),
  };
}
