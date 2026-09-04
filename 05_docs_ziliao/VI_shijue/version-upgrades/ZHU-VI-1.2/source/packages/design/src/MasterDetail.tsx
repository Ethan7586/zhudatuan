import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

export interface MasterDetailProps extends HTMLAttributes<HTMLDivElement> {
  readonly master: ReactNode;
  readonly detail: ReactNode;
  readonly masterLabel: string;
  readonly detailLabel: string;
}

export function MasterDetail({ className, detail, detailLabel, master, masterLabel, ...props }: MasterDetailProps) {
  return (
    <div {...props} className={['swmasterdetail', className].filter(Boolean).join(' ')}>
      <aside className="swmasterdetailmaster" aria-label={masterLabel}>
        {master}
      </aside>
      <section className="swmasterdetailcontent" aria-label={detailLabel}>
        {detail}
      </section>
    </div>
  );
}

export interface MasterItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly leading?: ReactNode;
  readonly meta?: ReactNode;
  readonly selected?: boolean;
  readonly trailing?: ReactNode;
}

export function MasterItem({ className, description, leading, meta, selected = false, title, trailing, type = 'button', ...props }: MasterItemProps) {
  return (
    <button {...props} type={type} aria-current={selected ? 'true' : undefined} className={['swmasteritem', className].filter(Boolean).join(' ')} data-selected={selected || undefined}>
      {leading === undefined ? null : <span className="swmasteritemleading">{leading}</span>}
      <span className="swmasteritemcopy">
        <strong>{title}</strong>
        {description === undefined ? null : <span>{description}</span>}
        {meta === undefined ? null : <small>{meta}</small>}
      </span>
      {trailing === undefined ? null : <span className="swmasteritemtrailing">{trailing}</span>}
    </button>
  );
}
