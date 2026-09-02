import { describe, expect, it } from 'vitest';
import { employeeInvitation } from '../model/InvitationDraft';

describe('employee invitation', () => {
  it('creates only the fixed storefront enrollment command', () => {
    expect(employeeInvitation({
      organizationId: 'mall:one',
      displayName: '张三', mobile: '13800138000', employeeNo: 'E001', departmentId: 'department:one',
      expiresAt: '2026-09-09T00:00:00.000Z', reason: '新员工入职',
    })).toEqual({
      kind: 'enrollment', target: 'storefront', organizationId: 'mall:one',
      employee: { displayName: '张三', mobile: '13800138000', employeeNo: 'E001', departmentId: 'department:one' },
      expiresAt: '2026-09-09T00:00:00.000Z', reason: '新员工入职',
    });
  });
});
