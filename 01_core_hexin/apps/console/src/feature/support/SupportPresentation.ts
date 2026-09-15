import { formatDate } from '../../shared/ui/Format';

const states: Readonly<Record<string, string>> = Object.freeze({
  closed: '已关闭',
  open: '待处理',
  pending: '处理中',
  resolved: '已解决',
  waiting: '等待消费者',
});

const priorities: Readonly<Record<string, string>> = Object.freeze({
  critical: '紧急',
  high: '高',
  low: '低',
  normal: '普通',
  urgent: '紧急',
});

const channels: Readonly<Record<string, string>> = Object.freeze({
  app: 'App',
  chat: '在线客服',
  email: '邮件',
  phone: '电话',
  storefront: '商城',
  web: '网页',
  wechat: '微信',
});

export function supportStateLabel(value: string): string {
  return states[value.toLowerCase()] ?? value;
}

export function supportPriorityLabel(value: string): string {
  return priorities[value.toLowerCase()] ?? value;
}

export type SupportPriorityGrade = 'P0' | 'P1' | 'P2' | 'P3';

export function supportPriorityGrade(value: string): SupportPriorityGrade {
  const normalized = value.toLowerCase();
  if (normalized === 'urgent' || normalized === 'critical') return 'P0';
  if (normalized === 'high') return 'P1';
  if (normalized === 'low') return 'P3';
  return 'P2';
}

export function supportPriorityFromGrade(value: SupportPriorityGrade): 'urgent' | 'high' | 'normal' | 'low' {
  return value === 'P0' ? 'urgent' : value === 'P1' ? 'high' : value === 'P3' ? 'low' : 'normal';
}

export function supportPriorityGuidance(value: SupportPriorityGrade): string {
  if (value === 'P0') return '业务中断、资金或安全风险，需要立即响应';
  if (value === 'P1') return '核心功能受阻或影响多人，需要优先处理';
  if (value === 'P2') return '单用户常规问题，按标准队列处理';
  return '咨询、建议或低影响事项，可计划处理';
}

export function supportHistoryLabel(kind: string): string {
  if (kind === 'priority.reviewed') return '完成 P 级审核';
  if (kind === 'attachment.uploaded') return '上传附件';
  if (kind === 'internal.note') return '添加内部备注';
  if (kind === 'message') return '发送公开回复';
  if (kind === 'opened') return '创建工单';
  if (kind === 'assigned' || kind === 'reassigned') return '分配处理人';
  if (kind === 'resolved') return '标记已解决';
  if (kind === 'closed') return '关闭工单';
  if (kind === 'reopened') return '重新打开工单';
  return '更新工单';
}

export function supportChannelLabel(value: string): string {
  return channels[value.toLowerCase()] ?? value;
}

export function supportTone(value: string): 'danger' | 'muted' | 'success' | 'warning' {
  const normalized = value.toLowerCase();
  if (normalized === 'critical' || normalized === 'urgent' || normalized === 'high') return 'danger';
  if (normalized === 'closed' || normalized === 'low') return 'muted';
  if (normalized === 'resolved') return 'success';
  return 'warning';
}

export function supportAuthorLabel(authorType: string): string {
  if (authorType.toLowerCase() === 'agent') return '管理员';
  if (authorType.toLowerCase() === 'member') return '消费者';
  return '消息发起人';
}

export function supportAuthorInitial(authorType: string): string {
  return authorType.toLowerCase() === 'agent' ? '管' : authorType.toLowerCase() === 'member' ? '消' : '讯';
}

export function supportRoleLabel(level: 'owner' | 'senior_administrator' | 'administrator' | 'member' | undefined): string {
  if (level === 'owner') return '商城负责人';
  if (level === 'senior_administrator') return '高级管理员';
  if (level === 'member') return '成员';
  return '管理员';
}

export function supportTime(value: string | null | undefined): string {
  return formatDate(value);
}

export function shortIdentifier(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}
