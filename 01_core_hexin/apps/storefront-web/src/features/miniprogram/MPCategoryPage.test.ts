import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const catalogState = vi.hoisted(() => ({
  categories: [] as Array<Record<string, unknown>>,
  products: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../context/MallContext', () => ({
  useMall: () => ({
    addToCart: vi.fn(),
    currentMall: { id: 'mall:one', mallName: '宏泰甄选' },
    malls: [],
    presentationCategories: catalogState.categories,
    presentationProducts: catalogState.products,
    setMpPage: vi.fn(),
    switchMall: vi.fn(),
    triggerPendingFeature: vi.fn(),
  }),
}));

import { MPCategoryPage } from './MPCategoryPage';

describe('mini-program category page', () => {
  beforeEach(() => {
    catalogState.categories = [];
    catalogState.products = [];
  });

  it('renders a stable Chinese loading state while the catalog is empty', () => {
    const html = renderToStaticMarkup(React.createElement(MPCategoryPage));
    expect(html).toContain('商品分类正在同步');
    expect(html).toContain('无需刷新整个页面');
  });

  it('uses the compact cart visual language for category browsing', () => {
    catalogState.categories = [{
      hotKeywords: ['主打团货盘'],
      id: 'cat_all',
      name: '全部商品',
      subCategories: [{ id: 'sub:one', name: '米面粮油' }],
    }];
    catalogState.products = [{
      categoryId: 'cat_all',
      enterpriseSubsidyAmount: 20,
      id: 'product:one',
      imageUrl: 'https://images.unsplash.com/product-one',
      originalPrice: 120,
      price: 100,
      subtitle: '企业严选',
      title: '员工福利礼盒',
    }];

    const html = renderToStaticMarkup(React.createElement(MPCategoryPage));

    expect(html).toContain('当前分类');
    expect(html).toContain('福利卡可用');
    expect(html).toContain('员工福利礼盒');
    expect(html).toContain('加入购物车：员工福利礼盒');
    expect(html).not.toContain('<nav aria-label="商品分类"');
    expect(html).not.toContain('热搜:');
    expect(html).not.toContain('全额包邮');
  });

  it('keeps empty business categories visible beside the stocked welfare category', () => {
    catalogState.categories = [
      { hotKeywords: [], id: 'cat_welfare_zone', name: '福利品', subCategories: [] },
      { hotKeywords: [], id: 'cat_appliance', name: '家用电器', subCategories: [] },
    ];
    catalogState.products = [{
      categoryId: 'cat_welfare_zone',
      enterpriseSubsidyAmount: 0,
      id: 'product:rice',
      imageUrl: 'https://images.unsplash.com/rice',
      originalPrice: 1,
      price: 0.01,
      subtitle: '企业福利',
      title: '主打团货盘',
    }];

    const html = renderToStaticMarkup(React.createElement(MPCategoryPage));

    expect(html).toContain('<nav aria-label="商品分类"');
    expect(html).toContain('福利品');
    expect(html).toContain('家用电器');
    expect(html).toContain('主打团货盘');
  });
});
