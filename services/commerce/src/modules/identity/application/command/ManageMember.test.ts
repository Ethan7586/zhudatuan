import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationExecution';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { IdentityAccessPort } from '../../../access/public';
import type { IdentityMemberPort } from '../../../member/public';
import { ManageMember } from './ManageMember';

describe('ManageMember', () => {
  it('updates the member only when the locked access version matches', async () => {
    const updateDisplay = vi.fn(async () => ({ id: 'member:one', display_name: '新名称', version: 4 }));
    const memberForManagement = vi.fn(async () => ({ member: 'member:one', accessVersion: 7 }));
    const action = new ManageMember({ memberForManagement } as unknown as IdentityAccessPort, { updateDisplay } as unknown as IdentityMemberPort).action();

    await expect(action(request(7), {} as OperationDatabase)).resolves.toEqual({ status: 200, body: { action: 'update', memberId: 'member:one', displayName: '新名称', version: 4 } });
    expect(updateDisplay).toHaveBeenCalledWith(expect.anything(), 'member:one', '新名称');
  });

  it('fails closed on a stale target version before changing member data', async () => {
    const updateDisplay = vi.fn();
    const action = new ManageMember({ memberForManagement: vi.fn(async () => ({ member: 'member:one', accessVersion: 8 })) } as unknown as IdentityAccessPort, { updateDisplay } as unknown as IdentityMemberPort).action();

    await expect(action(request(7), {} as OperationDatabase)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(updateDisplay).not.toHaveBeenCalled();
  });
});

function request(expectedVersion: number): OperationRequest {
  return {
    type: 'identity.members.manage',
    input: {
      path: { membershipid: 'membership:target' },
      query: {},
      headers: {},
      rawBody: '',
      body: { action: 'update', displayName: '新名称', reason: '成员资料校正' },
      deadline: Date.now() + 1000,
      signal: new AbortController().signal,
      expectedVersion,
      idempotency: 'member-change',
    },
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:admin', session: 'session:admin', membership: 'membership:admin', credentialVersion: 1, accessVersion: 3, target: 'console', assurance: { level: 3, verified: new Date() } },
        membership: { id: 'membership:admin', active: true, accessVersion: 3, permissions: { allows: new Set(['member.manage']), denies: new Set() }, scopes: [] },
        organization: 'mall:one',
        scope: { id: 'mall:one', kind: 'mall', path: [] },
        accessVersion: 3,
        capabilities: new Set(['identity.members.manage']),
        capabilityVersion: 1,
        assurance: { level: 3, verified: new Date() },
        trace: 'trace:member',
      },
    },
  };
}
