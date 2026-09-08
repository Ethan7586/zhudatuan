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

import {
  HOME_CAMPAIGN_AUTOPLAY_MS,
  HOME_CAMPAIGN_INTERACTION_PAUSE_MS,
  HOME_CAMPAIGN_TRANSITION_MS,
  homeCampaignIndexForScroll,
  MPHomePage,
} from './MPHomePage';

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

  it('uses a calm native swipe track and pauses autoplay after interaction', () => {
    const html = renderToStaticMarkup(React.createElement(MPHomePage));

    expect(HOME_CAMPAIGN_AUTOPLAY_MS).toBe(5200);
    expect(HOME_CAMPAIGN_INTERACTION_PAUSE_MS).toBe(9000);
    expect(HOME_CAMPAIGN_TRANSITION_MS).toBe(760);
    expect(html).toContain('data-home-campaign-track');
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('snap-x snap-mandatory');
    expect(html.match(/snap-center snap-always overflow-hidden/g)).toHaveLength(4);
    expect(html).toContain('scroll-smooth');
    expect(html).toContain('h-[124px]');
  });

  it('settles manual movement on the nearest campaign page', () => {
    expect(homeCampaignIndexForScroll(0, 360)).toBe(0);
    expect(homeCampaignIndexForScroll(190, 360)).toBe(1);
    expect(homeCampaignIndexForScroll(725, 360)).toBe(2);
    expect(homeCampaignIndexForScroll(5000, 360)).toBe(3);
    expect(homeCampaignIndexForScroll(100, 0)).toBe(0);
  });
});
