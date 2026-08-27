import type { UserProfile } from '../types';
import { EMPTY_GUEST_PROFILE } from './productionStorefrontState';

export function guestStorefrontProfile(source: UserProfile = EMPTY_GUEST_PROFILE): UserProfile {
  return {
    ...source,
    id: 'guest',
    employeeId: '未登录',
    name: '访客',
    avatar: '',
    phone: '未绑定',
    jobTitle: '访客预览',
    department: '未登录',
    welfareBalance: 0,
    mealBalance: 0,
    couponCount: 0,
    assuranceLevel: 'account',
    phoneVerified: false,
    paymentEligible: false,
  };
}
