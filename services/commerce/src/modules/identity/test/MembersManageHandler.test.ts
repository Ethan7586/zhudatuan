import { describe, expect, it, vi } from 'vitest';
import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import type { OperationRequest } from '../../../foundation/application/OperationRequest';
import { MembersManageHandler } from '../application/handler/MembersManageHandler';

describe('members manage handler', () => {
  it('reuses the durable one-time enrollment lifecycle for member creation without accepting an initial password', async () => {
    const load = vi.fn(async (_request: OperationRequest) => ({ kind: 'none' as const }));
    const prepare = vi.fn(async () => ({ invitation: 'invitation:one', code: { clear: vi.fn() } }));
    const execute = vi.fn(async () => ({ status: 201, body: enrollment }));
    const finalize = vi.fn(async (_request, result) => result);
    const handler = new MembersManageHandler(vi.fn(), { load, prepare, execute, finalize } as never);
    const input = {
      path: { membershipid: 'new' },
      body: {
        action: 'create', target: 'storefront', organizationId: 'mall:one', displayName: '新成员', mobile: '13800138000',
        employeeNo: 'E1008', departmentId: 'department:one', expiresAt: '2026-09-11T00:00:00.000Z', reason: '新增福利商城成员',
      },
    };
    const context = operationContext();

    const loaded = await handler.load(input as never, context as never);
    const prepared = await handler.prepare(input as never, context as never, loaded);
    const committed = await handler.commit(input as never, prepared, context as never);
    const finalized = await handler.finalize(input as never, committed.checkpoint, context as never);

    const mapped = load.mock.calls[0]?.[0]?.input.body;
    expect(mapped).toEqual({
      kind: 'enrollment', target: 'storefront', organizationId: 'mall:one',
      employee: { displayName: '新成员', mobile: '13800138000', employeeNo: 'E1008', departmentId: 'department:one' },
      expiresAt: '2026-09-11T00:00:00.000Z', reason: '新增福利商城成员',
    });
    expect(JSON.stringify(mapped)).not.toContain('password');
    expect(finalized.body).toEqual({ action: 'create', enrollment });
    expect(handler.idempotencyResponse(finalized).body).toMatchObject({ action: 'create', enrollment: { code: '' } });
  });
});

function operationContext() {
  return {
    requestId: 'request:one', traceId: 'trace:one', deadline: Date.now() + 1_000, signal: new AbortController().signal,
    operation: 'identity.members.manage', security: { kind: 'session', access: {
      actor: { id: 'principal:admin', session: 'session:admin', membership: 'membership:admin', credentialVersion: 1, accessVersion: 3, target: 'console', assurance: { level: 3 } },
      membership: { id: 'membership:admin', active: true, accessVersion: 3, permissions: { allows: new Set(['member.manage', 'identity.invitation.issue']), denies: new Set() }, scopes: [] },
      roles: [], organization: 'mall:one', scope: { id: 'mall:one', kind: 'mall', path: [] }, accessVersion: 3,
      capabilities: new Set(['identity.members.manage']), capabilityVersion: 1, assurance: { level: 3 }, trace: 'trace:one',
    } }, headers: {}, rawBody: '',
    idempotencyKey: 'member:create', expectedVersion: 3, transaction: {} as WriteTransactionContext,
    emit: vi.fn(),
  };
}

const enrollment = {
  id: 'invitation:one', kind: 'enrollment', target: 'storefront', organizationId: 'mall:one', membershipId: 'membership:one',
  maxUses: 1, useCount: 0, expiresAt: '2026-09-11T00:00:00.000Z', status: 'active', version: 1, code: 'one-time-code',
  recipientMasked: '138****8000', employee: { displayName: '新成员', employeeNo: 'E1008' },
};
