import { ResourceState, SectionBoundary } from '@shop/design';
import type { ReactNode } from 'react';
import type { CockpitSectionState } from '../viewmodel/CockpitSections';

export function CockpitSection<T>({ title, state, children }: Readonly<{ title: string; state: CockpitSectionState<T>; children: ReactNode }>) {
  return (
    <section className="cockpitsection" aria-label={title}>
      <SectionBoundary title={`${title}暂时无法显示`} resetKey={`${state.condition}:${state.revision}`}>
        <ResourceState condition={state.condition} {...(state.error ? { error: state.error } : {})} retry={state.retry}>
          {children}
        </ResourceState>
      </SectionBoundary>
    </section>
  );
}
