// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderPage } from './OrderPage';

afterEach(cleanup);

describe('OrderPage', () => {
  it('does not disguise a failed order read as an empty order list', () => {
    const viewmodel = { listState: 'failed', listError: '订单服务暂时不可用', visibleOrders: [], status: 'all', refreshList: vi.fn(), actions: { invoices: vi.fn(), aftersales: vi.fn(), filter: vi.fn() } };
    render(<OrderPage viewmodel={viewmodel as never} />);
    expect(screen.getByText('订单服务暂时不可用')).toBeTruthy();
    expect(screen.queryByText('当前筛选下暂无订单')).toBeNull();
  });

  it('uses the approved beginner-facing order hierarchy without exposing the order number', () => {
    const open = vi.fn();
    const aftersale = vi.fn();
    const viewmodel = {
      listState: 'ready',
      listError: null,
      visibleOrders: [
        {
          id: 'order:one',
          orderNo: 'SW20260910000001',
          mallName: '智慧翼自营',
          status: 'pending_receipt',
          paymentState: 'paid',
          totalMinor: 6990,
          lines: [{ id: 'line:one', title: '蒙牛纯牛奶 250mL×16盒', image: '/products/milk.webp', quantity: 1, payableMinor: 6990 }],
        },
      ],
      status: 'all',
      refreshList: vi.fn(),
      actions: { invoices: vi.fn(), aftersales: vi.fn(), filter: vi.fn(), open, aftersale },
    };

    render(<OrderPage viewmodel={viewmodel as never} />);

    expect(screen.getByRole('navigation', { name: '订单状态筛选' })).toBeTruthy();
    expect(screen.getByRole('img', { name: '蒙牛纯牛奶 250mL×16盒' })).toBeTruthy();
    expect(screen.getByText('智慧翼自营')).toBeTruthy();
    expect(screen.queryByText('SW20260910000001')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '查看物流' }));
    fireEvent.click(screen.getByRole('button', { name: '申请售后' }));
    expect(open).toHaveBeenCalledExactlyOnceWith('order:one');
    expect(aftersale).toHaveBeenCalledExactlyOnceWith('order:one');
  });
});
