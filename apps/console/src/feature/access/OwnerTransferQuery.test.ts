// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import {
  bindCanonicalMobile,
  completeStepUpAndReadSession,
  createTransfer,
  previewTransfer,
  readOwnership,
  requestCanonicalMobileChallenge,
  requestStepUp,
  verifyPasswordForMobileEnrollment,
} from './OwnerTransferQuery';

const originalContext: ConsoleContext = {
  session: {
    actor: 'principal:owner', membership: 'membership:owner', accessVersion: 11,
    permissions: ['access.ownership.transfer'],
    capabilities: ['identity.stepup.start', 'identity.stepup.complete', 'access.ownership.transfers.preview',
      'access.ownership.transfers.create'],
    target: 'console', scope: { kind: 'platform', id: 'tenant-zhudatuan' },
    scopes: [{ kind: 'platform', id: 'tenant-zhudatuan' }], assurance: { level: 1 },
    csrf: 'csrf-token-from-session', syncedAt: '2026-08-29T00:00:00.000Z',
  },
  profile: { display_name: '当前 Owner', employee_no: null },
  scope: { kind: 'platform', id: 'tenant-zhudatuan' },
  scopes: [{ kind: 'platform', id: 'tenant-zhudatuan' }],
};

let calls: string[] = [];
const server = setupServer(
  http.post('*/api/v1/identity/stepup/challenges', async ({ request }) => {
    calls.push('stepup.start');
    expect(await request.json()).toEqual({});
    expect(request.headers.get('x-csrf-token')).toBe('csrf-token-from-session');
    expect(request.headers.get('idempotency-key')).toBeTruthy();
    return HttpResponse.json({ id: 'challenge:owner', purpose: 'stepup', expires_at: '2026-08-29T10:05:00.000Z' }, { status: 202 });
  }),
  http.post('*/api/v1/identity/stepup/verifications', async ({ request }) => {
    calls.push('stepup.complete');
    expect(await request.json()).toEqual({ challenge: 'challenge:owner', code: '123456' });
    return HttpResponse.json({ id: 'session:owner', assurance_level: 3 });
  }),
  http.get('*/api/v1/identity/session', () => {
    calls.push('session.reread');
    return HttpResponse.json({ ...originalContext.session, accessVersion: 12, assurance: { level: 3, verified: '2026-08-29T10:01:00.000Z' } });
  }),
  http.post('*/api/v1/access/ownership/transfers/preview', async ({ request }) => {
    calls.push('transfer.preview');
    expect(request.headers.get('if-match')).toBe('"4"');
    expect(request.headers.get('x-access-version')).toBe('12');
    expect(request.headers.get('x-action-proof')).toBeNull();
    expect(request.headers.get('x-csrf-token')).toBe('csrf-token-from-session');
    expect(await request.json()).toEqual({
      targetMembership: 'membership:successor', formerOwnerMode: 'retain_admin', formerOwnerRole: 'role-platform-admin-v2',
    });
    return HttpResponse.json({
      proof: 'signed-owner-action-proof', proofExpiresAt: '2026-08-29T10:06:00.000Z', ownershipVersion: 4,
      targetAccessVersion: 7, sourceMembership: 'membership:owner', targetMembership: 'membership:successor',
      formerOwnerMode: 'retain_admin', formerOwnerRole: 'role-platform-admin-v2', formerOwnerRoleVersion: 3,
    });
  }),
  http.post('*/api/v1/access/ownership/transfers', async ({ request }) => {
    calls.push('transfer.create');
    expect(request.headers.get('if-match')).toBe('"4"');
    expect(request.headers.get('x-access-version')).toBe('12');
    expect(request.headers.get('x-action-proof')).toBe('signed-owner-action-proof');
    expect(request.headers.get('idempotency-key')).toBeTruthy();
    return HttpResponse.json({
      id: 'owner-transfer:1', state: 'pending_acceptance', sourceMembership: 'membership:owner',
      targetMembership: 'membership:successor', targetMember: 'member:successor', targetPrincipal: 'principal:successor',
      targetDisplayName: '接任管理员', formerOwnerMode: 'retain_admin', formerOwnerRole: 'role-platform-admin-v2',
      coolingUntil: '2026-08-30T10:01:00.000Z', expiresAt: '2026-09-05T10:01:00.000Z', version: 1,
    }, { status: 201 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { calls = []; server.resetHandlers(); });
afterAll(() => server.close());

describe('Owner transfer command chain', () => {
  it('keeps the SMS destination server-side and carries refreshed session, If-Match, CSRF, idempotency and action proof', async () => {
    const challenge = await requestStepUp(originalContext.session);
    const elevated = await completeStepUpAndReadSession(originalContext.session, challenge.id, '123456');
    const configuration = { targetMembership: 'membership:successor', formerOwnerMode: 'retain_admin' as const,
      formerOwnerRole: 'role-platform-admin-v2' };
    const preview = await previewTransfer(originalContext, elevated, configuration, 4);
    const transfer = await createTransfer(originalContext, elevated, configuration, preview.ownershipVersion, preview.proof);

    expect(preview.formerOwnerRoleVersion).toBe(3);
    expect(transfer.state).toBe('pending_acceptance');
    expect(calls).toEqual(['stepup.start', 'stepup.complete', 'session.reread', 'transfer.preview', 'transfer.create']);
  });

  it('binds a first Canonical mobile only after password verification and phone-change OTP', async () => {
    server.use(
      http.post('*/api/v1/identity/password/verify', async ({ request }) => {
        calls.push('password.verify');
        expect(request.headers.get('x-csrf-token')).toBe('csrf-token-from-session');
        expect(await request.json()).toEqual({ password: 'owner-password' });
        return HttpResponse.json({ verified: true, verifiedAt: '2026-08-29T10:00:00.000Z' });
      }),
      http.post('*/api/v1/identity/mobile/challenges', async ({ request }) => {
        calls.push('phone.challenge');
        expect(await request.json()).toEqual({ destination: '+8613800138000' });
        return HttpResponse.json({ id: 'challenge:mobile', purpose: 'phone_change', expires_at: '2026-08-29T10:10:00.000Z' }, { status: 202 });
      }),
      http.put('*/api/v1/identity/mobile', async ({ request }) => {
        calls.push('mobile.manage');
        expect(request.headers.get('x-access-version')).toBe('11');
        expect(request.headers.get('x-csrf-token')).toBe('csrf-token-from-session');
        expect(await request.json()).toEqual({ mobile: '+8613800138000', challenge: 'challenge:mobile', code: '654321' });
        return HttpResponse.json({ id: 'member:owner', mobile_masked: '+86****7586', version: 2 });
      }),
    );

    await verifyPasswordForMobileEnrollment(originalContext.session, 'owner-password');
    const challenge = await requestCanonicalMobileChallenge(originalContext.session, '13800138000');
    await bindCanonicalMobile(originalContext.session, '13800138000', challenge.id, '654321');

    expect(calls).toEqual(['password.verify', 'phone.challenge', 'mobile.manage']);
  });

  it('fails closed when ownership does not return mobile readiness', async () => {
    server.use(http.get('*/api/v1/access/ownership', () => HttpResponse.json({
      state: 'active', version: 4,
      owner: { membership: 'membership:owner', member: 'member:owner', principal: 'principal:owner', displayName: '当前 Owner' },
      candidates: [], formerOwnerRoles: [], pending: null,
    })));
    await expect(readOwnership(originalContext)).rejects.toThrow();
  });
});
