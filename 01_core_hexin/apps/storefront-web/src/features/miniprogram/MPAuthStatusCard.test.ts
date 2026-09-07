import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_GUEST_PROFILE } from '../../context/productionStorefrontState';
import { MPAuthStatusCard } from './MPAuthStatusCard';

const member = {
  ...EMPTY_GUEST_PROFILE,
  id: 'member:one',
  name: 'Ethan',
  enterpriseName: '已授权企业',
};

function render(status: 'checking' | 'guest' | 'authenticated') {
  return renderToStaticMarkup(React.createElement(MPAuthStatusCard, {
    authHref: 'https://accounts.hbbtzn.com/',
    sessionStatus: status,
    user: member,
    onOpenProfile: vi.fn(),
  }));
}

describe('mini-program authentication shell', () => {
  it('shows an honest fixed-height recovery state without flashing the login action', () => {
    const html = render('checking');

    expect(html).toContain('data-auth-shell="checking"');
    expect(html).toContain('正在恢复登录状态');
    expect(html).toContain('h-[68px]');
    expect(html).not.toContain('使用手机号登录智慧翼账户');
  });

  it('keeps the same geometry for guest and authenticated states', () => {
    const guest = render('guest');
    const authenticated = render('authenticated');

    expect(guest).toContain('h-[68px]');
    expect(authenticated).toContain('h-[68px]');
    expect(guest).toContain('手机号登录');
    expect(authenticated).toContain('欢迎回来，Ethan');
    expect(authenticated).toContain('查看Ethan的会员账户');
    expect(authenticated).not.toContain('退出会员登录');
  });
});
