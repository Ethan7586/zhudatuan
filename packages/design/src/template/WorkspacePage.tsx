import type { ReactNode } from 'react';
import { ResourceState, type ResourceCondition } from '../organism/ResourceState';
import { SectionBoundary } from '../organism/SectionBoundary';

export interface WorkspacePageProps {
  readonly label: string;
  readonly className?: string;
  readonly drawerOpen?: boolean;
  readonly header: ReactNode;
  readonly controls?: ReactNode;
  readonly condition: ResourceCondition;
  readonly error?: string;
  readonly retry?: () => void;
  readonly emptyTitle?: string;
  readonly emptyMessage?: string;
  readonly children: ReactNode;
  readonly layers?: ReactNode;
}

export function WorkspacePage({ label, className, drawerOpen, header, controls, condition, error, retry, emptyTitle, emptyMessage, children, layers }: Readonly<WorkspacePageProps>) {
  return (
    <section className={['workspacepage', className].filter(Boolean).join(' ')} aria-label={label} {...(drawerOpen === undefined ? {} : { 'data-drawer': drawerOpen ? 'open' : 'closed' })}>
      {header}
      {controls}
      <SectionBoundary title={`${label}暂时无法显示`} resetKey={condition}>
        <ResourceState condition={condition} {...(error === undefined ? {} : { error })} {...(retry === undefined ? {} : { retry })} {...(emptyTitle === undefined ? {} : { emptyTitle })} {...(emptyMessage === undefined ? {} : { emptyMessage })}>
          {children}
        </ResourceState>
      </SectionBoundary>
      {layers}
    </section>
  );
}
