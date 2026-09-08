import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mall = vi.hoisted(() => ({
  user: {
    id: 'guest',
    name: '访客',
    avatar: '',
    enterpriseName: '尚未连接企业',
    jobTitle: '访客',
    phone: '未绑定',
    phoneVerified: false,
    welfareBalance: 0,
    mealBalance: 0,
  },
  currentMall: { id: 'mall:test', mallName: '测试商城' },
  sessionStatus: 'guest',
  logout: vi.fn(),
  presentationOrders: [],
  mobileFulfillmentSimulationStage: null,
  triggerPendingFeature: vi.fn(),
  setMpPage: vi.fn(),
}));

vi.mock('../../context/MallContext', () => ({ useMall: () => mall }));

import { MPProfilePage } from './MPProfilePage';

describe('mini-program profile order shortcuts', () => {
  it('keeps the original four order icons in the personal center', () => {
    const html = renderToStaticMarkup(React.createElement(MPProfilePage));

    expect(html).toContain('lucide-clock');
    expect(html).toContain('lucide-truck');
    expect(html).toContain('lucide-circle-check');
    expect(html).toContain('lucide-circle-question-mark');
    expect(html).toContain('rounded-full bg-amber-50');
  });
});
