import { describe, expect, it } from 'vitest';
import { checkAssurance, checkScope, decide, precheck, SCOPE_KINDS, type MembershipAccess, type Scope } from './index';

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
const scope: Scope = {
  kind: 'mall',
  id: 'mall-a',
  tenant: 'tenant-a',
  path: [
    { kind: 'tenant', id: 'tenant-a' },
    { kind: 'enterprise', id: 'enterprise-a' },
  ],
};
<<<<<<< HEAD
=======
const scope: Scope = { kind: 'mall', id: 'mall-a', tenant: 'tenant-a', path: [{ kind: 'tenant', id: 'tenant-a' }, { kind: 'enterprise', id: 'enterprise-a' }] };
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
const membership: MembershipAccess = { id: 'membership-a', active: true, accessVersion: 3, denies: [], grants: [{ scope, permissions: ['order.read'], effective: '2026-01-01T00:00:00.000Z', expires: null }] };

describe('authorization policy', () => {
  it('denies by default and lets an explicit deny override a grant', () => {
    expect(decide(membership, 'order.read', scope, { expectedAccessVersion: 3, now: new Date('2026-08-21T00:00:00.000Z') }).allowed).toBe(true);
    expect(decide({ ...membership, denies: ['order.read'] }, 'order.read', scope, { expectedAccessVersion: 3, now: new Date('2026-08-21T00:00:00.000Z') })).toMatchObject({ allowed: false, reason: 'EXPLICIT_DENY' });
    expect(decide(membership, 'finance.overview.read', scope, { expectedAccessVersion: 3, now: new Date('2026-08-21T00:00:00.000Z') })).toMatchObject({ allowed: false, reason: 'PERMISSION_MISSING' });
  });

  it('supports every canonical scope and rejects a permission at a disallowed scope kind', () => {
    expect(SCOPE_KINDS).toEqual(['platform', 'distributor', 'tenant', 'enterprise', 'mall', 'department', 'supplier', 'brand', 'store', 'owner', 'self']);
    const owner: Scope = { kind: 'owner', id: 'member-a', tenant: 'tenant-a', path: [] };
    const ownerAccess: MembershipAccess = { ...membership, grants: [{ scope: owner, permissions: ['cart.read', 'voucher.binding.read', 'access.center.read'], effective: '2026-01-01T00:00:00.000Z', expires: null }] };
    expect(decide(ownerAccess, 'cart.read', owner, { expectedAccessVersion: 3, now: new Date('2026-08-21T00:00:00.000Z') }).allowed).toBe(true);
    expect(decide(ownerAccess, 'voucher.binding.read', owner, { expectedAccessVersion: 3, now: new Date('2026-08-21T00:00:00.000Z') }).allowed).toBe(true);
    expect(decide(ownerAccess, 'access.center.read', owner, { expectedAccessVersion: 3, now: new Date('2026-08-21T00:00:00.000Z') })).toMatchObject({ allowed: false, reason: 'SCOPE_KIND_DENIED' });
  });

  it('exposes ordered stages without duplicating policy truth', () => {
    const now = new Date('2026-08-21T00:00:00.000Z');
    expect(precheck(membership, 'order.read', { expectedAccessVersion: 2, now })).toBe('ACCESS_VERSION_STALE');
    expect(precheck({ ...membership, denies: ['order.read'] }, 'order.read', { expectedAccessVersion: 3, now })).toBe('EXPLICIT_DENY');
    expect(checkScope(membership, 'order.read', { ...scope, id: 'mall-b' }, now)).toEqual({ reason: 'SCOPE_DENIED' });
    expect(checkAssurance('order.export', { now })).toBe('STEPUP_REQUIRED');
    expect(checkAssurance('order.export', { now, stepupAt: new Date('2026-08-20T23:59:00.000Z') })).toBeNull();
  });

  it('enforces tenant boundaries and delegation expiry for every hierarchical anchor', () => {
    const now = new Date('2026-08-21T00:00:00.000Z');
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    const resource: Scope = {
      kind: 'mall',
      id: 'mall-a',
      tenant: 'tenant-a',
      path: [
        { kind: 'platform', id: 'platform-a' },
        { kind: 'distributor', id: 'distributor-a' },
        { kind: 'tenant', id: 'tenant-a' },
        { kind: 'enterprise', id: 'enterprise-a' },
      ],
    };
    for (const grantScope of [resource, ...resource.path.map((item) => ({ ...item, tenant: item.kind === 'platform' ? undefined : 'tenant-a', path: [] }) as Scope)]) {
<<<<<<< HEAD
=======
    const resource: Scope = { kind: 'mall', id: 'mall-a', tenant: 'tenant-a', path: [
      { kind: 'platform', id: 'platform-a' }, { kind: 'distributor', id: 'distributor-a' },
      { kind: 'tenant', id: 'tenant-a' }, { kind: 'enterprise', id: 'enterprise-a' },
    ] };
    for (const grantScope of [resource, ...resource.path.map((item) => ({ ...item, tenant: item.kind === 'platform' ? undefined : 'tenant-a', path: [] } as Scope))]) {
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
      const access: MembershipAccess = { ...membership, grants: [{ scope: grantScope, permissions: ['order.read'], effective: '2026-01-01T00:00:00.000Z', expires: null }] };
      expect(decide(access, 'order.read', resource, { expectedAccessVersion: 3, now }).allowed).toBe(true);
    }
    const crossTenant: MembershipAccess = { ...membership, grants: [{ scope: { kind: 'enterprise', id: 'enterprise-a', tenant: 'tenant-b', path: [] }, permissions: ['order.read'], effective: '2026-01-01T00:00:00.000Z', expires: null }] };
    expect(decide(crossTenant, 'order.read', resource, { expectedAccessVersion: 3, now })).toMatchObject({ allowed: false, reason: 'SCOPE_DENIED' });
    const expired: MembershipAccess = { ...membership, grants: [{ scope, permissions: ['order.read'], effective: '2026-01-01T00:00:00.000Z', expires: '2026-08-20T23:59:59.000Z' }] };
    expect(decide(expired, 'order.read', scope, { expectedAccessVersion: 3, now })).toMatchObject({ allowed: false, reason: 'PERMISSION_MISSING' });
  });
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)

  it('keeps distributor grants effective above the tenant boundary without leaking across distributors', () => {
    const now = new Date('2026-08-21T00:00:00.000Z');
    const distributor: MembershipAccess = { ...membership, grants: [{ scope: { kind: 'distributor', id: 'distributor-d', path: [] }, permissions: ['order.read'], effective: '2026-01-01T00:00:00.000Z', expires: null }] };
    const under = (owner: string, tenant: string): Scope => ({
      kind: 'mall',
      id: 'mall-a',
      tenant,
      path: [
        { kind: 'platform', id: 'organization-platform-root' },
        { kind: 'distributor', id: owner },
        { kind: 'tenant', id: tenant },
      ],
    });

    expect(decide(distributor, 'order.read', under('distributor-d', 'tenant-a'), { expectedAccessVersion: 3, now }).allowed).toBe(true);
    expect(decide(distributor, 'order.read', under('distributor-other', 'tenant-b'), { expectedAccessVersion: 3, now })).toMatchObject({ allowed: false, reason: 'SCOPE_DENIED' });
  });

  it('denies a cross-kind identifier collision inside the same tenant', () => {
    const now = new Date('2026-08-21T00:00:00.000Z');
    const collision: MembershipAccess = { ...membership, grants: [{ scope: { kind: 'mall', id: 'x', tenant: 'tenant-a', path: [] }, permissions: ['order.read'], effective: '2026-01-01T00:00:00.000Z', expires: null }] };
    expect(decide(collision, 'order.read', { kind: 'department', id: 'x', tenant: 'tenant-a', path: [] }, { expectedAccessVersion: 3, now })).toMatchObject({ allowed: false, reason: 'SCOPE_DENIED' });
  });
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
});
