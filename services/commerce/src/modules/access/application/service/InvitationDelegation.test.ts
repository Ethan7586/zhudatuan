import { describe, expect, it, vi } from 'vitest';
import { GrantPlan } from '../../domain/model/GrantPlan';
import { InvitationDelegation, delegatedPermissions } from './InvitationDelegation';

describe('delegatedPermissions', () => {
  it('validates a prepared employee membership with enrollment semantics', async () => {
    const plan = new GrantPlan('storefront', 'mall:one', 'membership:employee', 'principal:employee', [{ id: 'role:self', version: 1, kind: 'system', expiresAt: null }], [], [], 1, 'registration:one', 't'.repeat(64));
    const execute = vi.fn(async () => ({
      plan,
      issuerVersion: 7,
      issuerAllows: ['access.role.delegate', 'access.scope.delegate'],
      issuerDenies: [],
      scopeAllowed: true,
    }));
    const assert = vi.fn();
    const service = new InvitationDelegation({} as never, { assert, assertCampaign: vi.fn() } as never, {} as never, { execute } as never, {} as never);

    await service.validate({} as never, {
      kind: 'enrollment',
      issuer: 'membership:issuer',
      issuerAccessVersion: 7,
      membership: 'membership:employee',
      grantDigest: plan.digest(),
      organization: 'mall:one',
      target: 'storefront',
      policy: 'registration:one',
      termsHash: 't'.repeat(64),
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });

    expect(execute).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        kind: 'enrollment',
        membership: 'membership:employee',
        organization: 'mall:one',
        policy: 'registration:one',
        termsHash: 't'.repeat(64),
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      })
    );
    expect(assert).toHaveBeenCalledOnce();
  });

  it('checks custom role grants without treating fixed system role permissions as delegated grants', () => {
    const plan = new GrantPlan(
      'storefront',
      'mall:one',
      'membership:one',
      'principal:one',
      [
        { id: 'role:self', version: 1, kind: 'system', expiresAt: null },
        { id: 'role:employee', version: 2, kind: 'custom', expiresAt: null },
      ],
      [
        { code: 'identity.session.manage', effect: 'allow', role: 'role:self', roleVersion: 1 },
        { code: 'order.read', effect: 'allow', role: 'role:employee', roleVersion: 2 },
      ],
      [],
      1,
      null,
      null
    );

    expect(delegatedPermissions(plan)).toEqual(['order.read']);
  });

  it('applies an explicit custom role deny before delegation checks', () => {
    const plan = new GrantPlan(
      'console',
      'mall:one',
      'membership:one',
      'principal:one',
      [
        { id: 'role:employee', version: 2, kind: 'custom', expiresAt: null },
        { id: 'role:auditor', version: 3, kind: 'custom', expiresAt: null },
      ],
      [
        { code: 'order.read', effect: 'allow', role: 'role:employee', roleVersion: 2 },
        { code: 'order.read', effect: 'deny', role: 'role:auditor', roleVersion: 3 },
      ],
      [],
      2,
      null,
      null
    );

    expect(delegatedPermissions(plan)).toEqual([]);
  });
});
