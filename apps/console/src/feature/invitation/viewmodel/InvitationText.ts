import type { Invitation } from '../model/Invitation';

export const invitationKind = (value: Invitation['kind']): string => (value === 'enrollment' ? '员工注册' : value === 'campaign' ? '共享注册' : '登录邀请');
export const invitationTarget = (value: Invitation['target']): string => (value === 'storefront' ? '员工商城' : '管理控制台');
export const invitationStatus = (value: Invitation['status']): string => ({ draft: '草稿', active: '生效中', exhausted: '已用尽', revoked: '已撤销', expired: '已过期' })[value];
export function invitationTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}
