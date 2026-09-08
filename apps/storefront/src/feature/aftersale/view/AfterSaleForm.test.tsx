// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AfterSaleForm } from './AfterSaleForm';

afterEach(cleanup);

describe('AfterSaleForm', () => {
  it('shows only the server line ceiling and never calculates a selected refund in the browser', () => {
    const page = { availableLines: [{ lineId: 'line:1', title: '礼品', available: true, fulfilledQuantity: 2, claimedQuantity: 0, maximumQuantity: 2, expectedRefundMinor: 20_000, requiresReturn: true, unavailableReason: null }], items: [], nextCursor: null };
    const viewmodel = { page, reason: 'damaged', description: '', quantities: { 'line:1': 1 }, attachments: [], selected: [{ lineId: 'line:1', quantity: 1 }], busy: false, actions: { changeQuantity: vi.fn(), changeReason: vi.fn(), changeDescription: vi.fn(), upload: vi.fn(), removeAttachment: vi.fn(), submit: vi.fn() } };
    render(<AfterSaleForm viewmodel={viewmodel as never} />);
    expect(screen.getByText('服务端可退上限 ¥200.00')).toBeTruthy();
    expect(screen.getByText('提交后由服务端确定')).toBeTruthy();
    expect(screen.queryByText('¥100.00')).toBeNull();
  });
});
