import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { createOrdinaryAdminInvitation } from './MemberInvitationCommand';

let capturedRequest: Readonly<{
  body: unknown;
  scope: string | null;
  accessVersion: string | null;
  csrf: string | null;
  idempotency: string | null;
}> | undefined;

const server = setupServer(
  http.post('*/api/v1/identity/invitations', async ({ request }) => {
    capturedRequest = {
      body: await request.json(),
      scope: request.headers.get('x-scope-hint'),
      accessVersion: request.headers.get('x-access-version'),
      csrf: request.headers.get('x-csrf-token'),
      idempotency: request.headers.get('idempotency-key'),
    };
    return HttpResponse.json({
      id: 'invite:1', label: '首轮平台主管邀请', code: 'invite-code-once', target_client: 'operator', max_uses: 1,
      use_count: 0, starts_at: '2026-08-29T00:00:00.000Z', expires_at: '2026-09-05T00:00:00.000Z',
      status: 'active', created_at: '2026-08-29T00:00:00.000Z', version: 0,
    }, { status: 201 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  capturedRequest = undefined;
});
afterAll(() => server.close());

describe('ordinary administrator invitation command', () => {
  it('uses the canonical SDK command context and fixes the invitation authority boundary', async () => {
    const receipt = await createOrdinaryAdminInvitation(
      context,
      { label: ' 首轮平台主管邀请 ', destination: ' 13800138000 ' },
      undefined,
      new Date('2026-08-29T00:00:00.000Z'),
    );

    expect(receipt.code).toBe('invite-code-once');
    expect(capturedRequest).toMatchObject({
      body: {
        label: '首轮平台主管邀请',
        destination: '13800138000',
        targetClient: 'operator',
        maxUses: 1,
        expiresAt: '2026-09-05T00:00:00.000Z',
      },
      scope: 'tenant:zhudatuan',
      accessVersion: '7',
      csrf: 'csrf-token-owner-session',
    });
    expect(capturedRequest?.idempotency).toBeTruthy();
  });
});

const context: ConsoleContext = {
  session: {
    actor: 'principal:owner', membership: 'membership:owner', accessVersion: 7,
    permissions: ['identity.invitation.manage'], capabilities: ['identity.invitations.create'], target: 'console',
    scope: { kind: 'platform', id: 'organization-platform-root', tenant: 'tenant:zhudatuan' },
    scopes: [
      { kind: 'platform', id: 'organization-platform-root', tenant: 'tenant:zhudatuan' },
      { kind: 'tenant', id: 'tenant:zhudatuan', tenant: 'tenant:zhudatuan' },
    ],
    assurance: { level: 2 }, csrf: 'csrf-token-owner-session', syncedAt: '2026-08-29T00:00:00.000Z',
  },
  profile: { display_name: 'Root Owner', employee_no: null },
  scope: { kind: 'platform', id: 'organization-platform-root', tenant: 'tenant:zhudatuan' },
  scopes: [
    { kind: 'platform', id: 'organization-platform-root', tenant: 'tenant:zhudatuan' },
    { kind: 'tenant', id: 'tenant:zhudatuan', tenant: 'tenant:zhudatuan' },
  ],
};
