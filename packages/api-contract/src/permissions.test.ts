import { describe, expect, it } from 'vitest';
import { PERMISSION_CATALOG, PERMISSIONS } from './permissions';

describe('MVP permission catalogue', () => {
  it('has unique stable codes and a risk classification for every permission', () => {
    const codes = PERMISSION_CATALOG.map((permission) => permission.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(codes)).toEqual(new Set(Object.values(PERMISSIONS)));
    expect(PERMISSION_CATALOG.every((permission) => permission.category && permission.name && permission.risk)).toBe(true);
  });

  it('classifies owner, secrets, refunds and grants as critical', () => {
    const critical = new Set(PERMISSION_CATALOG.filter((permission) => permission.risk === 'critical').map((permission) => permission.code));
    expect(critical.has(PERMISSIONS.tenantManage)).toBe(true);
    expect(critical.has(PERMISSIONS.integrationManageSecrets)).toBe(true);
    expect(critical.has(PERMISSIONS.orderRefund)).toBe(true);
    expect(critical.has(PERMISSIONS.roleGrant)).toBe(true);
  });
});
