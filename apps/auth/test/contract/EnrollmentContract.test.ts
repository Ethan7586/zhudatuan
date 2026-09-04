import { describe, expect, it } from 'vitest';
import { mapEnrollment } from '../../src/feature/enrollment/infrastructure/EnrollmentMapper';

describe('enrollment contract', () => {
  it('maps the one-time enrollment without copying policy authority into the browser', () => {
    const result = mapEnrollment({
      id: 'enrollment-1', kind: 'enrollment', target: 'storefront', expiresAt: '2099-01-01T00:00:00.000Z', subjectMode: 'bound',
      organization: { id: 'organization-1', name: '示例企业' }, recipientMasked: '138****0000', employee: { displayName: '测试员工', employeeNo: 'E001', departmentName: '研发部' },
      policy: { terms_title: '服务协议', terms_body: '条款', privacy_title: '隐私政策', privacy_body: '隐私', terms_hash: 'hash' },
    });
    expect(result).toMatchObject({ id: 'enrollment-1', subjectMode: 'bound', employee: { employeeNo: 'E001' }, policy: { termsHash: 'hash' } });
    expect(Object.isFrozen(result.policy)).toBe(true);
  });
});
