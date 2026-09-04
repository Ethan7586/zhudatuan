import type { HTMLAttributes, ReactNode } from 'react';

export type SurfaceDepth = 'flat' | 'low' | 'raised' | 'floating';
export type SurfacePadding = 'none' | 'compact' | 'default' | 'spacious';
export type SurfaceRadius = 'small' | 'medium' | 'large' | 'extraLarge';

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
  readonly depth?: SurfaceDepth;
  readonly padding?: SurfacePadding;
  readonly radius?: SurfaceRadius;
}

export function Surface({ children, className, depth = 'flat', padding = 'default', radius = 'large', ...props }: SurfaceProps) {
  return (
    <div {...props} className={['swsurface', className].filter(Boolean).join(' ')} data-depth={depth} data-padding={padding} data-radius={radius}>
      {children}
    </div>
  );
}
