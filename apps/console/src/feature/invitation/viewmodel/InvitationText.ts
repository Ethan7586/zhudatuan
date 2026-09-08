import type { Invitation } from '../model/Invitation';

export const invitationKind = (value: Invitation['kind']): string => (value === 'enrollment' ? '指定员工注册' : value === 'campaign' ? '共享员工注册' : '指定成员安全访问');
const TARGET_LABELS: Readonly<Record<Invitation['target'], string>> = Object.freeze({
  console: '运营控制台',
  storefront: '消费者商城',
  miniapp: '微信小程序',
  store: '门店工作台',
  supplier: '供应链后台',
});
export const invitationTarget = (value: Invitation['target']): string => TARGET_LABELS[value];
export function invitationStatus(value: Invitation['status'], kind?: Invitation['kind']): string {
  if (value === 'active') return kind === 'enrollment' ? '等待员工注册' : kind === 'campaign' ? '开放注册中' : '等待成员确认';
  if (value === 'exhausted') return kind === 'enrollment' ? '员工已注册' : kind === 'campaign' ? '注册名额已用完' : '成员已确认';
  return ({ draft: '准备中', revoked: '已撤销', expired: '已过期' } as const)[value];
}
export function invitationTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}
