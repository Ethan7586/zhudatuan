import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./WeChatTabBar', () => ({ WeChatTabBar: () => null }));
vi.mock('../../features/miniprogram/MPHomePage', () => ({ MPHomePage: () => null }));
vi.mock('../../services/productionApi', async (loadOriginal) => {
  const original = await loadOriginal<typeof import('../../services/productionApi')>();
  return { ...original, productionApi: { ...original.productionApi, readPaymentResult: vi.fn() } };
});
vi.mock('../../context/MallContext', () => ({
  useMall: () => ({
    activePaymentId: 'payment:recoverable',
    activePaymentSession: {
      schema: 'storefront.payment-recovery.v1', scope: 'member:one:mall:one', orderId: 'order:one', paymentId: 'payment:recoverable',
      amountMinor: 100, currency: 'CNY', mallName: '宏泰甄选', createdAt: '2026-09-09T05:00:00.000Z', updatedAt: '2026-09-09T05:00:00.000Z',
      idempotencyKey: 'checkout:one', cartFingerprint: 'cart:one', cartItemIds: ['cart:one'], stage: 'verifying', retryCount: 0,
    },
    closePaymentResult: vi.fn(),
    mpPage: 'cart',
    navigateTo: vi.fn(),
    pendingFeature: { isOpen: false },
    setAndroidPage: vi.fn(),
    setLaptopPage: vi.fn(),
    setMpPage: vi.fn(),
    setTabletPage: vi.fn(),
    toasts: [],
  }),
}));

import { ProductionMobileFrame } from './ProductionMobileFrame';

describe('production mobile payment shell', () => {
  it('renders the payment carrier synchronously without a lazy-page placeholder', () => {
    const html = renderToStaticMarkup(React.createElement(ProductionMobileFrame));
    expect(html).toContain('data-storefront-mobile-page="payment-result"');
    expect(html).toContain('正在确认到账');
    expect(html).not.toContain('页面准备中');
  });
});
