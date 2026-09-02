import { describe, expect, it, vi } from 'vitest';
import { InvitationCode } from '../../domain/model/InvitationCode';
import { CreateInvitation } from './CreateInvitation';
import { PrepareEmployeeInvitation } from './PrepareEmployeeInvitation';

describe('CreateInvitation', () => {
  it('prepares PII outside the transaction and creates every pending employee resource atomically', async () => {
    const create = vi.fn(async (_context, value) => ({
      id: value.id,
      kind: value.kind,
      target: value.target,
      organization_id: value.organization,
      membership_id: value.membership,
      minimum_assurance: value.assurance,
      max_uses: value.maxUses,
      use_count: 0,
      not_before: new Date().toISOString(),
      expires_at: value.expiresAt.toISOString(),
      status: 'active',
      reason: value.reason,
      created_at: new Date().toISOString(),
      version: 1,
    }));
    const recipient = vi.fn(() => Buffer.alloc(32, 1));
    const kms = { encrypt: vi.fn(async () => ({ ciphertext: 'encrypted-mobile-value', fingerprint: 'f'.repeat(64), keyVersion: 'current' })) };
    const generator = { issue: vi.fn(() => InvitationCode.issue(Buffer.alloc(24, 7))) };
    const hasher = { recipient, current: vi.fn(() => ({ version: 'current', hash: Buffer.alloc(32, 2) })) };
    const members = { assertMobileAvailable: vi.fn(), createPending: vi.fn() };
    const enrollments = { createPendingPrincipal: vi.fn() };
    const access = { prepareEmployee: vi.fn(async () => ({ grantDigest: 'g'.repeat(64) })) };
    const events = { publish: vi.fn() };
    const service = new CreateInvitation(
      { create } as never,
      access as never,
      members as never,
      enrollments as never,
      new PrepareEmployeeInvitation(kms as never, generator, hasher as never),
      kms as never,
      generator,
      hasher as never,
      { current: vi.fn(async () => ({ id: 'registration:one', terms_hash: 'a'.repeat(64) })) } as never,
      events as never,
      { metrics: { count: vi.fn() } } as never
    );
    const lifecycle = service.lifecycle();
    const operation = request();
    const loaded = await lifecycle.load!(operation, {} as never);
    const prepared = await lifecycle.prepare!(operation, loaded);

    expect(kms.encrypt).toHaveBeenCalledWith('pii', 'identity/mobile', '+8613900001301', expect.objectContaining({ principal: expect.stringMatching(/^principal:/) }));
    expect(recipient).toHaveBeenCalledWith('+8613900001301');
    const response = await lifecycle.execute(operation, { mode: 'write' } as never, prepared);

    expect(response).toMatchObject({ status: 201, body: { kind: 'enrollment', recipientMasked: '+86139****1301', employee: { displayName: '张三', employeeNo: 'EMP-1' } } });
    expect(enrollments.createPendingPrincipal).toHaveBeenCalledOnce();
    expect(members.createPending).toHaveBeenCalledOnce();
    expect(access.prepareEmployee).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ principal: null, membership: expect.stringMatching(/^membership:/) }));
    expect(events.publish).toHaveBeenCalledWith(expect.anything(), 'identity.invitation.issued', 'invitation', expect.any(String), 'mall-zhudatuan', 'trace:one', expect.any(Object));
  });
});

function request() {
  return {
    type: 'identity.invitations.create',
    security: {
      kind: 'session',
      access: {
        membership: { id: 'membership:issuer' },
        assurance: { level: 2 },
        trace: 'trace:one',
      },
    },
    input: {
      path: {},
      query: {},
      headers: {},
      body: {
        kind: 'enrollment',
        target: 'storefront',
        organizationId: 'mall-zhudatuan',
        employee: { displayName: ' 张三 ', mobile: '139 0000 1301', employeeNo: 'emp-1' },
        expiresAt: new Date(Date.now() + 72 * 60 * 60_000).toISOString(),
        reason: '邀请商城员工注册',
      },
      rawBody: '',
      deadline: Date.now() + 1_000,
      signal: new AbortController().signal,
      idempotency: 'invite:one',
      expectedVersion: 7,
    },
  } as never;
}
