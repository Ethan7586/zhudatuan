import type { Experience } from './Experience';
import { chineseReference } from '@shop/presentation';

export interface EntryView {
  readonly title: string;
  readonly description: string;
  readonly tone: 'success' | 'warning' | 'neutral' | 'danger';
  readonly qr: boolean;
  readonly actions: boolean;
}

export function entryView(entry: Experience['entry']): EntryView {
  if (entry.state === 'ready') return Object.freeze({ title: '已发布，可扫码进入', description: '二维码始终进入当前有效发布版本，未发布草稿不会展示。', tone: 'success', qr: true, actions: true });
  if (entry.state === 'unpublished') return Object.freeze({ title: '发布后可扫码', description: '请先完成装修校验并发布商城，当前不会生成伪可用二维码。', tone: 'warning', qr: false, actions: false });
  if (entry.state === 'disabled') return Object.freeze({ title: '商城已停用', description: '旧二维码已即时失效。重新启用且有效发布存在后才可扫码。', tone: 'neutral', qr: false, actions: false });
  if (entry.state === 'invalid') return Object.freeze({ title: '发布状态异常', description: `入口已失败关闭，请刷新后重试或联系管理员。${chineseReference('请求', entry.requestId)}`, tone: 'danger', qr: false, actions: false });
  throw new Error('EXPERIENCE_ENTRY_STATE_INVALID');
}
