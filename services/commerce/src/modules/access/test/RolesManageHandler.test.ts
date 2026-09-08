import { describe, expect, it, vi } from 'vitest';
import type { WriteHandlerContext } from '../../../pipeline/HandlerContext';
import type { WriteTransactionContext } from '../../../platform/database/TransactionContext';
import { RolesManageHandler } from '../application/handler/RolesManageHandler';
import { Membership } from '../domain/model/Membership';
import { Role } from '../domain/model/Role';

describe('RolesManageHandler', () => {
  it('uses a server template as metadata while returning the authoritative draft impact', async () => {
    const saved = new Role({ id: 'role:refund', scope: 'mall:one', name: '退款客服', description: '负责退款申请与客户沟通', status: 'active', version: 0, kind: 'custom', template: 'ordersupport' });
    const repository = {
      separationRules: vi.fn(async () => []),
      roleTemplate: vi.fn(async () => ({ code: 'ordersupport', name: '订单客服', description: '适合订单客服工作', allows: ['order.read'], denies: [], version: 1 })),
      lockRole: vi.fn(async () => null),
      rolePermissions: vi.fn(async () => ({ allows: [], denies: [] })),
      roleImpact: vi.fn(async () => ({ people: 0, scopes: 0 })),
      saveRole: vi.fn(async () => ({ role: saved, allowCount: 1, denyCount: 0 })),
      bumpRole: vi.fn(async () => undefined),
    };
    const result = await new RolesManageHandler(repository as never).execute(
      { path: { roleid: 'role:refund' }, body: { action: 'save', name: '退款客服', description: '负责退款申请与客户沟通', template: 'ordersupport', allows: ['payment.refund'], denies: [] } },
      context(0, ['payment.refund'])
    );
    expect(result.body).toMatchObject({ action: 'save', id: 'role:refund', template: 'ordersupport', impact: { addedAllows: ['payment.refund'], affectedPeople: 0 } });
    expect(repository.saveRole).toHaveBeenCalledWith(transaction, expect.objectContaining({ description: '负责退款申请与客户沟通', allows: ['payment.refund'], expectedVersion: 0 }));
    expect(repository.bumpRole).toHaveBeenCalledWith(transaction, 'role:refund', 'rolepermissionschanged', 'trace:test');
    expect(repository.separationRules).toHaveBeenCalledWith(transaction);
  });

  it('enforces the same current voucher separation rule shown by the permission center', async () => {
    const repository = { separationRules: vi.fn(async () => [{ left: 'voucher.credential.manage', right: 'voucher.issue.manage', reason: '凭证生产与卡券发放必须职责分离' }]), lockRole: vi.fn(), saveRole: vi.fn() };
    const allows = ['voucher.credential.manage', 'voucher.issue.manage'];
    await expect(new RolesManageHandler(repository as never).execute({ path: { roleid: 'role:unsafe' }, body: { action: 'save', name: '卡券操作', allows, denies: [] } }, context(0, allows))).rejects.toThrow('ACCESS_SEPARATION_REQUIRED');
    expect(repository.lockRole).not.toHaveBeenCalled();
    expect(repository.saveRole).not.toHaveBeenCalled();
  });

  it('assigns an active custom role with the target AccessVersion and publishes its new version', async () => {
    const role = new Role({ id: 'role:refund', scope: 'mall:one', name: '退款客服', status: 'active', version: 3, kind: 'custom' });
    const member = new Membership({ id: 'membership:target', organization: 'mall:one', client: 'console', status: 'active', accessVersion: 8 });
    const repository = {
      lockRole: vi.fn(async () => role),
      lockMemberships: vi.fn(async () => [member]),
      rolePermissions: vi.fn(async () => ({ allows: ['payment.refund'], denies: [] })),
      assignRole: vi.fn(async () => true),
      bump: vi.fn(async () => 9),
    };
    const result = await new RolesManageHandler(repository as never).execute({ path: { roleid: role.id }, body: { action: 'assign', targetMembership: member.id } }, context(8, ['payment.refund']));
    expect(result.body).toEqual({ action: 'assign', id: role.id, targetMembership: member.id, accessVersion: 9, changed: true });
    expect(repository.assignRole).toHaveBeenCalledWith(transaction, role.id, member.id, 'membership:test');
    expect(repository.bump).toHaveBeenCalledWith(transaction, member.id, 'roleassigned', 'trace:test');
  });

  it('refuses to delete a role that still affects members', async () => {
    const role = new Role({ id: 'role:refund', scope: 'mall:one', name: '退款客服', status: 'active', version: 3, kind: 'custom' });
    const repository = {
      lockRole: vi.fn(async () => role),
      rolePermissions: vi.fn(async () => ({ allows: ['payment.refund'], denies: [] })),
      roleImpact: vi.fn(async () => ({ people: 1, scopes: 1 })),
      deleteRole: vi.fn(async () => true),
    };
    await expect(new RolesManageHandler(repository as never).execute({ path: { roleid: role.id }, body: { action: 'delete' } }, context(3, ['payment.refund']))).rejects.toThrow('ACCESS_GRANT_CONFLICT');
    expect(repository.deleteRole).not.toHaveBeenCalled();
  });
});

const transaction = {} as WriteTransactionContext;

function context(expectedVersion: number, permissions: readonly string[]): WriteHandlerContext<'access.roles.manage'> {
  return {
    requestId: 'request:test',
    traceId: 'trace:test',
    deadline: Date.now() + 5_000,
    signal: new AbortController().signal,
    operation: 'access.roles.manage',
    headers: {},
    rawBody: '',
    idempotencyKey: 'role:test',
    expectedVersion,
    transaction,
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:test', session: 'session:test', membership: 'membership:test', credentialVersion: 1, accessVersion: 1, target: 'console', assurance: { level: 3 } },
        membership: { id: 'membership:test', active: true, accessVersion: 1, permissions: { allows: new Set(permissions), denies: new Set() }, scopes: [] },
        roles: [],
        organization: 'mall:one',
        scope: { id: 'mall:one', kind: 'mall', path: [] },
        accessVersion: 1,
        capabilities: new Set(['access.roles.manage']),
        capabilityVersion: 1,
        assurance: { level: 3 },
        trace: 'trace:test',
      },
    },
  };
}
