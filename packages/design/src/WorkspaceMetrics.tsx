import type { HTMLAttributes, ReactNode } from 'react';

export type MetricTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type MetricGridColumns = 'auto' | 'two' | 'three' | 'four';

export interface MetricGridProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
  readonly columns?: MetricGridColumns;
}

export function MetricGrid({ children, className, columns = 'auto', ...props }: MetricGridProps) {
  return (
    <div {...props} className={['swmetricgrid', className].filter(Boolean).join(' ')} data-columns={columns} role="list">
      {children}
    </div>
  );
}

export interface MetricCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  readonly label: ReactNode;
  readonly value: ReactNode;
  readonly description?: ReactNode;
  readonly icon?: ReactNode;
  readonly tone?: MetricTone;
  readonly trend?: ReactNode;
}

export function MetricCard({ className, description, icon, label, role = 'listitem', tone = 'neutral', trend, value, ...props }: MetricCardProps) {
  return (
    <div {...props} className={['swmetriccard', className].filter(Boolean).join(' ')} data-tone={tone} role={role}>
      <div className="swmetriccardhead">
        <span className="swmetriccardlabel">{label}</span>
        {icon === undefined ? null : <span className="swmetriccardicon">{icon}</span>}
      </div>
      <strong className="swmetriccardvalue">{value}</strong>
      {trend === undefined && description === undefined ? null : (
        <div className="swmetriccardfoot">
          {trend === undefined ? null : <span className="swmetriccardtrend">{trend}</span>}
          {description === undefined ? null : <span className="swmetriccarddescription">{description}</span>}
        </div>
      )}
    </div>
  );
}
