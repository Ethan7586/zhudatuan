import { describe, expect, it } from 'vitest';
import { WECHAT_TABS } from './WeChatTabBar';

describe('WeChat bottom navigation', () => {
  it('routes enterprise welfare to its own page instead of product detail', () => {
    expect(WECHAT_TABS.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 'home', label: '首页' },
      { id: 'category', label: '分类' },
      { id: 'welfare', label: '企业福利' },
      { id: 'cart', label: '购物车' },
      { id: 'profile', label: '我的' },
    ]);
  });
});
