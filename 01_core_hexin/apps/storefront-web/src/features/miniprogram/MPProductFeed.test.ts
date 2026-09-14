import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../context/MallContext', () => ({
  useMall: () => ({
    addToCart: vi.fn(),
    presentationProducts: [{
      id: 'product:one',
      imageUrl: '/product.webp',
      itemType: 'physical',
      originalPrice: 1,
      price: 0.01,
      subtitle: '商城闭环验证商品',
      title: '主打团货盘',
    }],
    setMpPage: vi.fn(),
  }),
}));

import { MPProductFeed } from './MPProductFeed';

describe('mini-program product feed', () => {
  it('names the icon-only add-to-cart action with its product', () => {
    const html = renderToStaticMarkup(React.createElement(MPProductFeed));

    expect(html).toContain('aria-label="加入购物车：主打团货盘"');
    expect(html).not.toContain('rounded-');
    expect(html).not.toContain('active:scale');
  });
});
