// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { OwnerChange, Ownership, OwnershipTransfer } from '../model/Access';
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
              roles: [{ role: 'role:one', name: 'Operator', description: '订单运营角色', status: 'active', kind: 'custom', template: 'ordersupport', version: 2, allows: ['order.read'], denies: [] }],
              scopes: [{ id: 'scope:one', kind: 'mall', scope: 'mall:one', effect: 'allow', expires: null }],
              overrides: [],
            },
          ],
          count: 1,
          roles: [{ id: 'role:one', name: 'Operator', description: '订单运营角色', status: 'active', kind: 'custom', template: 'ordersupport', version: 2, allows: ['order.read'], denies: [], affectedPeople: 1, affectedScopes: 1, members: [{ membership: 'membership:one', displayName: '张三', accessVersion: 7 }] }],
          templates: [{ code: 'ordersupport', name: '订单客服', description: '适合订单客服工作', allows: ['order.read'], denies: [], version: 1 }],
          separationRules: [],
        })
      )
    );
    const page = await new AccessGateway('https://shop.test').read(context);
    expect(page.items[0]).toMatchObject({ displayName: '张三', employeeNo: 'E1', accessVersion: 7, roles: [{ id: 'role:one' }], scopes: [{ resource: 'mall:one' }] });
    expect(Object.isFrozen(page.items[0]?.roles)).toBe(true);
  });

  it('reads ownership candidates, former-owner roles and pending state', async () => {
    server.use(http.get('https://shop.test/api/v1/access/ownership', () => HttpResponse.json(ownershipDto())));
    const ownership = await new AccessGateway('https://shop.test').readOwnership(context);
    expect(ownership).toMatchObject({ version: 4, owner: { displayName: '当前负责人' }, candidates: [{ displayName: '新负责人', accessVersion: 9 }], pending: null });
    expect(Object.isFrozen(ownership.candidates)).toBe(true);
  });

  it('previews before sending a version-bound owner transfer request', async () => {
    server.use(
      http.post('https://shop.test/api/v1/access/ownership/transfers/preview', async ({ request }) => {
        expect(request.headers.get('if-match')).toBe('"4"');
        expect(request.headers.get('idempotency-key')).toBe('identity:preview');
        expect(await request.json()).toEqual(ownerBody());
        return HttpResponse.json({ ...impactDto(), state: 'draft', formerOwnerMode: 'retain_admin', formerOwnerRole: 'role:operator', coolingUntil: '2026-09-05T00:00:00Z', expiresAt: '2026-09-11T00:00:00Z' });
      })
    );
    const preview = await new AccessGateway('https://shop.test').previewOwnership(context, ownerChange(), 'identity:preview');
    expect(preview).toMatchObject({ action: 'create', state: 'draft', impact: { affectedPeople: 2, affectedScopes: 1 } });
  });

  it('creates a pending transfer with proof, CSRF and stable identity', async () => {
    server.use(
      http.post('https://shop.test/api/v1/access/ownership/transfers', async ({ request }) => {
        expect(request.headers.get('idempotency-key')).toBe('identity:stable');
        expect(request.headers.get('if-match')).toBe('"4"');
        expect(request.headers.get('x-action-proof')).toBe('p'.repeat(43));
        expect(request.headers.get('x-csrf-token')).toBe('csrf-token');
        expect(await request.json()).toEqual(ownerBody());
        return HttpResponse.json(transferDto());
      })
    );
    const gateway = new AccessGateway('https://shop.test');
    const result = await gateway.execute(context, ownerChange(), 'p'.repeat(43), 'identity:stable');
    expect(result).toMatchObject({ operation: 'access.ownership.transfers.create', reference: 'ownershiptransfer:one', version: 2 });
  });

  it('dispatches accept and cancel previews and commits to their explicit endpoints', async () => {
    const transfer = transferDto();
    const pending = { ...ownershipModel(), pending: transfer };
    const accept: OwnerChange = { kind: 'owner', action: 'accept', ownership: pending, transfer };
    const cancel: OwnerChange = { kind: 'owner', action: 'cancel', ownership: pending, transfer, reason: '岗位调整取消' };
    server.use(
      http.post('https://shop.test/api/v1/access/ownership/transfers/ownershiptransfer:one/accept/preview', ({ request }) => {
        expect(request.headers.get('if-match')).toBe('"2"');
        return HttpResponse.json({ transfer, impact: impactDto() });
      }),
      http.post('https://shop.test/api/v1/access/ownership/transfers/ownershiptransfer:one/cancel/preview', async ({ request }) => {
        expect(await request.json()).toEqual({ reason: '岗位调整取消' });
        return HttpResponse.json({ transfer, impact: impactDto(), reason: '岗位调整取消' });
      }),
      http.post('https://shop.test/api/v1/access/ownership/transfers/ownershiptransfer:one/accept', () =>
        HttpResponse.json({ ownership: { ...ownershipDto(), version: 5, owner: { membership: 'membership:next', member: 'member:next', principal: 'principal:next', displayName: '新负责人' }, candidates: [], pending: null }, transfer: { ...transfer, state: 'accepted', version: 3 } })
      ),
      http.post('https://shop.test/api/v1/access/ownership/transfers/ownershiptransfer:one/cancel', () => HttpResponse.json({ ...transfer, state: 'cancelled', version: 3 }))
    );
    const gateway = new AccessGateway('https://shop.test');
    await expect(gateway.previewOwnership(context, accept, 'identity:accept-preview')).resolves.toMatchObject({ action: 'accept', transfer: { id: 'ownershiptransfer:one' } });
    await expect(gateway.previewOwnership(context, cancel, 'identity:cancel-preview')).resolves.toMatchObject({ action: 'cancel', reason: '岗位调整取消' });
    await expect(gateway.execute(context, accept, 'a'.repeat(43), 'identity:accept')).resolves.toMatchObject({ operation: 'access.ownership.transfers.accept', version: 5 });
    await expect(gateway.execute(context, cancel, 'b'.repeat(43), 'identity:cancel')).resolves.toMatchObject({ operation: 'access.ownership.transfers.cancel', version: 3 });
  });
});

