import type { OperationOutputFor } from '@shop/contract';
import type { Membership } from '../model/Membership';
import type { Favorite } from '../model/Favorite';
import type { Address } from '../model/Address';
import type { Profile } from '../model/Profile';
import type { EnterpriseMall } from '../model/Profile';
import type { BenefitBalances } from '../../benefit/public/BenefitReader';

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
});

export function mapMemberships(value: OperationOutputFor<'identity.memberships.read'>): readonly Membership[] {
  return Object.freeze(
    value.items.map((item) =>
      Object.freeze({
        id: item.id,
        organizationId: item.organizationId,
        name: item.name,
        current: item.current,
        accessVersion: Number(item.accessVersion),
      })
    )
  );
}

export function mapFavorites(value: OperationOutputFor<'member.favorites.read'>): readonly Favorite[] {
  return Object.freeze(value.items.map((item) => Object.freeze({ listingId: item.listingId, createdAt: item.createdAt })));
}

export function mapProfile(value: OperationOutputFor<'member.profile.read'>, balances: BenefitBalances = { welfareMinor: 0, mealMinor: 0 }): Profile {
  return Object.freeze({
    id: value.id,
    employeeId: value.employee_no ?? value.membership_id,
    name: value.display_name,
    avatar: '',
    phone: value.mobile_bound ? '已绑定' : '未绑定',
    jobTitle: '',
    department: value.organization_id,
    enterpriseId: value.organization_id,
    enterpriseName: value.organization_id,
    currentMallId: value.organization_id,
    welfareBalanceMinor: balances.welfareMinor,
    mealBalanceMinor: balances.mealMinor,
    couponCount: 0,
    assuranceLevel: value.mobile_bound ? 'phone' : 'account',
    phoneVerified: value.mobile_bound,
    paymentEligible: value.status === 'active',
    accessVersion: Number(value.access_version),
  });
}

export function mapAddresses(value: OperationOutputFor<'member.addresses.read'>): readonly Address[] {
  return Object.freeze(
    value.items.map((item, index) => {
      const [province = '', city = '', district = ''] = item.region_code.split('/');
      return Object.freeze({
        id: item.id,
        recipient: item.recipient_masked,
        mobile: item.mobile_masked,
        province,
        city,
        district,
        detail: item.address_masked,
        isDefault: index === 0,
        tag: '已加密地址',
        version: Number(item.version),
        status: item.status,
      });
    })
  );
}
