// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useCallback, useRef, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  pageExperienceBudget,
  StableWorkspaceTabs,
  useViewScrollMemory,
  WorkspacePanelSkeleton,
} from './PageExperience';

afterEach(cleanup);

describe('page experience foundation', () => {
  it('publishes the UIX-PERF response budgets', () => {
    expect(pageExperienceBudget).toEqual({
      interactionFeedbackMs: 100,
      stableShellMs: 200,
      warmInteractiveMs: 300,
      coldPrimaryDataTargetMs: 500,
      coldPrimaryDataInvestigationMs: 1000,
      interactionToNextPaintP75Ms: 200,
      routeCumulativeLayoutShift: 0.05,
    });
  });

  it('uses a stable tab list with an animated active index', () => {
    render(<StableWorkspaceTabs activeIndex={1} label="页面">
      <button type="button">甲</button><button type="button" aria-current="page">乙</button>
    </StableWorkspaceTabs>);
    const tabs = screen.getByRole('navigation', { name: '页面' });
    expect(tabs.style.getPropertyValue('--sw-stable-tabs-active')).toBe('1');
    expect(tabs.style.getPropertyValue('--sw-stable-tabs-count')).toBe('2');
  });

  it('preserves each view scroll position', () => {
    render(<ScrollFixture />);
    const container = screen.getByTestId('scroll-container');
    container.scrollTop = 120;
    fireEvent.click(screen.getByRole('button', { name: '乙' }));
    expect(container.scrollTop).toBe(0);
    container.scrollTop = 260;
    fireEvent.click(screen.getByRole('button', { name: '甲' }));
    expect(container.scrollTop).toBe(120);
  });

  it('renders a target-shaped local skeleton with an honest label', () => {
    render(<WorkspacePanelSkeleton label="正在准备商品主数据…" cards={3} />);
    expect(screen.getByRole('status', { name: '正在准备商品主数据…' })).toBeTruthy();
    expect(document.querySelectorAll('.swworkspaceskeletoncards i')).toHaveLength(3);
  });
});

function ScrollFixture() {
  const [view, setView] = useState<'a' | 'b'>('a');
  const containerRef = useRef<HTMLDivElement>(null);
  const resolveContainer = useCallback(() => containerRef.current, []);
  const remember = useViewScrollMemory(view, resolveContainer);
  const select = (next: 'a' | 'b') => { remember(); setView(next); };
  return <div ref={containerRef} data-testid="scroll-container">
    <button type="button" onClick={() => select('a')}>甲</button>
    <button type="button" onClick={() => select('b')}>乙</button>
  </div>;
}
