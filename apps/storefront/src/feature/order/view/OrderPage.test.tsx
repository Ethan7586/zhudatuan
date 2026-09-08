// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderPage } from './OrderPage';

afterEach(cleanup);

describe('OrderPage', () => {
  it('does not disguise a failed order read as an empty order list', () => {
    const viewmodel = { listState: 'failed', listError: '订单服务暂时不可用', visibleOrders: [], status: 'all', refreshList: vi.fn(), actions: { invoices: vi.fn(), filter: vi.fn() } };
    render(<OrderPage viewmodel={viewmodel as never} />);
    expect(screen.getByText('订单服务暂时不可用')).toBeTruthy();
    expect(screen.queryByText('当前筛选下暂无订单')).toBeNull();
  });
});
