import type { Invitation } from '../model/Invitation';

export const invitationKind = (value: Invitation['kind']): string => (value === 'enrollment' ? '员工注册' : value === 'campaign' ? '共享注册' : '登录邀请');
const TARGET_LABELS: Readonly<Record<Invitation['target'], string>> = Object.freeze({
  console: '运营控制台',
  storefront: '消费者商城',
  miniapp: '微信小程序',
  store: '门店工作台',
  supplier: '供应链后台',
});
export const invitationTarget = (value: Invitation['target']): string => TARGET_LABELS[value];
export const invitationStatus = (value: Invitation['status']): string => ({ draft: '草稿', active: '生效中', exhausted: '已用尽', revoked: '已撤销', expired: '已过期' })[value];
export function invitationTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}
