import type { HTMLAttributes, ReactNode } from 'react';

export type IconSize = 'extraSmall' | 'small' | 'medium' | 'standard' | 'large' | 'extraLarge' | 'hero';
export type IconTone = 'current' | 'brand' | 'muted' | 'success' | 'warning' | 'danger' | 'inverse';

export interface IconProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  readonly children: ReactNode;
  readonly label?: string;
  readonly size?: IconSize;
  readonly tone?: IconTone;
}

export function Icon({ children, className, label, size = 'medium', tone = 'current', ...props }: IconProps) {
  return (
    <span {...props} {...(label === undefined ? { 'aria-hidden': true } : { 'aria-label': label, role: 'img' })} className={['swicon', className].filter(Boolean).join(' ')} data-size={size} data-tone={tone}>
      {children}
    </span>
  );
}
