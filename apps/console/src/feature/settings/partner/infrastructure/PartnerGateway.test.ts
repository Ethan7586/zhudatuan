// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { PartnerGateway } from './PartnerGateway';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('PartnerGateway', () => {
  it('requests an exact server-side kind and maps qualification evidence', async () => {
    server.use(
      http.get('https://shop.test/api/v1/partners', ({ request }) => {
        expect(new URL(request.url).searchParams.get('kind')).toBe('supplier');
        return HttpResponse.json({ items: [partner], count: 1 });
      })
    );
    const page = await new PartnerGateway('https://shop.test').readPartners(context, 'supplier');
    expect(page.items[0]).toMatchObject({ kind: 'supplier', scopeId: 'enterprise:server', qualification: { valid: 2, pending: 1, expired: 0 } });
    expect(Object.isFrozen(page.items)).toBe(true);
  });

  it('preserves idempotency and version while omitting unchanged address plaintext', async () => {
    server.use(
      http.put('https://shop.test/api/v1/organizations/stores/store%3Aone', async ({ request }) => {
        expect(request.headers.get('idempotency-key')).toBe('identity:stable');
        expect(request.headers.get('if-match')).toBe('"4"');
        expect(await request.json()).toEqual({ name: '静安门店', status: 'active', regionCode: 'CN-31', mall: 'mall:one', serviceRadiusMeters: 5000 });
        return HttpResponse.json({ id: 'store:one', scope: 'mall:one', name: '静安门店', status: 'active', version: 5, mall: 'mall:one', regionCode: 'CN-31', serviceRadiusMeters: 5000, addressConfigured: true });
      })
    );
    const receipt = await new PartnerGateway('https://shop.test').manageStore(
      context,
      { id: 'store:one', name: '静安门店', status: 'active', version: 4, mallId: 'mall:one', regionCode: 'CN-31', serviceRadiusMeters: 5000 },
      'identity:stable'
    );
    expect(receipt).toEqual({ id: 'store:one', kind: 'store', version: 5 });
  });
});

const qualification = { valid: 2, pending: 1, rejected: 0, expired: 0, nearest_expiry: '2027-01-01T00:00:00.000Z' };
const partner = { id: 'supplier:one', scope_id: 'enterprise:server', kind: 'supplier', name: '云海供应商', status: 'active', version: 3, qualification, created_at: '2026-09-03T00:00:00.000Z', updated_at: '2026-09-03T00:00:00.000Z' };
const scope = { kind: 'mall', id: 'mall:one', name: '测试商城' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    accessVersion: 7,
    permissions: ['partner.read', 'partner.manage'],
    capabilities: ['partner.partners.read', 'partner.partners.manage', 'organization.stores.read', 'organization.stores.manage'],
    target: 'console',
    scope,
    scopes: [scope],
    assurance: { level: 2 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    csrf: 'csrf-token',
    syncedAt: '2026-09-03T00:00:00.000Z',
  },
  profile: { display_name: '管理员', employee_no: 'A001' },
  scope,
  scopes: [scope],
};
