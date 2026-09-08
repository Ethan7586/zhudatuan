import type { ReactNode } from 'react';

export function FilterBar({ label, children, actions }: Readonly<{ label: string; children: ReactNode; actions?: ReactNode }>) {
  return <section className="filterbar" aria-label={label}><div className="filterfields">{children}</div>{actions ? <div className="filteractions">{actions}</div> : null}</section>;
}
