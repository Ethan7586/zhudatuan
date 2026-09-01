import { createElement } from 'react';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface StatusProps {
  readonly children: string;
  readonly tone?: StatusTone;
}

export function Status({ children, tone = 'neutral' }: StatusProps) {
  return createElement('span', { className: `shopstatus shopstatus${tone}` }, children);
}
