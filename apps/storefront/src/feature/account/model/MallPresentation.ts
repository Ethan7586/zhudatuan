import type { EnterpriseMall } from './Profile';
import type { Membership } from './Membership';

export function presentCurrentMall(scope: string, membership?: Membership): EnterpriseMall {
  const name = membership?.name.trim() || '企业福利商城';
  return Object.freeze({
    id: scope,
    membershipId: membership?.id,
    enterpriseId: membership?.organizationId ?? scope,
    enterpriseName: membership?.name.trim() || '当前企业',
    mallName: name,
    logoText: name.slice(0, 4),
    badge: '当前商城',
    roleLabel: membership?.roleLabel.trim() || '企业成员',
    welcomeBanner: '企业员工福利商城已开放，实际权益以企业发放为准。',
  });
}

export function presentMembershipMall(membership: Membership): EnterpriseMall {
  const name = membership.name.trim() || '企业福利商城';
  return Object.freeze({
    id: membership.organizationId,
    membershipId: membership.id,
    enterpriseId: membership.organizationId,
    enterpriseName: name,
    mallName: name,
    logoText: name.slice(0, 4),
    badge: membership.current ? '当前商城' : '可切换',
    roleLabel: membership.roleLabel.trim() || '企业成员',
    welcomeBanner: membership.current ? '当前授权商城' : '可切换授权商城',
  });
}
