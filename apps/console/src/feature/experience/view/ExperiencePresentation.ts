import type { Experience } from '../model/Experience';
import type { CommerceTone } from '../model/ExperienceWorkspace';

export function applicationStatusLabel(value: string): string {
  const normalized = value.toLowerCase();
  if (['active', 'enabled', 'published'].includes(normalized)) return '运营中';
  if (['draft', 'pending'].includes(normalized)) return '筹备中';
  if (['disabled', 'inactive', 'closed'].includes(normalized)) return '已停用';
  return '待识别状态';
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
  return '待识别状态';
}

export function validationTone(value: string | null | undefined): CommerceTone {
  if (value === 'valid') return 'success';
  if (value === 'invalid') return 'danger';
  if (value === 'pending') return 'warning';
  return 'neutral';
}

export function publicationLabel(row: Experience): string {
  if (row.publishedSequence === null) return '未发布';
  return `已发布第 ${row.publishedSequence} 版`;
}

export function entryLabel(state: Experience['entry']['state']): string {
  return { ready: '可扫码', unpublished: '待发布', disabled: '已停用', invalid: '发布异常' }[state];
}

export function entryTone(state: Experience['entry']['state']): CommerceTone {
  const tones: Readonly<Record<Experience['entry']['state'], CommerceTone>> = { ready: 'success', unpublished: 'warning', disabled: 'neutral', invalid: 'danger' };
  return tones[state];
}
