// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { NotificationGateway } from './NotificationGateway';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('NotificationGateway', () => {
  it('uses an exact server-side SMS filter and immutable mapping', async () => {
    server.use(
      http.get('https://shop.test/api/v1/notifications/templates', ({ request }) => {
        expect(new URL(request.url).searchParams.get('channel')).toBe('sms');
        return HttpResponse.json({ items: [template], count: 1 });
      })
    );
    const page = await new NotificationGateway('https://shop.test').readTemplates(context, 'sms');
    expect(page.items[0]).toMatchObject({ scopeId: 'mall:one', channel: 'sms', variables: { code: 'string' } });
    expect(Object.isFrozen(page.items)).toBe(true);
  });

  it('sends proof, expected version, csrf and stable identity through the write boundary', async () => {
    const proof = 'p'.repeat(43);
    server.use(
      http.put('https://shop.test/api/v1/notifications/templates/template%3Aone', async ({ request }) => {
        expect(request.headers.get('if-match')).toBe('"1"');
        expect(request.headers.get('x-action-proof')).toBe(proof);
        expect(request.headers.get('x-csrf-token')).toBe('csrf-token');
        expect(request.headers.get('idempotency-key')).toBe('identity:stable');
        expect(await request.json()).toEqual({ channel: 'sms', eventType: 'identity.challenge', version: 1, variables: { code: 'string' }, providerTemplate: 'SMS_100', subject: null, body: '验证码 {{code}}', purpose: 'transactional', mandatory: true, status: 'active' });
        return HttpResponse.json({ ...template, status: 'active', matches: true, inserted: false });
      })
    );
    const saved = await new NotificationGateway('https://shop.test').manageTemplate(
      context,
      {
        id: template.id,
        channel: template.channel,
        eventType: template.event_type,
        version: template.version,
        variables: template.variable_schema,
        providerTemplate: template.provider_template,
        subject: template.subject,
        body: template.body,
        purpose: template.purpose,
        mandatory: template.mandatory,
        status: 'active',
        expectedVersion: 1,
      },
      proof,
      'identity:stable'
    );
    expect(saved).toMatchObject({ id: 'template:one', status: 'active', inserted: false });
  });
});

const template = {
  id: 'template:one',
  scope_id: 'mall:one',
  channel: 'sms' as const,
  event_type: 'identity.challenge',
  version: 1,
  variable_schema: { code: 'string' } as const,
  provider_template: 'SMS_100',
  subject: null,
  body: '验证码 {{code}}',
  purpose: 'transactional' as const,
  mandatory: true,
  status: 'draft' as const,
  created_at: '2026-09-03T00:00:00.000Z',
};
const scope = { kind: 'mall', id: 'mall:one', name: '测试商城' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    accessVersion: 7,
    permissions: ['notification.template.read', 'notification.template.manage'],
    capabilities: ['notification.templates.read', 'notification.templates.manage'],
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
