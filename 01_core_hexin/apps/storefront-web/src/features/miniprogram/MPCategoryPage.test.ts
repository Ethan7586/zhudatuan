import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../context/MallContext', () => ({
  useMall: () => ({
    addToCart: vi.fn(),
    currentMall: { id: 'mall:one', mallName: '宏泰甄选' },
    malls: [],
    presentationCategories: [],
    presentationProducts: [],
    setMpPage: vi.fn(),
    switchMall: vi.fn(),
    triggerPendingFeature: vi.fn(),
  }),
}));

import { MPCategoryPage } from './MPCategoryPage';

describe('mini-program category page', () => {
  it('renders a stable Chinese loading state while the catalog is empty', () => {
    const html = renderToStaticMarkup(React.createElement(MPCategoryPage));
    expect(html).toContain('商品分类正在同步');
    expect(html).toContain('无需刷新整个页面');
  });
});
