import { describe, expect, it } from 'vitest';
import { checkAssurance, checkScope, decide, precheck, SCOPE_KINDS, type MembershipAccess, type Scope } from './index';

const scope: Scope = { kind: 'mall', id: 'mall-a', tenant: 'tenant-a', path: [{ kind: 'tenant', id: 'tenant-a' }, { kind: 'enterprise', id: 'enterprise-a' }] };
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
    const resource: Scope = { kind: 'mall', id: 'mall-a', tenant: 'tenant-a', path: [
      { kind: 'platform', id: 'platform-a' }, { kind: 'distributor', id: 'distributor-a' },
      { kind: 'tenant', id: 'tenant-a' }, { kind: 'enterprise', id: 'enterprise-a' },
    ] };
    for (const grantScope of [resource, ...resource.path.map((item) => ({ ...item, tenant: item.kind === 'platform' ? undefined : 'tenant-a', path: [] } as Scope))]) {
      const access: MembershipAccess = { ...membership, grants: [{ scope: grantScope, permissions: ['order.read'], effective: '2026-01-01T00:00:00.000Z', expires: null }] };
      expect(decide(access, 'order.read', resource, { expectedAccessVersion: 3, now }).allowed).toBe(true);
    }
    const crossTenant: MembershipAccess = { ...membership, grants: [{ scope: { kind: 'enterprise', id: 'enterprise-a', tenant: 'tenant-b', path: [] }, permissions: ['order.read'], effective: '2026-01-01T00:00:00.000Z', expires: null }] };
    expect(decide(crossTenant, 'order.read', resource, { expectedAccessVersion: 3, now })).toMatchObject({ allowed: false, reason: 'SCOPE_DENIED' });
    const expired: MembershipAccess = { ...membership, grants: [{ scope, permissions: ['order.read'], effective: '2026-01-01T00:00:00.000Z', expires: '2026-08-20T23:59:59.000Z' }] };
    expect(decide(expired, 'order.read', scope, { expectedAccessVersion: 3, now })).toMatchObject({ allowed: false, reason: 'PERMISSION_MISSING' });
  });

  it('fails closed for missing tenant context and anchors platform grants to the canonical hierarchy', () => {
    const now = new Date('2026-08-21T00:00:00.000Z');
    const resource: Scope = { kind: 'mall', id: 'mall-a', tenant: 'tenant-a', path: [
      { kind: 'platform', id: 'organization-platform-root' }, { kind: 'tenant', id: 'tenant-a' },
    ] };
    const accessFor = (grantScope: Scope): MembershipAccess => ({ ...membership, grants: [{
      scope: grantScope, permissions: ['order.read'], effective: '2026-01-01T00:00:00.000Z', expires: null,
    }] });

    expect(decide(accessFor({ kind: 'mall', id: 'mall-a', path: [] }), 'order.read', resource,
      { expectedAccessVersion: 3, now })).toMatchObject({ allowed: false, reason: 'SCOPE_DENIED' });
    expect(decide(accessFor({ kind: 'mall', id: 'mall-a', tenant: 'tenant-a', path: [] }), 'order.read',
      { kind: resource.kind, id: resource.id, path: resource.path }, { expectedAccessVersion: 3, now }))
      .toMatchObject({ allowed: false, reason: 'SCOPE_DENIED' });
    expect(decide(accessFor({ kind: 'platform', id: 'unrelated-platform', path: [] }), 'order.read', resource,
      { expectedAccessVersion: 3, now })).toMatchObject({ allowed: false, reason: 'SCOPE_DENIED' });
    expect(decide(accessFor({ kind: 'platform', id: 'organization-platform-root', path: [] }), 'order.read', resource,
      { expectedAccessVersion: 3, now }).allowed).toBe(true);
  });

  it('authorizes ownership commands only through the caller self grant and fresh Step-Up', () => {
    const now = new Date('2026-08-21T00:00:00.000Z');
    const ownerSelf: Scope = { kind: 'self', id: 'principal:owner', path: [] };
    const access: MembershipAccess = { ...membership, grants: [{ scope: ownerSelf,
      permissions: ['access.ownership.read', 'access.ownership.transfer', 'access.ownership.accept'],
      effective: '2026-01-01T00:00:00.000Z', expires: null }] };

    expect(decide(access, 'access.ownership.read', ownerSelf, { expectedAccessVersion: 3, now }).allowed).toBe(true);
    expect(decide(access, 'access.ownership.transfer', ownerSelf, { expectedAccessVersion: 3, now }))
      .toMatchObject({ allowed: false, reason: 'STEPUP_REQUIRED' });
    expect(decide(access, 'access.ownership.transfer', ownerSelf, { expectedAccessVersion: 3, now,
      stepupAt: new Date('2026-08-20T23:59:00.000Z') }).allowed).toBe(true);
    expect(decide(access, 'access.ownership.accept', { kind: 'self', id: 'principal:other', path: [] },
      { expectedAccessVersion: 3, now, stepupAt: now })).toMatchObject({ allowed: false, reason: 'SCOPE_DENIED' });
  });
});
