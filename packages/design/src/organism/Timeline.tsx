import type { ReactNode } from 'react';
import './Composite.css';

export interface TimelineItem {
  readonly id: string;
  readonly title: string;
  readonly occurredAt: string;
  readonly detail?: ReactNode;
  readonly tone?: 'neutral' | 'success' | 'warning' | 'danger';
}

export function Timeline({ label, items }: Readonly<{ label: string; items: readonly TimelineItem[] }>) {
  return <ol className="shoptimeline" aria-label={label}>{items.map((item) => <li key={item.id} data-tone={item.tone ?? 'neutral'}><span aria-hidden="true" /><div><strong>{item.title}</strong><time dateTime={item.occurredAt}>{new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.occurredAt))}</time>{item.detail}</div></li>)}</ol>;
}
