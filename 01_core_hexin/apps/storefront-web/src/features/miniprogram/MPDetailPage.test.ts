import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../components/mobile/WeChatCapsule', () => ({
  WeChatCapsule: () => null,
}));

vi.mock('../../components/mobile/WeChatTabBar', () => ({
  WeChatTabBar: () => null,
}));

vi.mock('../../context/MallContext', () => ({
  useMall: () => ({
    addToCart: vi.fn(),
    cartCount: 0,
    mobileProductId: 'product:one',
    presentationProducts: [{
      brand: '主打团',
      enterpriseSubsidyAmount: 0,
      gallery: [],
      id: 'product:one',
      imageUrl: '/product.webp',
      itemType: 'physical',
      originalPrice: 1,
      price: 0.01,
      specOptions: {},
      stockCount: 1,
      subtitle: '商城闭环验证商品',
      title: '主打团货盘',
    }],
    setMpPage: vi.fn(),
    triggerPendingFeature: vi.fn(),
  }),
}));

import { MPDetailPage } from './MPDetailPage';

describe('mini-program product detail', () => {
  it('names the share and favorite icon actions for the current product', () => {
    const html = renderToStaticMarkup(React.createElement(MPDetailPage));

    expect(html).toContain('aria-label="分享商品：主打团货盘"');
    expect(html).toContain('aria-label="收藏：主打团货盘"');
    expect(html).toContain('aria-pressed="false"');
  });
});
