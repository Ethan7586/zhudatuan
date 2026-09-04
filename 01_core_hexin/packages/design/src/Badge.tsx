import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly children: ReactNode;
  readonly tone?: BadgeTone;
}

export function Badge({ children, className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span {...props} className={['swbadge', className].filter(Boolean).join(' ')} data-tone={tone}>
      {children}
    </span>
  );
}
