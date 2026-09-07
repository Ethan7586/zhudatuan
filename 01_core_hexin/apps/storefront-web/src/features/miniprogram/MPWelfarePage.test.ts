import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../components/mobile/WeChatCapsule', () => ({
  WeChatCapsule: () => null,
}));

vi.mock('../../context/MallContext', () => ({
  useMall: () => ({
    addToCart: vi.fn(),
    presentationProducts: [],
    sessionStatus: 'guest',
    setMpPage: vi.fn(),
    user: { mealBalance: 0, welfareBalance: 0 },
  }),
}));

import { MPWelfarePage } from './MPWelfarePage';

describe('mini-program welfare landing page', () => {
  it('shows a dedicated welfare destination without pretending a product is the channel', () => {
    const html = renderToStaticMarkup(React.createElement(MPWelfarePage));

    expect(html).toContain('企业福利中心');
    expect(html).toContain('福利卡专区');
    expect(html).toContain('登录后查看');
    expect(html).toContain('福利商品正在同步');
  });
});
