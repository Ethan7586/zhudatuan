import type { ReactNode } from 'react';

export function FilterBar({ label, children, actions }: Readonly<{ label: string; children: ReactNode; actions?: ReactNode }>) {
  return (
    <section className="filterbar" aria-label={label}>
      <div className="filterform">{children}</div>
      {actions ? <div className="filterbaractions" role="group" aria-label={`${label}操作`}>{actions}</div> : null}
    </section>
  );
}
