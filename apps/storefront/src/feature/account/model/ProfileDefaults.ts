import type { EnterpriseMall, Profile } from './Profile';

export const UNRESOLVED_MALL: EnterpriseMall = Object.freeze({
  id: 'unresolved',
  enterpriseId: '',
  enterpriseName: '尚未连接企业',
  mallName: '智慧翼福利商城',
  logoText: '智慧翼',
  badge: '数据库连接未建立',
  welcomeBanner: '登录后从生产数据库加载企业商品与权益。',
});

export const EMPTY_GUEST_PROFILE: Profile = Object.freeze({
  id: 'guest',
  employeeId: '未登录',
  name: '访客',
  avatar: '',
  phone: '未绑定',
  jobTitle: '访客',
  department: '未登录',
  enterpriseId: '',
  enterpriseName: '尚未连接企业',
  currentMallId: UNRESOLVED_MALL.id,
  welfareBalanceMinor: 0,
  mealBalanceMinor: 0,
  couponCount: 0,
  assuranceLevel: 'account',
  phoneVerified: false,
  paymentEligible: false,
  accessVersion: 0,
  locale: 'zh-CN',
  timezone: 'Asia/Shanghai',
  marketingAllowed: false,
  preferenceVersion: 0,
});
