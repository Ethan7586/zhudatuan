import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PaymentRecoverySurface, PaymentStableCarrier, paymentExperienceFailureKind } from './PaymentExperienceBoundary';

describe('payment experience boundary', () => {
  it('recognizes stale dynamic-import failures as an asset recovery event', () => {
    const failure = new Error('Failed to fetch dynamically imported module: /assets/PaymentResultPage-old.js');
    expect(paymentExperienceFailureKind(failure)).toBe('asset');
    expect(paymentExperienceFailureKind(Object.assign(new Error('chunk unavailable'), { name: 'ChunkLoadError' }))).toBe('asset');
    expect(paymentExperienceFailureKind(new Error('render exploded'))).toBe('render');
  });

  it('renders a stable payment recovery surface without internal identifiers', () => {
    const html = renderToStaticMarkup(React.createElement(PaymentRecoverySurface, {
      kind: 'asset', onRecover: vi.fn(), onViewOrders: vi.fn(),
    }));
    expect(html).toContain('data-payment-recovery-surface="true"');
    expect(html).toContain('支付状态仍可恢复');
    expect(html).toContain('订单已经保留');
    expect(html).toContain('恢复支付状态');
    expect(html).not.toContain('paymentId');
    expect(html).not.toContain('服务端权威');
  });

  it('renders the amount and current state before the detailed payment bundle arrives', () => {
    const html = renderToStaticMarkup(React.createElement(PaymentStableCarrier, { session: {
      schema: 'storefront.payment-recovery.v1', scope: 'member:one:mall:one', orderId: 'order:one', paymentId: null,
      amountMinor: 46644, currency: 'CNY', mallName: '宏泰甄选', createdAt: '2026-09-09T05:00:00.000Z', updatedAt: '2026-09-09T05:00:00.000Z',
      idempotencyKey: 'checkout:one', cartFingerprint: 'cart:one', cartItemIds: ['cart:one'], stage: 'verifying', retryCount: 0,
    } }));
    expect(html).toContain('data-payment-stable-carrier="true"');
    expect(html).toContain('正在确认到账');
    expect(html).toContain('¥466.44');
  });
});