const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:owner',
    accessVersion: 7,
    permissions: ['access.ownership.read', 'access.ownership.transfer'],
    capabilities: ['access.ownership.read', 'access.ownership.transfers.preview', 'access.ownership.transfers.create'],
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

function ownerChange(): OwnerChange {
  const ownership = ownershipModel();
  return { kind: 'owner', action: 'create', ownership, target: ownership.candidates[0]!, formerOwnerMode: 'retain_admin', formerOwnerRole: 'role:operator', reason: '岗位调整' };
}

function ownershipModel(): Ownership {
  return {
    state: 'active',
    version: 4,
    mobileReady: true,
    owner: { membership: 'membership:owner', member: 'member:owner', principal: 'principal:owner', displayName: '当前负责人' },
    candidates: [{ membership: 'membership:next', member: 'member:next', principal: 'principal:next', displayName: '新负责人', roles: [], accessVersion: 9, mobileReady: true }],
    formerOwnerRoles: [{ id: 'role:operator', name: '运营管理员', version: 3 }],
    pending: null,
  };
}

function ownerBody() {
  return { targetMembership: 'membership:next', targetAccessVersion: 9, formerOwnerMode: 'retain_admin', formerOwnerRole: 'role:operator', reason: '岗位调整' };
}

function ownershipDto() {
  return ownershipModel();
}

function transferDto(): OwnershipTransfer {
  return {
    id: 'ownershiptransfer:one',
    state: 'pending',
    sourceMembership: 'membership:owner',
    targetMembership: 'membership:next',
    targetMember: 'member:next',
    targetPrincipal: 'principal:next',
    targetDisplayName: '新负责人',
    formerOwnerMode: 'retain_admin',
    formerOwnerRole: 'role:operator',
    formerOwnerRoleVersion: 3,
    coolingUntil: '2026-09-05T00:00:00Z',
    expiresAt: '2026-09-11T00:00:00Z',
    version: 2,
  };
}

function impactDto() {
  return {
    sourceMembership: 'membership:owner',
    targetMembership: 'membership:next',
    ownershipVersion: 4,
    targetAccessVersion: 9,
    formerOwnerRoleVersion: 3,
    affectedPeople: 2,
    affectedScopes: 1,
    warnings: ['接受后双方权限版本立即递增'],
  };
}
