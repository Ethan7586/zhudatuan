import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../foundation/application/OperationRequest';
import type { IdentityAccessPort } from '../../access/public';
import type { IdentityMemberPort } from '../../member/public';
import { ManageMember } from '../application/service/ManageMember';
import { result, withWriteTransaction } from '../../../test/TransactionFixture';

describe('ManageMember', () => {
  it('updates the member only when the locked access version matches', async () => {
    const updateDisplay = vi.fn(async () => ({ id: 'member:one', display_name: '新名称', version: 4 }));
    const memberForManagement = vi.fn(async () => ({ member: 'member:one', accessVersion: 7 }));
    const action = new ManageMember(
      { memberForManagement } as unknown as IdentityAccessPort,
      { updateDisplay } as unknown as IdentityMemberPort,
      {} as never,
      {} as never
    ).action();

    await expect(
      withWriteTransaction(
        async () => result([]),
        (context) => action(request(7), context)
      )
    ).resolves.toEqual({ status: 200, body: { action: 'update', memberId: 'member:one', displayName: '新名称', version: 4 } });
    expect(updateDisplay).toHaveBeenCalledWith(expect.anything(), 'member:one', '新名称');
  });

  it('fails closed on a stale target version before changing member data', async () => {
    const updateDisplay = vi.fn();
    const action = new ManageMember(
      { memberForManagement: vi.fn(async () => ({ member: 'member:one', accessVersion: 8 })) } as unknown as IdentityAccessPort,
      { updateDisplay } as unknown as IdentityMemberPort,
      {} as never,
      {} as never
    ).action();

    await expect(
      withWriteTransaction(
        async () => result([]),
        (context) => action(request(7), context)
      )
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(updateDisplay).not.toHaveBeenCalled();
  });

  it('resets registration atomically through owning ports while retaining business history', async () => {
    const access = {
      memberForManagement: vi.fn(async () => ({ member: 'member:one', accessVersion: 7 })),
      resetRegistrations: vi.fn(async () => ({ memberships: ['membership:target', 'membership:storefront'], accessVersion: 9 })),
    } as unknown as IdentityAccessPort;
    const members = {
      registrationPrincipal: vi.fn(async () => 'principal:target'),
      releaseRegistration: vi.fn(async () => ({ version: 6 })),
    } as unknown as IdentityMemberPort;
    const registrations = {
      lock: vi.fn(async () => undefined),
      target: vi.fn(async () => ({ principal: 'principal:target', version: 4, passwordVerified: true })),
      reset: vi.fn(async () => ({ principal: 'principal:target', credentialVersion: 5, version: 5 })),
    };
    const events = { publish: vi.fn(async () => undefined) };
    const action = new ManageMember(access, members, registrations, events as never).action();

    const response = await withWriteTransaction(
      async () => result([]),
      (context) => action(request(7, { action: 'registrationReset', reason: '重新邀请该成员注册' }, ['member.manage', 'identity.registration.reset']), context)
    );

    expect(response).toMatchObject({
      status: 200,
      body: {
        action: 'registrationReset', memberId: 'member:one', principalId: 'principal:target', status: 'reset',
        loginIdentityReleased: true, historyRetained: true, memberships: ['membership:target', 'membership:storefront'],
        accessVersion: 9, profileVersion: 6, principalVersion: 5,
      },
    });
    expect(registrations.lock).toHaveBeenCalledBefore(access.memberForManagement as never);
    expect(events.publish).toHaveBeenCalledWith(expect.anything(), 'identity.member.reset', 'principal', 'principal:target', 'mall:one', 'trace:member', {
      memberId: 'member:one', credentialVersion: 5, reason: '重新邀请该成员注册',
    });
  });

  it('uses explicit enable, disable and offboard actions instead of a generic status command', async () => {
    const changeStatus = vi.fn(async (_context: unknown, _membership: string, _status: 'active' | 'suspended' | 'left') => ({ accessVersion: 8 }));
    const action = new ManageMember(
      { memberForManagement: vi.fn(async () => ({ member: 'member:one', accessVersion: 7 })), changeStatus } as unknown as IdentityAccessPort,
      {} as IdentityMemberPort,
      {} as never,
      {} as never
    ).action();
    for (const [command, status] of [['enable', 'active'], ['disable', 'suspended'], ['offboard', 'left']] as const) {
      await expect(withWriteTransaction(async () => result([]), (context) => action(request(7, { action: command, reason: '成员状态调整完成' }), context)))
        .resolves.toMatchObject({ body: { action: command, status } });
    }
    expect(changeStatus.mock.calls.map((call) => call[2])).toEqual(['active', 'suspended', 'left']);
  });
});

function request(expectedVersion: number, body: Readonly<Record<string, unknown>> = { action: 'update', displayName: '新名称', reason: '成员资料校正' }, permissions: readonly string[] = ['member.manage']): OperationRequest {
  return {
    type: 'identity.members.manage',
    input: {
      path: { membershipid: 'membership:target' },
      query: {},
      headers: {},
      rawBody: '',
      body,
      deadline: Date.now() + 1000,
      signal: new AbortController().signal,
      expectedVersion,
      idempotency: 'member-change',
    },
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:admin', session: 'session:admin', membership: 'membership:admin', credentialVersion: 1, accessVersion: 3, target: 'console', assurance: { level: 3, verified: new Date() } },
        membership: { id: 'membership:admin', active: true, accessVersion: 3, permissions: { allows: new Set(permissions), denies: new Set() }, scopes: [] },
        roles: [],
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
