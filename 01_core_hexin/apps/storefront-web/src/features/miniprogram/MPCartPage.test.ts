import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../components/mobile/WeChatCapsule', () => ({
  WeChatCapsule: () => null,
}));

vi.mock('../../context/MallContext', () => ({
  useMall: () => ({
    addresses: [],
    cart: [{
      id: 'cart:one',
      product: {
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
    currentMall: { mallName: '宏泰甄选' },
    isSubmittingOrder: false,
    removeCartItem: vi.fn(),
    setMpPage: vi.fn(),
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

    expect(html).toContain('宏泰甄选');
    expect(html).toContain('添加配送地址');
    expect(html).toContain('更多结算服务');
    expect(html).toContain('去结算 (1)');
    expect(html).toContain('data-cart-settlement-bar="true"');
    expect(html).not.toContain('中国建筑集团企采直供仓');
    expect(html).not.toContain('电子发票');
    expect(html).not.toContain('真实账户扣减');
    expect(html).not.toContain('class="fixed');
  });
});
