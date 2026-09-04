// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { FederationGateway } from './FederationGateway';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('FederationGateway', () => {
  it('uses the authenticated scope center instead of anonymous provider discovery', async () => {
    server.use(
      http.get('https://shop.test/api/v1/identity/providers/center', ({ request }) => {
        expect(request.headers.get('x-scope-hint')).toBe('mall:one');
        return HttpResponse.json({ items: [{ id: '00000000-0000-4000-8000-000000000001', type: 'oidc', status: 'enabled' }], count: 1 });
      })
    );
    await expect(new FederationGateway('https://shop.test').read(context)).resolves.toMatchObject({ count: 1, items: [{ type: 'oidc' }] });
  });

  it('binds a real provider health check to csrf, access version and stable identity', async () => {
    server.use(
      http.post('https://shop.test/api/v1/identity/providers/00000000-0000-4000-8000-000000000001/tests', ({ request }) => {
        expect(request.headers.get('idempotency-key')).toBe('identity:test');
        expect(request.headers.get('x-csrf-token')).toBe('csrf-token');
        expect(request.headers.get('x-access-version')).toBe('7');
        return HttpResponse.json({ status: 'healthy', checkedat: '2026-09-03T00:00:00.000Z' });
      })
    );
    await expect(new FederationGateway('https://shop.test').test(context, '00000000-0000-4000-8000-000000000001', 'identity:test')).resolves.toMatchObject({ status: 'healthy' });
  });
});

const scope = { kind: 'mall', id: 'mall:one', name: '测试商城' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    accessVersion: 7,
    permissions: ['identity.provider.manage', 'identity.provider.test'],
    capabilities: ['identity.providers.center.read', 'identity.providers.test'],
    target: 'console',
    scope,
    scopes: [scope],
    assurance: { level: 3 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    csrf: 'csrf-token',
    syncedAt: '2026-09-03T00:00:00.000Z',
  },
  profile: { display_name: '管理员', employee_no: null },
  scope,
  scopes: [scope],
};
