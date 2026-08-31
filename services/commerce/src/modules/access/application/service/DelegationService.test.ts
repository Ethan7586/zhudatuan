import { describe, expect, it } from 'vitest';
import { GrantPlan } from '../../domain/model/GrantPlan';
import { delegatedPermissions } from './DelegationService';

describe('delegatedPermissions', () => {
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
