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
