import { describe, expect, it } from 'vitest';
import { mapEnrollment, mapInvitation } from '../../src/feature/invitation/infrastructure/InvitationMapper';

describe('invitation contract', () => {
  it('maps an enrollment without copying policy authority into the browser', () => {
    const result = mapEnrollment({
      id: 'enrollment-1', kind: 'enrollment', target: 'storefront', expiresAt: '2099-01-01T00:00:00.000Z', subjectMode: 'bound',
      organization: { id: 'organization-1', name: '示例企业' }, recipientMasked: '138****0000', employee: { displayName: '测试员工', employeeNo: 'E001', departmentName: '研发部' },
      policy: { terms_title: '服务协议', terms_body: '条款', privacy_title: '隐私政策', privacy_body: '隐私', terms_hash: 'hash' },
    });
    expect(result).toMatchObject({ id: 'enrollment-1', subjectMode: 'bound', employee: { employeeNo: 'E001' }, policy: { termsHash: 'hash' } });
    expect(Object.isFrozen(result.policy)).toBe(true);
  });

  it('accepts only explicit invitation outcome variants', () => {
    expect(mapInvitation({ kind: 'enrollment', enrollment: { id: 'enrollment-1', expiresAt: '2099-01-01T00:00:00.000Z', target: 'storefront' } })).toMatchObject({ kind: 'enrollment' });
    expect(mapInvitation({ kind: 'proofRequired', proof: { reference: 'proof-1', expiresAt: '2099-01-01T00:00:00.000Z', method: 'otp', target: 'storefront' } })).toMatchObject({ kind: 'proof' });
  });
});
