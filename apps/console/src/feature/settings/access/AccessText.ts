import { CLIENT_BY_ID } from '@shop/config/clientcatalog';
import { chineseDomainLabel } from '@shop/presentation';
import type { AccessMembership, AccessRole } from './model/Access';

export function accountLabel(membership: AccessMembership): string {
  if (membership.mobileMasked && membership.mobileMasked !== '***') return `手机 ${membership.mobileMasked}`;
  return `${CLIENT_BY_ID.get(membership.client)?.title ?? '业务系统'}成员`;
}

export function membershipStatusLabel(status: AccessMembership['status']): string {
  if (status === 'active') return '可使用';
  if (status === 'invited') return '待加入';
  if (status === 'suspended') return '已停用';
  return '已离职';
}

export function roleKindLabel(kind: AccessRole['kind']): string {
  if (kind === 'owner') return '最高管理员';
  if (kind === 'system') return '系统岗位';
  return '自定义岗位';
}

export function roleName(role: AccessRole): string {
  return chineseDomainLabel(role.name, role.name);
}

export function roleDescription(role: AccessRole): string {
  if (role.description.trim()) return role.description;
  if (role.kind === 'owner') return '负责当前范围的最高管理权限与安全交接。';
  if (role.kind === 'system') return '系统按账号用途自动授予的基础岗位。';
  return '按团队职责配置的一组业务权限。';
}
