// @vitest-environment node
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../entity/session/ConsoleSession';
import { AccessGateway } from './settings/access/infrastructure/AccessGateway';
import { ExperienceGateway } from './experience/infrastructure/ExperienceGateway';
import { ChannelGateway } from './channel/infrastructure/ChannelGateway';
import { FinanceGateway } from './finance/infrastructure/FinanceGateway';
import { TaskGateway } from './task/infrastructure/TaskGateway';
import { MemberGateway } from './settings/member/infrastructure/MemberGateway';
import { NotificationGateway } from './settings/notification/infrastructure/NotificationGateway';
import { QualificationGateway } from './settings/qualification/infrastructure/QualificationGateway';
import { ReportingGateway } from './reporting/infrastructure/ReportingGateway';
import { SupportGateway } from './support/infrastructure/SupportGateway';
import { appConfig } from '../shared/config/AppConfig';
import { VoucherGateway } from './voucher/infrastructure/VoucherGateway';

const requests: string[] = [];
const reportQueries: string[] = [];
const support = new SupportGateway({ apiBaseUrl: appConfig.apiBaseUrl });
const voucher = new VoucherGateway(appConfig.apiBaseUrl);
const reporting = new ReportingGateway(appConfig.apiBaseUrl);
const channel = new ChannelGateway(appConfig.apiBaseUrl);
const experience = new ExperienceGateway(appConfig.apiBaseUrl);
const finance = new FinanceGateway(appConfig.apiBaseUrl);
const access = new AccessGateway(appConfig.apiBaseUrl);
const members = new MemberGateway(appConfig.apiBaseUrl);
const tasks = new TaskGateway(appConfig.apiBaseUrl);
const notifications = new NotificationGateway(appConfig.apiBaseUrl);
const qualifications = new QualificationGateway(appConfig.apiBaseUrl);
const empty = { items: [], count: 0 };
const runtimeTask = {
  id: 'job:1',
  type: 'import',
  owner: 'member',
  kind: 'member',
  title: '成员导入',
  state: 'completed',
  processed: 1,
  total: 1,
  succeeded: 1,
  failed: 0,
  retryableItems: 0,
  cancellable: false,
  retryable: false,
  version: 1,
  createdAt: '2026-08-26T00:00:00Z',
  updatedAt: '2026-08-26T00:01:00Z',
  expiresAt: null,
  fileName: 'member.csv',
  downloadAvailable: false,
  confirmationRequired: false,
  previewHash: null,
  columns: [],
  validationErrors: 0,
};
const server = setupServer(
  http.get('*', ({ request }) => {
    expect(request.headers.get('x-scope-hint')).toBe('enterprise:1');
    expect(request.headers.get('x-access-version')).toBe('7');
    const url = new URL(request.url);
    const pathname = url.pathname;
    requests.push(pathname);
    if (pathname.startsWith('/api/v1/runtime/imports/')) return HttpResponse.json(runtimeTask);
    if (pathname.startsWith('/api/v1/runtime/exports/')) return HttpResponse.json({ ...runtimeTask, type: 'export', owner: 'reporting', kind: 'sales', title: '销售报表导出', fileName: null });
    if (pathname.startsWith('/api/v1/reports/')) {
      reportQueries.push(url.search);
      const preset = url.searchParams.get('dimensionpreset') === 'customermember'
        ? { code: 'customermember', name: '客户 / 会员分层', description: '当前客户范围内的会员购买分层', dimensions: ['customer', 'member'], privacy: 'masked', version: 1, owner: 'reporting' }
        : null;
      const page = {
        ...empty,
        snapshot: {
          query: { scope: 'enterprise:1', dimension: preset ? 'member' : null, period: '30days', application: null },
          watermark: { event: 'event:one', occurredAt: '2026-09-05T00:00:00.000Z', version: 1 },
          generatedAt: '2026-09-05T00:00:01.000Z',
          generationVersion: 1,
        },
      };
      return HttpResponse.json(pathname === '/api/v1/reports/sales' ? { ...page, preset } : page);
    }
    if (pathname === '/api/v1/access/center') return HttpResponse.json({ items: [], count: 0, roles: [], templates: [], separationRules: [] });
    if (pathname.endsWith('/messages')) {
      return HttpResponse.json({
        ...empty,
        attachments: [],
        context: { member: { id: 'member:1', displayName: '测试员工', employeeNo: null, mobileMasked: null }, organization: { id: 'enterprise:1' }, orders: [], benefits: [] },
        conversationVersion: 1,
        latestSequence: 0,
        lastReadSequence: 0,
      });
    }
    return HttpResponse.json(pathname === '/api/v1/qualifications' ? { ...empty, cases: [] } : empty);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  requests.length = 0;
  reportQueries.length = 0;
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Console professional named reads', () => {
  it('closes every professional read through an explicit scoped SDK method', async () => {
    const signal = new AbortController().signal;
    await Promise.all([
      experience.applications(context, undefined, signal),
      ...(['products', 'pools', 'credentials', 'stocks', 'issues', 'vouchers', 'actions'] as const).map((view) => voucher.read(context, view, {}, signal)),
      ...(['sales', 'products', 'malls', 'categories', 'channels', 'members', 'voucher'] as const).map((view) => reporting.read(context, { view, period: '30days' }, signal)),
      support.queue(context, { limit: 50 }, signal),
      support.conversation(context, 'case:1', undefined, signal),
      access.read(context, undefined, signal),
      members.read(context, undefined, signal),
      qualifications.read(context, undefined, signal),
      notifications.readTemplates(context, undefined, undefined, signal),
      notifications.readAnnouncements(context, undefined, signal),
      ...(['connections', 'syncs', 'operations'] as const).map((view) => channel.read(context, view, undefined, signal)),
      ...(['entries', 'statements', 'reconciliations', 'settlements', 'withdrawals', 'invoices'] as const).map((section) => finance.section(context, section, undefined, signal)),
      tasks.read(context, 'import', 'job:1', signal),
      tasks.read(context, 'export', 'job:1', signal),
    ]);
    expect([...requests].sort()).toEqual([...expectedPaths].sort());
    expect(reportQueries.filter((query) => new URLSearchParams(query).get('dimensionpreset') === 'customermember')).toHaveLength(1);
    expect(reportQueries.filter((query) => new URLSearchParams(query).has('dimensionpreset'))).toHaveLength(1);
  });

  it('propagates AbortSignal into a professional Operation', async () => {
    server.use(
      http.get('*/api/v1/reports/channels', async () => {
        await delay('infinite');
        return HttpResponse.json(empty);
      })
    );
    const controller = new AbortController();
    const pending = reporting.read(context, { view: 'channels', period: '30days' }, controller.signal);
    controller.abort(new Error('SCOPE_CHANGED'));
    await expect(pending).rejects.toThrow();
  });
});

const expectedPaths = [
  '/api/v1/experiences/applications',
  '/api/v1/vouchers/products',
  '/api/v1/vouchers/credential-pools',
  '/api/v1/vouchers/credentials',
  '/api/v1/vouchers/stock-requests',
  '/api/v1/vouchers/issue-orders',
  '/api/v1/vouchers/search',
  '/api/v1/vouchers/action-batches',
  '/api/v1/reports/sales',
  '/api/v1/reports/sales',
  '/api/v1/reports/products',
  '/api/v1/reports/malls',
  '/api/v1/reports/categories',
  '/api/v1/reports/channels',
  '/api/v1/reports/voucherconsumption',
  '/api/v1/support/cases',
  '/api/v1/support/cases/case%3A1/messages',
  '/api/v1/access/center',
  '/api/v1/members',
  '/api/v1/qualifications',
  '/api/v1/notifications/templates',
  '/api/v1/notifications/announcements',
  '/api/v1/channels/connections',
  '/api/v1/channels/syncruns',
  '/api/v1/channels/operations',
  '/api/v1/finance/entries',
  '/api/v1/finance/statements',
  '/api/v1/finance/reconciliations',
  '/api/v1/finance/settlements',
  '/api/v1/finance/withdrawals',
  '/api/v1/invoices/requests',
  '/api/v1/runtime/imports/job%3A1',
  '/api/v1/runtime/exports/job%3A1',
];

const context: ConsoleContext = {
  session: {
    actor: 'actor:1',
    membership: 'membership:1',
    accessVersion: 7,
    permissions: [],
    capabilities: [],
    target: 'console',
    scope: { kind: 'enterprise', id: 'enterprise:1' },
    scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
    assurance: { level: 1 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    syncedAt: '2026-08-26T00:00:00Z',
  },
  profile: { display_name: '测试运营', employee_no: null },
  scope: { kind: 'enterprise', id: 'enterprise:1' },
  scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
};
