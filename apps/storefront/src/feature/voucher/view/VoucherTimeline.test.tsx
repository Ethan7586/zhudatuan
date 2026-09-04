// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoucherTimeline } from './VoucherTimeline';

afterEach(cleanup);

describe('VoucherTimeline', () => {
  it('preserves real redemption, partial refund, order navigation and pagination', () => {
    const more = vi.fn();
    const openOrder = vi.fn();
    render(<MemoryRouter><VoucherTimeline state="ready" hasMore loadingMore={false} onMore={more} onRetry={vi.fn()} onOpenOrder={openOrder} items={[
      { sequence: 3, previous: 'held', next: 'active', reason: 'holdconsume', occurredAt: '2026-09-05T00:00:00.000Z',
        redemption: { id: 'redemption:one', order: 'order:one', amountMinor: 400, refundedMinor: 100, currency: 'CNY', state: 'partiallyrefunded', redeemedAt: '2026-09-05T00:00:00.000Z' } },
    ]} /></MemoryRouter>);
    expect(screen.getByText('核销 ¥4.00')).toBeTruthy();
    expect(screen.getByText('部分退款 · 已退款 ¥1.00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /查看订单/ }));
    expect(openOrder).toHaveBeenCalledWith('order:one');
    fireEvent.click(screen.getByRole('button', { name: '加载更多记录' }));
    expect(more).toHaveBeenCalledOnce();
  });

  it('keeps empty results still and errors retryable', () => {
    const retry = vi.fn();
    const view = render(<VoucherTimeline items={[]} state="ready" hasMore={false} loadingMore={false} onMore={vi.fn()} onRetry={retry} onOpenOrder={vi.fn()} />);
    expect(screen.getByText('暂无核销或状态动态')).toBeTruthy();
    expect(view.container.querySelector('.animate-spin')).toBeNull();
    view.rerender(<VoucherTimeline items={[]} state="failed" hasMore={false} loadingMore={false} onMore={vi.fn()} onRetry={retry} onOpenOrder={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '重试记录' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('does not render internal actor IDs or free-form technical reason codes', () => {
    render(<VoucherTimeline items={[{ sequence: 1, previous: null, next: 'bound', reason: 'fulfillment:internal:token', occurredAt: '2026-09-05T00:00:00.000Z', redemption: null }]}
      state="ready" hasMore={false} loadingMore={false} onMore={vi.fn()} onRetry={vi.fn()} onOpenOrder={vi.fn()} />);
    expect(screen.queryByText(/fulfillment:internal/)).toBeNull();
    expect(screen.getByText(/卡券状态已更新/)).toBeTruthy();
  });
});
