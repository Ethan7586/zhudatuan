import type { HTMLAttributes } from 'react';

export type DividerTone = 'subtle' | 'default' | 'strong' | 'inverse';
export type DividerInset = 'none' | 'content' | 'icon';

export interface DividerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  readonly inset?: DividerInset;
  readonly orientation?: 'horizontal' | 'vertical';
  readonly tone?: DividerTone;
}

export function Divider({ className, inset = 'none', orientation = 'horizontal', tone = 'default', ...props }: DividerProps) {
  return <div {...props} aria-orientation={orientation} className={['swdivider', className].filter(Boolean).join(' ')} data-inset={inset} data-orientation={orientation} data-tone={tone} role="separator" />;
}
