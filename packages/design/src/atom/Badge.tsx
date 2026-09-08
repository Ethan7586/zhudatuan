import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function Badge({ children, tone = 'neutral' }: Readonly<{ children: ReactNode; tone?: BadgeTone }>) {
  return <span className="shopbadge" data-tone={tone}>{children}</span>;
}
