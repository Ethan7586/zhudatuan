// @vitest-environment node
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../entity/session/ConsoleSession';
import { readAccess } from './access/AccessQuery';
import { readApplications } from './application/ApplicationQuery';
import { readChannels } from './channel/ChannelQuery';
import { readFinanceProfessional } from './finance/FinanceProfessionalQuery';
import { readImport } from './importing/ImportQuery';
import { readMembers } from './member/MemberQuery';
import { readNotificationRecords } from './notification/NotificationQuery';
import { readOrderDetail } from './order/OrderDetailQuery';
import { readQualifications } from './qualification/QualificationQuery';
import { readReport } from './report/ReportQuery';
import { readCases, readMessages } from './support/SupportQuery';
import { readVouchers } from './voucher/VoucherQuery';

const requests: string[] = [];
const empty = { items: [], count: 0 };
const importJob = { id: 'job:1', state: 'completed', total_count: 1, cursor_value: 1, success_count: 1, failure_count: 0,
  created_at: '2026-08-26T00:00:00Z', updated_at: '2026-08-26T00:01:00Z', errors: [] };
const server = setupServer(http.get('*', ({ request }) => {
  expect(request.headers.get('x-scope-hint')).toBe('enterprise:1');
  expect(request.headers.get('x-access-version')).toBe('7');
  const pathname = new URL(request.url).pathname;
  requests.push(pathname);
  if (pathname.includes('/imports/')) return HttpResponse.json(importJob);
  if (pathname.endsWith('/messages')) return HttpResponse.json({ ...empty, attachments: [] });
  if (pathname === '/api/v1/access/center') return HttpResponse.json({ ...empty, roles: [] });
  return HttpResponse.json(empty);
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { requests.length = 0; server.resetHandlers(); });
afterAll(() => server.close());

describe('Console professional named reads', () => {
  it('closes every professional read through an explicit scoped SDK method', async () => {
    const signal = new AbortController().signal;
    await Promise.all([
      readApplications(context, undefined, signal),
      ...(['libraries', 'programs', 'reserves', 'batches'] as const).map((view) => readVouchers(context, view, undefined, signal)),
      ...(['sales', 'products', 'malls', 'categories', 'channels', 'powderclass', 'voucher'] as const)
        .map((view) => readReport(context, view, '30days', undefined, signal)),
      readCases(context, undefined, signal), readMessages(context, 'case:1', undefined, signal),
      readAccess(context, undefined, signal), readMembers(context, undefined, signal), readQualifications(context, undefined, signal),
      readNotificationRecords(context, 'templates', undefined, signal), readNotificationRecords(context, 'announcements', undefined, signal),
      ...(['connections', 'syncs', 'operations'] as const).map((view) => readChannels(context, view, undefined, signal)),
      ...(['entries', 'statements', 'reconciliations', 'settlements', 'withdrawals', 'invoices'] as const)
        .map((section) => readFinanceProfessional(context, section, undefined, signal)),
      readImport(context, 'member', 'job:1', signal), readImport(context, 'catalog', 'job:1', signal),
      readImport(context, 'voucher', 'job:1', signal), readOrderDetail(context, 'order:1', signal),
    ]);
    expect([...requests].sort()).toEqual([...expectedPaths].sort());
  });

  it('propagates AbortSignal into a professional Operation', async () => {
    server.use(http.get('*/api/v1/reports/channels', async () => { await delay('infinite'); return HttpResponse.json(empty); }));
    const controller = new AbortController();
    const pending = readReport(context, 'channels', '30days', undefined, controller.signal);
    controller.abort(new Error('SCOPE_CHANGED'));
    await expect(pending).rejects.toThrow();
  });
});

const expectedPaths = [
  '/api/v1/experiences/applications',
  '/api/v1/vouchers/cardlibraries', '/api/v1/vouchers/programs', '/api/v1/vouchers/reserves', '/api/v1/vouchers/batches',
  '/api/v1/reports/sales', '/api/v1/reports/products', '/api/v1/reports/malls', '/api/v1/reports/categories',
  '/api/v1/reports/channels', '/api/v1/reports/powderclass', '/api/v1/reports/voucherconsumption',
  '/api/v1/support/cases', '/api/v1/support/cases/case%3A1/messages', '/api/v1/access/center', '/api/v1/members',
  '/api/v1/qualifications', '/api/v1/notifications/templates', '/api/v1/notifications/announcements',
  '/api/v1/channels/connections', '/api/v1/channels/syncruns', '/api/v1/channels/operations',
  '/api/v1/finance/entries', '/api/v1/finance/statements', '/api/v1/finance/reconciliations', '/api/v1/finance/settlements',
  '/api/v1/finance/withdrawals', '/api/v1/invoices/requests', '/api/v1/members/imports/job%3A1',
  '/api/v1/catalog/imports/job%3A1', '/api/v1/vouchers/imports/job%3A1', '/api/v1/orders',
];

const context: ConsoleContext = {
  session: { actor: 'actor:1', membership: 'membership:1', accessVersion: 7, permissions: [], capabilities: [], target: 'console',
    scope: { kind: 'enterprise', id: 'enterprise:1' }, scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
    assurance: { level: 1 }, syncedAt: '2026-08-26T00:00:00Z' },
  profile: { display_name: '测试运营', employee_no: null },
  scope: { kind: 'enterprise', id: 'enterprise:1' }, scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
};
