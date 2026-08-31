import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { createMemberInvitation } from './MemberInvitationCommand';

const requests: Request[] = [];
const bodies: unknown[] = [];
const server = setupServer(
  http.post('*/api/v1/identity/invitations', async ({ request }) => {
    requests.push(request);
    bodies.push(await request.clone().json());
    return HttpResponse.json(receipt(), { status: 201 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  requests.length = 0;
  bodies.length = 0;
});
afterAll(() => server.close());

describe('member invitation command', () => {
  it('sends the scoped, versioned and CSRF-bound command through the generated SDK', async () => {
    const value = await createMemberInvitation(context, {
      label: '普通管理员邀请',
      destination: '13800138000',
      maxUses: 1,
      validityDays: 3,
    });

    expect(value).toMatchObject({ id: 'invite:one', target: 'console', version: 0 });
    expect(bodies[0]).toMatchObject({ label: '普通管理员邀请', destination: '13800138000', targetClient: 'operator', maxUses: 1 });
    expect(new Date(String((bodies[0] as Readonly<Record<string, unknown>>).expiresAt)).getTime()).toBeGreaterThan(Date.now());
    expect(requests[0]?.headers.get('x-scope-hint')).toBe('tenant:one');
    expect(requests[0]?.headers.get('x-access-version')).toBe('7');
    expect(requests[0]?.headers.get('x-csrf-token')).toBe('csrf-token-for-invitation');
    expect(requests[0]?.headers.get('idempotency-key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects a malformed success response instead of trusting the structural contract', async () => {
    server.use(http.post('*/api/v1/identity/invitations', () => HttpResponse.json({ id: 'invite:one', code: 'short' }, { status: 201 })));

    await expect(
      createMemberInvitation(context, {
        label: '普通管理员邀请',
        destination: '13800138000',
        maxUses: 1,
        validityDays: 7,
      })
    ).rejects.toThrow();
  });

  it('keeps the platform scope and sends the selected tenant to the backend', async () => {
    const platformScope = { kind: 'platform', id: 'platform:one' } as const;
    const platformContext = { ...context, scope: platformScope, scopes: [platformScope, ...context.scopes] };

    await createMemberInvitation(platformContext, {
      label: '平台管理员邀请',
      destination: '13800138000',
      maxUses: 1,
      validityDays: 7,
      tenantId: 'tenant:one',
    });

    expect(bodies[0]).toMatchObject({ tenantId: 'tenant:one' });
    expect(requests[0]?.headers.get('x-scope-hint')).toBe('platform:one');
  });

  it('fails before transport when the authenticated session has no CSRF token', async () => {
    const withoutCsrf = { ...context, session: { ...context.session, csrf: undefined } };

    await expect(
      createMemberInvitation(withoutCsrf, {
        label: '普通管理员邀请',
        destination: '13800138000',
        maxUses: 1,
        validityDays: 7,
      })
    ).rejects.toThrow('INVITATION_CSRF_MISSING');
    expect(requests).toHaveLength(0);
  });
});

const context: ConsoleContext = {
  session: {
    actor: 'actor:owner',
    membership: 'membership:owner',
    accessVersion: 7,
    permissions: ['identity.invitation.manage'],
    capabilities: ['identity.invitations.create'],
    assurance: { level: 2 },
    csrf: 'csrf-token-for-invitation',
    target: 'console',
    scope: { kind: 'tenant', id: 'tenant:one', tenant: 'tenant:one' },
    scopes: [{ kind: 'tenant', id: 'tenant:one', tenant: 'tenant:one' }],
    syncedAt: '2026-08-29T00:00:00.000Z',
  },
  profile: { display_name: 'Ethan', employee_no: null },
  scope: { kind: 'tenant', id: 'tenant:one', tenant: 'tenant:one' },
  scopes: [{ kind: 'tenant', id: 'tenant:one', tenant: 'tenant:one' }],
};

function receipt() {
  const now = new Date().toISOString();
  return {
    id: 'invite:one',
    code: 'A'.repeat(32),
    label: '普通管理员邀请',
    target: 'console',
    max_uses: 2,
    use_count: 0,
    starts_at: now,
    expires_at: new Date(Date.now() + 259_200_000).toISOString(),
    status: 'active',
    created_at: now,
    version: '0',
  };
}
