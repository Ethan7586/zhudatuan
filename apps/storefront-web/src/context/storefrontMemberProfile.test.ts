import { describe, expect, it } from 'vitest';
import { MOCK_USER } from '../mock/base';
import type { ApiBootstrap } from '../services/productionApi.types';
import { mergeAuthenticatedMemberProfile } from './storefrontMemberProfile';

describe('authenticated storefront member projection', () => {
  it('removes every demo-person identity field from a registered account', () => {
    const bootstrap = {
      actor: {
        userId: 'user-ethan',
        employeeNo: 'REG-ETHAN',
        displayName: 'ethan',
        departmentName: null,
        phoneMasked: null,
        roles: ['employee'],
        permissions: ['catalog.read'],
        assurance: {
          level: 'account',
          accountAuthenticated: true,
          accountAuthenticatedAt: '2026-08-13T00:00:00Z',
          phoneVerified: false,
          phoneVerifiedAt: null,
          phoneVerificationMethod: null,
          paymentEligible: false,
          restrictedCapabilities: ['order.create', 'payment.execute'],
        },
      },
      scope: { tenantId: 'tenant-one', enterpriseId: 'enterprise-one', mallId: 'mall-one', mallCode: 'MALL', mallName: '智慧翼商城', brandName: '智慧翼', enterpriseName: '演示企业' },
    } satisfies ApiBootstrap;

    const profile = mergeAuthenticatedMemberProfile(MOCK_USER, bootstrap);

    expect(profile).toMatchObject({ name: 'ethan', employeeId: 'REG-ETHAN', department: '未分配部门', phone: '未绑定', avatar: '', jobTitle: '员工会员', couponCount: 0, welfareBalance: MOCK_USER.welfareBalance });
    expect(profile.name).not.toBe('张建国');
  });
});
