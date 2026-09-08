import type { ReactNode } from 'react';

export function LiveRegion({ children, urgent = false }: Readonly<{ children: ReactNode; urgent?: boolean }>) {
  return <div className="sr-only" role={urgent ? 'alert' : 'status'} aria-live={urgent ? 'assertive' : 'polite'} aria-atomic="true">{children}</div>;
}
