import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../components/mobile/WeChatCapsule', () => ({
  WeChatCapsule: () => null,
}));

vi.mock('./MPProductFeed', () => ({
  MPProductFeed: () => null,
}));

vi.mock('../../context/MallContext', () => ({
  useMall: () => ({
    addToCart: vi.fn(),
    currentMall: { id: 'mall:one', mallName: '宏泰甄选' },
    presentationProducts: [],
    sessionStatus: 'authenticated',
    setMpPage: vi.fn(),
    triggerPendingFeature: vi.fn(),
    user: { mealBalance: 0, welfareBalance: 0 },
  }),
}));

import { HOME_CAMPAIGN_AUTOPLAY_MS, HOME_CAMPAIGN_TRANSITION_MS, MPHomePage } from './MPHomePage';

describe('mini-program home page', () => {
  it('keeps duplicated welfare and meal balances off the home page', () => {
    const html = renderToStaticMarkup(React.createElement(MPHomePage));

    expect(html).not.toContain('福利卡余额');
    expect(html).not.toContain('餐卡专享余额');
  });

  it('gives every campaign carousel control an accessible name and selected state', () => {
    const html = renderToStaticMarkup(React.createElement(MPHomePage));

    expect(html.match(/aria-label="切换到活动：/g)).toHaveLength(4);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(3);
    expect(html).toContain('中秋关怀');
    expect(html).toContain('金秋宏泰');
    expect(html).toContain('双喜临门');
    expect(html).toContain('大武汉礼品');
  });

  it('uses a calm autoplay rhythm and compositor-only campaign transition', () => {
    const html = renderToStaticMarkup(React.createElement(MPHomePage));

    expect(HOME_CAMPAIGN_AUTOPLAY_MS).toBe(5200);
    expect(HOME_CAMPAIGN_TRANSITION_MS).toBe(760);
    expect(html).toContain('transition-[opacity,transform]');
    expect(html).toContain('h-[124px]');
  });
});
