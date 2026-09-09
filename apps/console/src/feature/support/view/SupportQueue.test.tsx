import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Agent } from '../model/Agent';
import { SupportFilters } from './SupportFilters';
import { SupportQueue } from './SupportQueue';

afterEach(cleanup);

const agents: readonly Agent[] = [
  { id: 'agent:one', membershipId: 'membership:one', displayName: '王客服', skills: ['general'], capacity: 10, state: 'available', version: 2 },
];

describe('support queue filters', () => {
  it('keeps frequent choices visible and progressively discloses advanced filters', () => {
    const onFilter = vi.fn();
    render(<SupportFilters filter={{}} agents={agents} onFilter={onFilter} onReset={vi.fn()} />);

    expect(screen.getByLabelText('搜索工单')).toBeTruthy();
    expect(screen.getByLabelText('状态')).toBeTruthy();
    expect(screen.getByLabelText('优先级')).toBeTruthy();
    const details = screen.getByText('更多筛选').closest('details');
    expect(details?.open).toBe(false);

    fireEvent.click(screen.getByText('更多筛选'));
    expect(details?.open).toBe(true);
    expect(screen.getByRole('option', { name: '王客服' })).toBeTruthy();
    expect(screen.queryByText(/membership:one|agent:one|客服编号/)).toBeNull();
    fireEvent.change(screen.getByLabelText('负责客服'), { target: { value: 'agent:one' } });
    expect(onFilter).toHaveBeenCalledWith('agentId', 'agent:one');
  });

  it('summarizes active advanced filters and clears them in one action', () => {
    const onReset = vi.fn();
    render(<SupportFilters filter={{ skill: 'general', unread: true }} agents={agents} onFilter={vi.fn()} onReset={onReset} />);

    expect(screen.getByText('2 项已启用')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '清除更多筛选' }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('does not duplicate the page-level refresh action inside the queue', () => {
    render(
      <SupportQueue
        tickets={[]}
        agents={agents}
        filter={{}}
        condition="ready"
        onFilter={vi.fn()}
        onNext={vi.fn()}
        onRetry={vi.fn()}
        onReset={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /刷新/ })).toBeNull();
  });
});
