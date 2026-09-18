import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../components/mobile/WeChatCapsule', () => ({
  WeChatCapsule: () => null,
}));

vi.mock('../../context/MallContext', () => ({
  useMall: () => ({
    addAddress: vi.fn(),
    addresses: [],
    cart: [{
      id: 'cart:one',
      product: {
        id: 'product:one',
        images: ['https://images.unsplash.com/photo-one?w=600'],
        priceMall: 80,
        priceMarket: 100,
        priceWelfare: 80,
        title: '员工福利礼盒',
      },
      quantity: 1,
      selected: true,
      selectedSpec: {},
    }],
    checkoutSelectedCart: vi.fn(),
    currentMall: { mallName: '福福网' },
    isSubmittingOrder: false,
    removeCartItem: vi.fn(),
    setMpPage: vi.fn(),
    showToast: vi.fn(),
    toggleCartItemSelected: vi.fn(),
    toggleSelectAllCart: vi.fn(),
    triggerPendingFeature: vi.fn(),
    updateCartQuantity: vi.fn(),
    user: { welfareBalance: 500 },
  }),
}));

import { MPCartPage } from './MPCartPage';

describe('mini-program cart experience', () => {
  it('keeps selection and settlement clear while hiding special services by default', () => {
    const html = renderToStaticMarkup(React.createElement(MPCartPage));

    expect(html).toContain('福福网');
    expect(html).toContain('福利卡可用额度');
    expect(html).toContain('管理');
    expect(html).toContain('配送等');
    expect(html).toContain('结算 (1)');
    expect(html).toContain('data-cart-settlement-bar="true"');
    expect(html).not.toContain('添加配送地址');
    expect(html).not.toContain('配送与发票等特殊需求');
    expect(html).not.toContain('配送地址将在结算时确认');
    expect(html).not.toContain('中国建筑集团企采直供仓');
    expect(html).not.toContain('电子发票');
    expect(html).not.toContain('真实账户扣减');
    expect(html).not.toContain('class="fixed');
  });
});
