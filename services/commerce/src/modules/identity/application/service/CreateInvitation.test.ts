import { describe, expect, it, vi } from 'vitest';
import { CreateInvitation } from './CreateInvitation';

describe('CreateInvitation', () => {
  it('canonicalizes a national mobile recipient before hashing it', async () => {
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
    const action = new CreateInvitation(
      { create } as never,
      {
        plan: vi.fn(async () => ({
          organization: 'mall-zhudatuan',
          membership: null,
          principal: null,
          issuerAccessVersion: 7,
          grantDigest: 'grant',
          minimumAssurance: 1,
        })),
      } as never,
      { issue: () => ({ display: () => 'REDACTED' }) } as never,
      { recipient, current: () => ({ version: 'v1', hash: Buffer.alloc(32, 2) }) } as never,
      { current: vi.fn(async () => ({ id: 'registration:one', terms_hash: 'a'.repeat(64) })) } as never,
      { publish: vi.fn(async () => undefined) } as never,
      { metrics: { count: vi.fn() } } as never
    ).action();

    await action(
      {
        type: 'identity.invitations.create',
        security: { kind: 'session', access: { membership: { id: 'membership:issuer' }, trace: 'trace:one' } },
        input: {
          path: {},
          query: {},
          headers: {},
          body: {
            kind: 'campaign',
            target: 'storefront',
            organizationId: 'mall-zhudatuan',
            recipient: '139 0000 1301',
            maxUses: 1,
            expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
            reason: 'employee registration',
          },
          rawBody: '',
          deadline: Date.now() + 1_000,
          signal: new AbortController().signal,
          idempotency: 'invite:one',
          expectedVersion: 7,
        },
      } as never,
      { mode: 'write' } as never
    );

    expect(recipient).toHaveBeenCalledWith('+8613900001301');
    expect(create).toHaveBeenCalledOnce();
  });
});
