// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { AccessChange } from '../model/Access';
import { AccessGateway } from './AccessGateway';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('AccessGateway', () => {
  it('maps the contract DTO into an immutable camel-case model', async () => {
    server.use(
      http.get('https://shop.test/api/v1/access/center', () =>
        HttpResponse.json({
          items: [
            {
              id: 'membership:one',
              display_name: '张三',
              employee_no: 'E1',
              mobile_masked: null,
              client: 'console',
              status: 'active',
              access_version: 7,
              roles: [{ role: 'role:one', name: 'Operator', kind: 'custom', version: 2, allows: ['order.read'], denies: [] }],
              scopes: [{ id: 'scope:one', kind: 'mall', scope: 'mall:one', effect: 'allow', expires: null }],
              overrides: [],
            },
          ],
          count: 1,
        })
      )
    );
    const page = await new AccessGateway('https://shop.test').read(context);
    expect(page.items[0]).toMatchObject({ displayName: '张三', employeeNo: 'E1', accessVersion: 7, roles: [{ id: 'role:one' }], scopes: [{ resource: 'mall:one' }] });
    expect(Object.isFrozen(page.items[0]?.roles)).toBe(true);
  });

  it('sends owner transfer with both versions, proof, CSRF and stable identity', async () => {
    server.use(
      http.put('https://shop.test/api/v1/access/owners/transfer', async ({ request }) => {
        expect(request.headers.get('idempotency-key')).toBe('identity:stable');
        expect(request.headers.get('if-match')).toBe('"11"');
        expect(request.headers.get('x-action-proof')).toBe('p'.repeat(43));
        expect(request.headers.get('x-csrf-token')).toBe('csrf-token');
        expect(await request.json()).toEqual({ targetMembership: 'membership:next', targetVersion: 9, reason: '岗位调整' });
        return HttpResponse.json({ scope: 'mall:one', previousMembership: 'membership:owner', membership: 'membership:next', previousAccessVersion: 12, accessVersion: 10, version: 6 });
      })
    );
    const gateway = new AccessGateway('https://shop.test');
    const result = await gateway.execute(context, ownerChange(), 'p'.repeat(43), 'identity:stable');
    expect(result).toMatchObject({ operation: 'access.owners.transfer', reference: 'membership:next', version: 6 });
  });
});

const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:owner',
    accessVersion: 7,
    permissions: ['access.owner.transfer'],
    capabilities: ['access.owners.transfer'],
    target: 'console',
    scope: { kind: 'mall', id: 'mall:one' },
    scopes: [{ kind: 'mall', id: 'mall:one' }],
    assurance: { level: 3 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    csrf: 'csrf-token',
    syncedAt: '2026-09-03T00:00:00Z',
  },
  profile: { display_name: '负责人', employee_no: 'A001' },
  scope: { kind: 'mall', id: 'mall:one' },
  scopes: [{ kind: 'mall', id: 'mall:one' }],
};

function ownerChange(): Extract<AccessChange, { kind: 'owner' }> {
  const membership = { id: 'membership:owner', displayName: '当前负责人', employeeNo: 'A001', mobileMasked: null, client: 'console' as const, status: 'active' as const, accessVersion: 11, roles: [], scopes: [], overrides: [] };
  const target = { ...membership, id: 'membership:next', displayName: '新负责人', employeeNo: 'A002', accessVersion: 9 };
  return { kind: 'owner', membership, target, reason: '岗位调整' };
}
