import type { HTMLAttributes, ReactNode } from 'react';

export interface WorkspaceHeroProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  readonly title: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly description?: ReactNode;
  readonly identity?: ReactNode;
  readonly actions?: ReactNode;
  readonly meta?: ReactNode;
}

export function WorkspaceHero({ actions, className, description, eyebrow, identity, meta, title, ...props }: WorkspaceHeroProps) {
  return (
    <header {...props} className={['swworkspacehero', className].filter(Boolean).join(' ')}>
      {identity === undefined ? null : <div className="swworkspaceheroidentity">{identity}</div>}
      <div className="swworkspaceherocopy">
        {eyebrow === undefined ? null : <p className="swworkspaceheroeyebrow">{eyebrow}</p>}
        <h1 className="swworkspaceherotitle">{title}</h1>
        {description === undefined ? null : <p className="swworkspaceherodescription">{description}</p>}
      </div>
      {actions === undefined && meta === undefined ? null : (
        <div className="swworkspaceheroside">
          {meta === undefined ? null : <div className="swworkspaceherometa">{meta}</div>}
          {actions === undefined ? null : (
            <div className="swworkspaceheroactions" role="group" aria-label="工作台操作">
              {actions}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
