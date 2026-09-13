import {
  Children,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
} from 'react';

export const pageExperienceBudget = Object.freeze({
  interactionFeedbackMs: 100,
  stableShellMs: 200,
  warmInteractiveMs: 300,
  coldPrimaryDataTargetMs: 500,
  coldPrimaryDataInvestigationMs: 1_000,
  interactionToNextPaintP75Ms: 200,
  routeCumulativeLayoutShift: 0.05,
});

export interface StableWorkspaceTabsProps extends Omit<HTMLAttributes<HTMLElement>, 'aria-label'> {
  readonly activeIndex: number;
  readonly label: string;
  readonly children: ReactNode;
}

export function StableWorkspaceTabs({ activeIndex, label, children, className, style,
  ...props }: StableWorkspaceTabsProps) {
  const count = Math.max(1, Children.count(children));
  const normalizedIndex = Math.min(Math.max(activeIndex, 0), count - 1);
  const variables = {
    ...style,
    '--sw-stable-tabs-active': normalizedIndex,
    '--sw-stable-tabs-count': count,
  } as CSSProperties;
  return <nav {...props} className={['swstabletabs', className].filter(Boolean).join(' ')}
    aria-label={label} style={variables}>{children}</nav>;
}

export function useViewScrollMemory<View extends string>(
  activeView: View,
  resolveContainer: () => HTMLElement | null,
): () => void {
  const positions = useRef<Partial<Record<View, number>>>({});

  const rememberCurrentScroll = useCallback(() => {
    const container = resolveContainer();
    if (container !== null) positions.current[activeView] = container.scrollTop;
  }, [activeView, resolveContainer]);

  useLayoutEffect(() => {
    const container = resolveContainer();
    if (container !== null) container.scrollTop = positions.current[activeView] ?? 0;
    return rememberCurrentScroll;
  }, [activeView, rememberCurrentScroll, resolveContainer]);

  return rememberCurrentScroll;
}

export function WorkspacePanelSkeleton({ label, cards = 4, className }: Readonly<{
  label: string;
  cards?: number;
  className?: string;
}>) {
  const count = Math.max(1, Math.min(cards, 8));
  return <section className={['swworkspaceskeleton', className].filter(Boolean).join(' ')}
    role="status" aria-live="polite" aria-label={label}>
    <header aria-hidden="true"><span /><div /></header>
    <nav aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</nav>
    <div className="swworkspaceskeletoncards" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <i key={index} />)}
    </div>
    <small>{label}</small>
  </section>;
}
