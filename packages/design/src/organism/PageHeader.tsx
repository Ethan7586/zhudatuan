import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, description, context, actions }: Readonly<{ eyebrow?: string; title: string; description?: string; context?: ReactNode; actions?: ReactNode }>) {
  return <header className="pageheader"><div>{eyebrow ? <p className="pageeyebrow">{eyebrow}</p> : null}<h1>{title}</h1>{description ? <p>{description}</p> : null}{context}</div>{actions ? <div className="pageactions">{actions}</div> : null}</header>;
}
