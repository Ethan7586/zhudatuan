import type { Application } from './ApplicationSchema';
import type { CommerceWorkspaceMode } from './ApplicationScope';

export type CommerceTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface CommerceMetric {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly tone: CommerceTone;
}

export interface CommerceFlowStep {
  readonly label: string;
  readonly detail: string;
}

const modeFlows: Readonly<Record<CommerceWorkspaceMode, readonly CommerceFlowStep[]>> = Object.freeze({
  governance: Object.freeze([
    { label: '商城准入', detail: '平台审核' },
    { label: '应用建档', detail: '范围归属' },
    { label: '版本校验', detail: '配置安全' },
    { label: '域名绑定', detail: '唯一映射' },
    { label: '发布监测', detail: '异常治理' },
  ]),
  management: Object.freeze([
    { label: '创建商城', detail: '填写建店信息' },
    { label: '组织关系', detail: '集团归属' },
    { label: '初始商品池', detail: '经营边界' },
    { label: '开店草稿', detail: '初始化应用' },
    { label: '切换商城', detail: '继续装修' },
  ]),
  design: Object.freeze([
    { label: '页面结构', detail: '首页与频道' },
    { label: '视觉模板', detail: '品牌组件' },
    { label: '导航配置', detail: '消费路径' },
    { label: '安全预览', detail: '校验引用' },
    { label: '版本发布', detail: '可恢复上线' },
  ]),
});

export function commerceFlow(mode: CommerceWorkspaceMode): readonly CommerceFlowStep[] {
  return modeFlows[mode];
}

export function applicationSummary(rows: readonly Application[]): readonly CommerceMetric[] {
  const published = rows.filter((row) => row.published_sequence !== null && row.published_sequence !== undefined).length;
  const drafts = rows.filter((row) => row.head_sequence !== null && row.head_sequence !== undefined
    && row.head_sequence !== row.published_sequence).length;
  const attention = rows.filter(needsAttention).length;
  return Object.freeze([
    { label: '当前页应用', value: String(rows.length), hint: '来自当前 Scope 的读模型', tone: 'info' },
    { label: '已有发布', value: String(published), hint: '返回有效发布版本', tone: 'success' },
    { label: '待继续草稿', value: String(drafts), hint: '草稿领先于发布版本', tone: drafts > 0 ? 'warning' : 'neutral' },
    { label: '需要处理', value: String(attention), hint: '校验失败或绑定不完整', tone: attention > 0 ? 'danger' : 'success' },
  ]);
}

export function applicationStatusLabel(value: string): string {
  const normalized = value.toLowerCase();
  if (['active', 'enabled', 'published'].includes(normalized)) return '运营中';
  if (['draft', 'pending'].includes(normalized)) return '筹备中';
  if (['disabled', 'inactive', 'closed'].includes(normalized)) return '已停用';
  return value;
}

export function applicationStatusTone(value: string): CommerceTone {
  const normalized = value.toLowerCase();
  if (['active', 'enabled', 'published'].includes(normalized)) return 'success';
  if (['draft', 'pending'].includes(normalized)) return 'warning';
  if (['disabled', 'inactive', 'closed'].includes(normalized)) return 'neutral';
  return 'info';
}

export function validationLabel(value: string | null | undefined): string {
  if (value === null || value === undefined) return '尚未校验';
  if (value === 'valid') return '校验通过';
  if (value === 'invalid') return '校验失败';
  if (value === 'pending') return '等待校验';
  return value;
}

export function validationTone(value: string | null | undefined): CommerceTone {
  if (value === 'valid') return 'success';
  if (value === 'invalid') return 'danger';
  if (value === 'pending') return 'warning';
  return 'neutral';
}

export function publicationLabel(row: Application): string {
  if (row.published_sequence === null || row.published_sequence === undefined) return '未发布';
  return `已发布 v${row.published_sequence}`;
}

export function needsAttention(row: Application): boolean {
  return row.head_validation_state === 'invalid'
    || row.mall_id === null
    || row.mall_id === undefined
    || row.pool_id === null
    || row.pool_id === undefined;
}
