import { describe, expect, it } from 'vitest';
import { partitionAssignedRoles, permissionGroupsOf } from './ProfileModel';

describe('personal profile presentation model', () => {
  it('keeps governance and custom business identities separate without deriving permissions from names', () => {
    const roles = partitionAssignedRoles([
      { role: 'role-platform-owner-v2', name: '平台业主' },
      { role: 'role-finance-admin', name: '财务管理员' },
      { role: 'role-cross-domain', name: '财务' },
    ], 'tenant');

    expect(roles.governance).toEqual([{ id: 'role-platform-owner-v2', label: '平台 Owner' }]);
    expect(roles.business).toEqual([
      { id: 'role-finance-admin', label: '财务管理员' },
      { id: 'role-cross-domain', label: '财务' },
    ]);
  });

  it('groups and deduplicates the actual session permissions by authoritative catalog domain', () => {
    const groups = permissionGroupsOf(['finance.overview.read', 'order.read', 'finance.overview.read']);
    expect(groups).toEqual([
      { category: 'order', label: '订单与售后', permissions: ['order.read'] },
      { category: 'finance', label: '财务', permissions: ['finance.overview.read'] },
    ]);
  });
});
