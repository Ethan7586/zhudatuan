import { chineseReference } from '@shop/presentation';
import type { Message } from '../model/Message';

const states: Readonly<Record<string, string>> = Object.freeze({ open: '待处理', assigned: '处理中', waiting: '等待用户', resolved: '已解决', closed: '已关闭' });
const priorities: Readonly<Record<string, string>> = Object.freeze({ low: '低', normal: '普通', high: '高', urgent: '紧急' });
const channels: Readonly<Record<string, string>> = Object.freeze({ inapp: '在线客服', wechat: '微信', email: '邮件', sms: '短信' });

export const stateLabel = (value: string): string => states[value] ?? '待识别状态';
export const priorityLabel = (value: string): string => priorities[value] ?? '普通';
export const channelLabel = (value: string): string => channels[value] ?? '其他渠道';
export const authorLabel = (value: Message): string => (value.authorType === 'agent' ? `客服 · ${shortId(value.authorId)}` : `用户 · ${shortId(value.authorId)}`);
export const tone = (value: string): 'danger' | 'muted' | 'success' | 'warning' =>
  value === 'urgent' || value === 'high' || value === 'open' ? 'danger' : value === 'closed' || value === 'low' ? 'muted' : value === 'resolved' ? 'success' : 'warning';
export const shortId = (value: string): string => chineseReference('编号', value);
export const formatTime = (value: string): string => new Date(value).toLocaleString('zh-CN', { hour12: false });
