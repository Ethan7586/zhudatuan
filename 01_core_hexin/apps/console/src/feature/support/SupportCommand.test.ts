import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { canCreateSupportCase, canSendSupportMessage, createSupportCase, sendSupportMessage } from './SupportCommand';

const requests: Request[] = [];
const bodies: unknown[] = [];
const server = setupServer(
  http.post('*/api/v1/support/cases', async ({ request }) => {
    requests.push(request);
    bodies.push(await request.clone().json());
    return HttpResponse.json({ id: 'case:new', conversation_id: 'conversation:new', priority: 'normal', skill: 'general', state: 'open',
      assigned_agent_id: null, response_due_at: null, resolution_due_at: null, created_at: '2026-09-10T00:00:00.000Z',
      updated_at: '2026-09-10T00:00:00.000Z', version: 0, subject: '退款进度', member_id: null, order_id: null, channel: 'inapp' }, { status: 201 });
  }),
  http.post('*/api/v1/support/cases/:caseid/messages', async ({ request }) => {
    requests.push(request);
    bodies.push(await request.clone().json());
    return HttpResponse.json({ id: 'message:one', author_type: 'agent' }, { status: 201 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  requests.length = 0;
  bodies.length = 0;
});
afterAll(() => server.close());

describe('support message command', () => {
  it('creates a scoped in-app case through the existing generated operation', async () => {
    const value = await createSupportCase(context, { subject: '  退款进度  ', message: '  请协助核实。  ' });

    expect(value).toMatchObject({ id: 'case:new', subject: '退款进度', channel: 'inapp' });
    expect(new URL(requests[0]!.url).pathname).toBe('/api/v1/support/cases');
    expect(bodies).toEqual([{ subject: '退款进度', message: '请协助核实。', channel: 'inapp', priority: 'normal' }]);
    expect(requests[0]?.headers.get('x-csrf-token')).toBe('csrf-token-for-support');
    expect(requests[0]?.headers.get('idempotency-key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reports case creation availability from the existing CSRF, permission and capability', () => {
    expect(canCreateSupportCase(context)).toBe(true);
    expect(canCreateSupportCase(withSession({ csrf: undefined }))).toBe(false);
    expect(canCreateSupportCase(withSession({ permissions: ['support.message.send'] }))).toBe(false);
    expect(canCreateSupportCase(withSession({ capabilities: ['support.messages.send'] }))).toBe(false);
  });

  it('sends a trimmed, scoped, CSRF-bound and versioned message through the generated SDK', async () => {
    const value = await sendSupportMessage(context, {
      caseId: 'case:one',
      caseVersion: 12,
      caseState: 'waiting',
      message: '  您好，退款已经提交。  ',
    });

    expect(value).toMatchObject({ id: 'message:one', author_type: 'agent' });
    expect(new URL(requests[0]!.url).pathname).toBe('/api/v1/support/cases/case%3Aone/messages');
    expect(bodies).toEqual([{ message: '您好，退款已经提交。' }]);
    expect(requests[0]?.headers.get('x-scope-hint')).toBe('tenant:one');
    expect(requests[0]?.headers.get('x-access-version')).toBe('7');
    expect(requests[0]?.headers.get('x-csrf-token')).toBe('csrf-token-for-support');
    expect(requests[0]?.headers.get('if-match')).toBe('"12"');
    expect(requests[0]?.headers.get('idempotency-key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reports availability from CSRF, permission, capability and case state', () => {
    expect(canSendSupportMessage(context, 'open')).toBe(true);
    expect(canSendSupportMessage(withSession({ csrf: undefined }), 'open')).toBe(false);
    expect(canSendSupportMessage(withSession({ permissions: [] }), 'open')).toBe(false);
    expect(canSendSupportMessage(withSession({ capabilities: [] }), 'open')).toBe(false);
    expect(canSendSupportMessage(context, ' CLOSED ')).toBe(false);
  });

  it('rejects unavailable or closed cases before transport', async () => {
    await expect(sendSupportMessage(withSession({ csrf: undefined }), draft)).rejects.toThrow('SUPPORT_MESSAGE_CSRF_MISSING');
    await expect(sendSupportMessage(withSession({ permissions: [] }), draft)).rejects.toThrow('SUPPORT_MESSAGE_NOT_AVAILABLE');
    await expect(sendSupportMessage(withSession({ capabilities: [] }), draft)).rejects.toThrow('SUPPORT_MESSAGE_NOT_AVAILABLE');
    await expect(sendSupportMessage(context, { ...draft, caseState: 'closed' })).rejects.toThrow('SUPPORT_CASE_CLOSED');
    expect(requests).toHaveLength(0);
  });

  it('rejects blank and oversized messages before transport', async () => {
    await expect(sendSupportMessage(context, { ...draft, message: ' \n ' })).rejects.toThrow('SUPPORT_MESSAGE_EMPTY');
    await expect(sendSupportMessage(context, { ...draft, message: ` ${'a'.repeat(4001)} ` })).rejects.toThrow('SUPPORT_MESSAGE_TOO_LONG');
    expect(requests).toHaveLength(0);
  });
});

const tenantScope = { kind: 'tenant', id: 'tenant:one', tenant: 'tenant:one' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:agent',
    membership: 'membership:agent',
    accessVersion: 7,
    permissions: ['support.message.send', 'support.case.create'],
    capabilities: ['support.messages.send', 'support.cases.create'],
    assurance: { level: 2 },
    csrf: 'csrf-token-for-support',
    target: 'console',
    scope: tenantScope,
    scopes: [tenantScope],
    syncedAt: '2026-08-30T00:00:00.000Z',
  },
  profile: { display_name: '客服一号', employee_no: 'CS-001' },
  scope: tenantScope,
  scopes: [tenantScope],
};

const draft = { caseId: 'case:one', caseVersion: 12, caseState: 'open', message: '收到' } as const;

function withSession(overrides: Partial<ConsoleContext['session']>): ConsoleContext {
  return { ...context, session: { ...context.session, ...overrides } };
}
