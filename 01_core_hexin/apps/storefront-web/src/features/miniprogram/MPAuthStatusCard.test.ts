import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_GUEST_PROFILE } from '../../context/productionStorefrontState';
import {
  AUTH_WELCOME_COLLAPSE_MS,
  AUTH_WELCOME_EXIT_MS,
  AUTH_WELCOME_FADE_MS,
  AUTH_WELCOME_HOLD_MS,
  MPAuthStatusCard,
} from './MPAuthStatusCard';

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
  it('shows a graphical fixed-height recovery state without flashing blunt copy or the login action', () => {
    const html = render('checking');

    expect(html).toContain('data-auth-shell="checking"');
    expect(html).toContain('data-auth-loader="visual"');
    expect(html).not.toContain('正在恢复登录状态');
    expect(html).not.toContain('商城内容已就绪');
    expect(html).toContain('h-[68px]');
    expect(html).not.toContain('使用手机号登录智慧翼账户');
  });

  it('keeps the same geometry for guest and authenticated states', () => {
    const guest = render('guest');
    const authenticated = render('authenticated');

    expect(guest).toContain('h-[68px]');
    expect(authenticated).toContain('h-[68px]');
    expect(guest).toContain('手机号登录');
    expect(authenticated).toContain('Ethan，欢迎回来');
    expect(authenticated).toContain('很高兴再次见到你');
    expect(authenticated).toContain('transition-[height,padding-bottom]');
    expect(authenticated).toContain('h-20');
    expect(authenticated).toContain('查看Ethan的会员账户');
    expect(authenticated).toContain('data-auth-phase="visible"');
    expect(authenticated).not.toContain('退出会员登录');
  });

  it('uses a complete breathe, fade, then collapse welcome rhythm', () => {
    expect(AUTH_WELCOME_HOLD_MS).toBe(2200);
    expect(AUTH_WELCOME_FADE_MS).toBe(720);
    expect(AUTH_WELCOME_COLLAPSE_MS).toBe(520);
    expect(AUTH_WELCOME_EXIT_MS).toBe(1240);
  });
});
