import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../../foundation/application/OperationExecution';
import { Role } from '../../domain/model/Role';
import type { AccessRepository } from '../port/AccessRepository';
import type { AccessVersionService } from '../service/AccessVersionService';
import { ManageRole } from './ManageRole';

describe('ManageRole', () => {
  it('replaces allow and deny sets and invalidates every affected membership', async () => {
    const lockRole = vi.fn(async () => new Role({ id: 'role:operator', scope: 'tenant:one', name: 'Operator', status: 'active', version: 3, kind: 'custom' }));
    const saveRole = vi.fn(async () => Object.freeze({ role: new Role({ id: 'role:operator', scope: 'tenant:one', name: 'Operator', status: 'active', version: 4, kind: 'custom' }), allowCount: 1, denyCount: 1 }));
    const bumpRole = vi.fn(async () => undefined);
    const command = new ManageRole({ lockRole, saveRole } as unknown as AccessRepository, { bumpRole } as unknown as AccessVersionService);
    const response = await command.execute(request(), {} as OperationDatabase);
    expect(saveRole).toHaveBeenCalledWith(expect.anything(), { role: 'role:operator', scope: 'tenant:one', name: 'Operator', allows: ['order.read'], denies: ['member.read'], expectedVersion: 3 });
    expect(bumpRole).toHaveBeenCalledWith(expect.anything(), 'role:operator', 'rolepermissionschanged', 'trace:role');
    expect(response).toEqual({ status: 200, body: { id: 'role:operator', scopeId: 'tenant:one', name: 'Operator', status: 'active', version: 4, allowCount: 1, denyCount: 1 } });
  });
});

function request(): OperationRequest {
  return {
    type: 'access.roles.manage',
    input: {
      path: { roleid: 'role:operator' },
      query: {},
      headers: {},
      body: { name: 'Operator', allows: ['order.read'], denies: ['member.read'] },
      rawBody: '',
      deadline: Date.now() + 1000,
      signal: new AbortController().signal,
      expectedVersion: 3,
      idempotency: 'role-change',
    },
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:admin', session: 'session:admin', membership: 'membership:admin', credentialVersion: 1, accessVersion: 4, target: 'console', assurance: { level: 3, verified: new Date() } },
        membership: { id: 'membership:admin', active: true, accessVersion: 4, permissions: { allows: new Set(['access.role.manage', 'order.read', 'member.read']), denies: new Set() }, scopes: [] },
        organization: 'tenant:one',
        scope: { id: 'tenant:one', kind: 'tenant', path: [] },
        accessVersion: 4,
        capabilities: new Set(['access.roles.manage']),
        capabilityVersion: 1,
        assurance: { level: 3, verified: new Date() },
        trace: 'trace:role',
      },
    },
  };
}
