import type { ReactNode } from 'react';

export interface IconProps {
  readonly children: ReactNode;
  readonly label?: string;
  readonly size?: 'small' | 'medium' | 'standard' | 'large';
}

export function Icon({ children, label, size = 'standard' }: Readonly<IconProps>) {
  return <span className="shopicon" data-size={size} role={label === undefined ? undefined : 'img'} aria-label={label} aria-hidden={label === undefined ? true : undefined}>{children}</span>;
}
