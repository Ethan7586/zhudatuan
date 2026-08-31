import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { resetMemberRegistration } from './MemberRegistrationResetCommand';
import type { Member } from './MemberSchema';

const requests: Request[] = [];
const bodies: unknown[] = [];
const server = setupServer(
  http.post('*/api/v1/identity/password/verify', async ({ request }) => {
    requests.push(request);
    bodies.push(await request.clone().json());
    return HttpResponse.json({ verified: true, verifiedAt: '2026-08-29T00:00:00.000Z' });
  }),
  http.put('*/api/v1/identity/members/:membershipid/registration', async ({ request }) => {
    requests.push(request);
    bodies.push(await request.clone().json());
    return HttpResponse.json(receipt());
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  requests.length = 0;
  bodies.length = 0;
});
afterAll(() => server.close());

describe('member registration reset command', () => {
  it('verifies the Owner password before sending a scoped and versioned reset without the password', async () => {
    const value = await resetMemberRegistration(context, target, draft);

    expect(value).toEqual(receipt());
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      '/api/v1/identity/password/verify',
      '/api/v1/identity/members/membership%3Aemployee/registration',
    ]);
    expect(bodies).toEqual([{ password: 'Owner!Password1' }, { reason: '测试账号重新注册' }]);
    expect(requests[1]?.headers.get('x-scope-hint')).toBe('tenant:one');
    expect(requests[1]?.headers.get('x-access-version')).toBe('7');
    expect(requests[1]?.headers.get('x-csrf-token')).toBe('csrf-token-for-reset');
    expect(requests[1]?.headers.get('if-match')).toBe('"11"');
    expect(requests[0]?.headers.get('idempotency-key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(requests[1]?.headers.get('idempotency-key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('stops before reset when password verification does not return authoritative evidence', async () => {
    server.use(http.post('*/api/v1/identity/password/verify', () => HttpResponse.json({ verified: false })));

    await expect(resetMemberRegistration(context, target, draft)).rejects.toThrow();
    expect(requests).toHaveLength(0);
    expect(bodies).toHaveLength(0);
  });

  it('fails before transport when session evidence or target eligibility is missing', async () => {
    await expect(resetMemberRegistration(
      { ...context, session: { ...context.session, csrf: undefined } },
      target,
      draft,
    )).rejects.toThrow('MEMBER_RESET_CSRF_MISSING');
    await expect(resetMemberRegistration(context, { ...target, reset_allowed: false }, draft)).rejects.toThrow('MEMBER_RESET_TARGET_PROTECTED');
    expect(requests).toHaveLength(0);
  });

  it('rejects a malformed reset receipt', async () => {
    server.use(http.put('*/api/v1/identity/members/:membershipid/registration', () => HttpResponse.json({ status: 'reset' })));

    await expect(resetMemberRegistration(context, target, draft)).rejects.toThrow();
  });
});

const tenantScope = { kind: 'tenant', id: 'tenant:one', tenant: 'tenant:one' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'principal:owner',
    membership: 'membership:owner',
    accessVersion: 7,
    permissions: ['identity.assurance.manage', 'identity.registration.reset'],
    capabilities: ['identity.password.verify', 'identity.members.reset'],
    assurance: { level: 2 },
    csrf: 'csrf-token-for-reset',
    target: 'console',
    scope: tenantScope,
    scopes: [tenantScope],
    syncedAt: '2026-08-29T00:00:00.000Z',
  },
  profile: { display_name: 'Ethan', employee_no: null },
  scope: tenantScope,
  scopes: [tenantScope],
};

const target: Member = {
  id: 'member:employee',
  principal_id: 'principal:employee',
  principal_version: 11,
  display_name: '测试员工',
  status: 'active',
  membership_id: 'membership:employee',
  employee_no: null,
  membership_status: 'active',
  access_version: 3,
  joined_at: '2026-08-29T00:00:00.000Z',
  client: 'operator',
  login_identity_bound: true,
  reset_allowed: true,
  reset_block_reason: null,
};

const draft = {
  reason: '测试账号重新注册',
  understood: true,
  confirmation: '重置',
  ownerPassword: 'Owner!Password1',
} as const;

function receipt() {
  return {
    principal_id: 'principal:employee',
    status: 'reset',
    login_identity_released: true,
    history_retained: true,
    version: 12,
  } as const;
}
