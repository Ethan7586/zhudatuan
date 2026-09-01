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

  it('keeps a freely named “管理员” identity in the business partition', () => {
    const roles = partitionAssignedRoles([
      { role: 'role-custom-administrator', name: '管理员' },
    ], 'tenant');

    expect(roles.governance).toEqual([]);
    expect(roles.business).toEqual([
      { id: 'role-custom-administrator', label: '管理员' },
    ]);
  });

  it('uses authoritative governance metadata for merchant Owner and administrator levels', () => {
    const assigned = [
      { role: 'role-merchant-owner', name: 'Owner' },
      { role: 'role-senior-administrator', name: '高级管理员' },
      { role: 'role-normal-administrator', name: '普通管理员' },
      { role: 'role-custom-administrator', name: '管理员' },
    ];
    const roles = partitionAssignedRoles(assigned, 'tenant', [
      { id: 'role-merchant-owner', name: 'Owner', governance: true },
      { id: 'role-senior-administrator', name: '高级管理员', governance: true },
      { id: 'role-normal-administrator', name: '普通管理员', governance: true },
      { id: 'role-custom-administrator', name: '管理员', governance: false },
    ]);

    expect(roles.governance).toEqual([
      { id: 'role-merchant-owner', label: '商户 Owner' },
      { id: 'role-senior-administrator', label: '高级管理员' },
      { id: 'role-normal-administrator', label: '普通管理员' },
    ]);
    expect(roles.business).toEqual([{ id: 'role-custom-administrator', label: '管理员' }]);
  });

  it('groups and deduplicates the actual session permissions by authoritative catalog domain', () => {
    const groups = permissionGroupsOf(['finance.overview.read', 'order.read', 'finance.overview.read']);
    expect(groups).toEqual([
      { category: 'order', label: '订单与售后', permissions: ['order.read'] },
      { category: 'finance', label: '财务', permissions: ['finance.overview.read'] },
    ]);
  });
});
