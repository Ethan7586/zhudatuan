import type { ElementType, ReactNode } from 'react';

export function Text({ children, as: Element = 'span', tone = 'default', size = 'body' }: Readonly<{ children: ReactNode; as?: ElementType; tone?: 'default' | 'secondary' | 'danger'; size?: 'caption' | 'body' | 'heading' }>) {
  return <Element className="shoptext" data-tone={tone} data-size={size}>{children}</Element>;
}
