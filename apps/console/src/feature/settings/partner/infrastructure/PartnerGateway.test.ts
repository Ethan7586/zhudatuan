// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { PartnerGateway } from './PartnerGateway';
import { CustomerDtoSchema } from './PartnerSchema';

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

  it('reads only masked customer fields with exact server-side filters', async () => {
    server.use(http.get('https://shop.test/api/v1/partners/customers', ({ request }) => {
      const query = new URL(request.url).searchParams;
      expect({ q: query.get('q'), kind: query.get('kind'), status: query.get('status') }).toEqual({ q: '华东', kind: 'enterprise', status: 'active' });
      return HttpResponse.json({ items: [customer], count: 1 });
    }));
    const page = await new PartnerGateway('https://shop.test').readCustomers(context, { q: '华东', kind: 'enterprise', status: 'active' });
    expect(page.items[0]).toMatchObject({ identifierMasked: '9131****0ABC', contacts: [{ nameMasked: '张**', phoneMasked: '138****8000' }] });
    expect(JSON.stringify(page)).not.toContain('13800138000');
    expect(Object.isFrozen(page.items)).toBe(true);
  });

  it('loads a single masked customer through the detail operation', async () => {
    server.use(http.get('https://shop.test/api/v1/partners/customers/partnercustomer%3Aone', () => HttpResponse.json(customer)));
    const detail = await new PartnerGateway('https://shop.test').readCustomer(context, 'partnercustomer:one');
    expect(detail).toMatchObject({ id: 'partnercustomer:one', identifierMasked: '9131****0ABC', contacts: [{ nameMasked: '张**' }] });
    expect(Object.isFrozen(detail.contacts)).toBe(true);
  });

  it('uses the dedicated create, update, enable and disable customer operations', async () => {
    const requests: Readonly<{ method: string; path: string; body: unknown; version: string | null }>[] = [];
    server.use(
      http.post('https://shop.test/api/v1/partners/customers', capture('draft', requests)),
      http.patch('https://shop.test/api/v1/partners/customers/partnercustomer%3Aone', capture('draft', requests)),
      http.post('https://shop.test/api/v1/partners/customers/partnercustomer%3Aone/enable', capture('active', requests)),
      http.post('https://shop.test/api/v1/partners/customers/partnercustomer%3Aone/disable', capture('disabled', requests)),
    );
    const gateway = new PartnerGateway('https://shop.test');
    await gateway.manageCustomer(context, { kind: 'create', body: { identifier: '91310000TEST0ABC', name: '华东福利客户', kind: 'enterprise', contact: { kind: 'primary', name: '张三', phone: '13800138000' } } }, 'create:stable');
    await gateway.manageCustomer(context, { kind: 'update', customer, body: { name: '华东福利客户二部' } }, 'update:stable');
    await gateway.manageCustomer(context, { kind: 'enable', customer: { ...customer, status: 'draft' }, reason: '协议核验完成' }, 'enable:stable');
    await gateway.manageCustomer(context, { kind: 'disable', customer, reason: '合作协议到期' }, 'disable:stable');
    expect(requests).toEqual([
      { method: 'POST', path: '/api/v1/partners/customers', body: { identifier: '91310000TEST0ABC', name: '华东福利客户', kind: 'enterprise', contact: { kind: 'primary', name: '张三', phone: '13800138000' } }, version: null },
      { method: 'PATCH', path: '/api/v1/partners/customers/partnercustomer%3Aone', body: { name: '华东福利客户二部' }, version: '"3"' },
      { method: 'POST', path: '/api/v1/partners/customers/partnercustomer%3Aone/enable', body: { reason: '协议核验完成' }, version: '"3"' },
      { method: 'POST', path: '/api/v1/partners/customers/partnercustomer%3Aone/disable', body: { reason: '合作协议到期' }, version: '"3"' },
    ]);
  });
});

function capture(status: 'draft' | 'active' | 'disabled', requests: Array<{ method: string; path: string; body: unknown; version: string | null }>) {
  return async ({ request }: { request: Request }) => {
    expect(request.headers.get('x-csrf-token')).toBe('csrf-token');
    expect(request.headers.get('idempotency-key')).toBeTruthy();
    requests.push({ method: request.method, path: new URL(request.url).pathname, body: await request.json(), version: request.headers.get('if-match') });
    return HttpResponse.json({ ...customer, status, version: customer.version + 1 });
  };
}

const qualification = { valid: 2, pending: 1, rejected: 0, expired: 0, nearest_expiry: '2027-01-01T00:00:00.000Z' };
const partner = { id: 'supplier:one', scope_id: 'enterprise:server', kind: 'supplier', name: '云海供应商', status: 'active', version: 3, qualification, created_at: '2026-09-03T00:00:00.000Z', updated_at: '2026-09-03T00:00:00.000Z' };
const customer = CustomerDtoSchema.parse({
  id: 'partnercustomer:one', scopeId: 'mall:one', identifierMasked: '9131****0ABC', name: '华东福利客户', kind: 'enterprise' as const,
  status: 'active' as const, version: 3, contacts: [{ id: 'customercontact:one', kind: 'primary' as const, nameMasked: '张**', phoneMasked: '138****8000', emailMasked: null, configured: true as const, version: 1 }],
  agreement: { id: 'customeragreement:one', contractRef: 'contract:one', contractHash: 'a'.repeat(64), capabilities: ['voucher.issue'], status: 'active' as const, effectiveAt: '2026-01-01T00:00:00.000Z', expiresAt: '2027-01-01T00:00:00.000Z', version: 2 },
  createdAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z',
});
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
