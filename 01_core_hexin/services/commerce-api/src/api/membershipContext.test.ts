import { describe, expect, it } from 'vitest';
import { resourceScopeFromDatabaseRow } from './membershipContext';

describe('resource scope derivation', () => {
  it('accepts scope facts loaded from a database row', () => {
    expect(resourceScopeFromDatabaseRow({ tenant_id: 'tenant-a', enterprise_id: 'enterprise-a', mall_id: 'mall-a', supplier_id: 'supplier-a', user_id: 'user-a' })).toEqual({
      tenantId: 'tenant-a',
      enterpriseId: 'enterprise-a',
      mallId: 'mall-a',
      supplierId: 'supplier-a',
      ownerUserId: 'user-a',
    });
  });

  it('does not turn arbitrary request-shaped data into a resource scope', () => {
    expect(resourceScopeFromDatabaseRow({ mallId: 'attacker-controlled' })).toBeNull();
  });

  it('accepts only a typed organization path loaded from a database row', () => {
    expect(
      resourceScopeFromDatabaseRow({
        tenant_id: 'tenant-a',
        mall_id: 'mall-a',
        org_unit_path: [
          { kind: 'platform', resourceId: 'org-platform-smart-wing' },
          { kind: 'enterprise', resourceId: 'enterprise-a' },
          { kind: 'mall', resourceId: 'mall-a' },
        ],
      })
    ).toMatchObject({
      orgUnitPath: [
        { kind: 'platform', resourceId: 'org-platform-smart-wing' },
        { kind: 'enterprise', resourceId: 'enterprise-a' },
        { kind: 'mall', resourceId: 'mall-a' },
      ],
    });
  });

  it('fails closed when the database organization path is malformed', () => {
    expect(resourceScopeFromDatabaseRow({ tenant_id: 'tenant-a', org_unit_path: [{ kind: 'platform', resourceId: '' }] })).toEqual({ tenantId: 'tenant-a' });
  });
});
