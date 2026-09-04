// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { MemberGateway } from './MemberGateway';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('MemberGateway', () => {
  it('keeps status and organization scope from the server DTO', async () => {
    server.use(
      http.get('https://shop.test/api/v1/members', ({ request }) => {
        expect(request.headers.get('x-scope-hint')).toBe('mall:route');
        return HttpResponse.json({ items: [memberDto], count: 1 });
      })
    );
    const page = await new MemberGateway('https://shop.test').read(context);
    expect(page.items[0]).toMatchObject({ displayName: '李小明', profileStatus: 'active', membershipStatus: 'suspended', organizationId: 'mall:server' });
    expect(Object.isFrozen(page.items)).toBe(true);
  });

  it('preserves write identity and target version for member changes', async () => {
    server.use(
      http.put('https://shop.test/api/v1/identity/members/membership%3Aone', async ({ request }) => {
        expect(request.headers.get('idempotency-key')).toBe('identity:stable');
        expect(request.headers.get('if-match')).toBe('"8"');
        expect(request.headers.get('x-csrf-token')).toBe('csrf-token');
        expect(await request.json()).toEqual({ action: 'enable', reason: '复岗审批完成' });
        return HttpResponse.json({ action: 'enable', membershipId: 'membership:one', status: 'active', accessVersion: 9 });
      })
    );
    const gateway = new MemberGateway('https://shop.test');
    const result = await gateway.manage(context, { kind: 'status', member: mappedMember, status: 'active', reason: '复岗审批完成' }, 'identity:stable');
    expect(result).toEqual({ referenceId: 'membership:one', kind: 'status', version: 9 });
  });

  it('verifies the owner password before reset and never sends the password to the reset action', async () => {
    const paths: string[] = [];
    const bodies: unknown[] = [];
    server.use(
      http.post('https://shop.test/api/v1/identity/password/verify', async ({ request }) => {
        paths.push(new URL(request.url).pathname);
        bodies.push(await request.json());
        expect(request.headers.get('x-csrf-token')).toBe('csrf-token');
        return HttpResponse.json({ verified: true, verifiedAt: '2026-09-04T12:00:00.000Z' });
      }),
      http.put('https://shop.test/api/v1/identity/members/membership%3Aone', async ({ request }) => {
        paths.push(new URL(request.url).pathname);
        bodies.push(await request.json());
        expect(request.headers.get('idempotency-key')).toBe('reset:stable');
        expect(request.headers.get('if-match')).toBe('"8"');
        return HttpResponse.json({
          action: 'registrationReset', memberId: 'member:one', principalId: 'principal:one', status: 'reset',
          loginIdentityReleased: true, historyRetained: true, memberships: ['membership:one'], accessVersion: 9,
          profileVersion: 4, principalVersion: 6,
        });
      })
    );
    const result = await new MemberGateway('https://shop.test').resetRegistration(
      context,
      { member: mappedMember, reason: '重新邀请成员注册', understood: true, confirmation: '重置', ownerPassword: 'Owner!Password1' },
      'reset:stable'
    );
    expect(paths).toEqual(['/api/v1/identity/password/verify', '/api/v1/identity/members/membership%3Aone']);
    expect(bodies).toEqual([{ password: 'Owner!Password1' }, { action: 'registrationReset', reason: '重新邀请成员注册' }]);
    expect(result).toMatchObject({ status: 'reset', loginIdentityReleased: true, historyRetained: true, principalVersion: 6 });
  });
});

const memberDto = {
  id: 'member:one',
  display_name: '李小明',
  status: 'active',
  membership_id: 'membership:one',
  organization_id: 'mall:server',
  employee_no: 'E1002',
  membership_status: 'suspended',
  access_version: 8,
  joined_at: '2026-09-03T00:00:00.000Z',
  login_identity_bound: true,
  registration_reset_allowed: true,
  registration_reset_block_reason: null,
};
const mappedMember = {
  id: 'member:one',
  displayName: '李小明',
  profileStatus: 'active',
  membershipId: 'membership:one',
  organizationId: 'mall:server',
  employeeNo: 'E1002',
  membershipStatus: 'suspended',
  accessVersion: 8,
  joinedAt: '2026-09-03T00:00:00.000Z',
  loginIdentityBound: true,
  registrationResetAllowed: true,
  registrationResetBlockReason: null,
};
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:admin',
    accessVersion: 7,
    permissions: ['member.read', 'member.manage'],
    capabilities: ['member.members.read', 'identity.members.manage'],
    target: 'console',
    scope: { kind: 'mall', id: 'mall:route' },
    scopes: [{ kind: 'mall', id: 'mall:route' }],
    assurance: { level: 2 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    csrf: 'csrf-token',
    syncedAt: '2026-09-03T00:00:00Z',
  },
  profile: { display_name: '管理员', employee_no: 'A001' },
  scope: { kind: 'mall', id: 'mall:route' },
  scopes: [{ kind: 'mall', id: 'mall:route' }],
};
