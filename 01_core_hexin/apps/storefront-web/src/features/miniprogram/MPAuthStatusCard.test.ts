// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, fireEvent, render as renderDom } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_GUEST_PROFILE } from '../../context/productionStorefrontState';
import {
  AUTH_LOGIN_TRANSITION_MS,
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

function renderMarkup(status: 'checking' | 'guest' | 'authenticated') {
  return renderToStaticMarkup(React.createElement(MPAuthStatusCard, {
    authHref: 'https://accounts.fufuwang.com.cn/',
    sessionStatus: status,
    user: member,
  }));
}

function renderCardDom(status: 'checking' | 'guest' | 'authenticated') {
  return renderDom(React.createElement(MPAuthStatusCard, {
    authHref: 'https://accounts.fufuwang.com.cn/',
    sessionStatus: status,
    user: member,
  }));
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('mini-program authentication shell', () => {
  it('shows a graphical fixed-height recovery state without flashing blunt copy or the login action', () => {
    const html = renderMarkup('checking');

    expect(html).toContain('data-auth-shell="checking"');
    expect(html).toContain('data-auth-loader="visual"');
    expect(html).toContain('data-auth-loader-style="frost-dew"');
    expect(html).toContain('sw-auth-frost-dew-ring');
    expect(html).toContain('sw-auth-frost-dew-orb');
    expect(html).not.toContain('sw-auth-loader-dot');
    expect(html).not.toContain('正在恢复登录状态');
    expect(html).not.toContain('商城内容已就绪');
    expect(html).toContain('h-[68px]');
    expect(html).not.toContain('使用手机号登录智慧翼账户');
  });

  it('shows a recoverable network state without exposing the login action', () => {
    const onRetry = vi.fn();
    const { container, getByText, queryByText } = renderDom(React.createElement(MPAuthStatusCard, {
      authHref: 'https://accounts.fufuwang.com.cn/',
      onRetry,
      sessionError: '网络波动，请点击重试',
      sessionStatus: 'checking',
      user: member,
    }));

    expect(container.querySelector('[data-auth-shell]')?.getAttribute('data-auth-shell')).toBe('checking');
    expect(queryByText('网络波动，请点击重试')).toBeTruthy();
    expect(container.querySelector('[data-auth-action="login"]')).toBeNull();
    fireEvent.click(getByText('重试'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps the same geometry for guest and authenticated states', () => {
    const guest = renderMarkup('guest');
    const authenticated = renderMarkup('authenticated');

    expect(guest).toContain('h-[68px]');
    expect(authenticated).toContain('h-[68px]');
    expect(guest).toContain('轻轻一点，恰逢所喜。');
    expect(guest).toContain('data-auth-action="login"');
    expect(guest).not.toContain('手机号登录');
    expect(guest).not.toContain('登录后查看会员身份、订单与支付');
    expect(authenticated).toContain('欢迎 Ethan 回来');
    expect(authenticated).not.toContain('很高兴再次见到你');
    expect(authenticated).not.toContain('查看账户');
    expect(authenticated).toContain('transition-[height,padding-bottom]');
    expect(authenticated).toContain('h-20');
    expect(authenticated).toContain('data-auth-phase="visible"');
    expect(authenticated).not.toContain('退出会员登录');
  });

  it('uses a complete breathe, fade, then collapse welcome rhythm', () => {
    expect(AUTH_LOGIN_TRANSITION_MS).toBe(420);
    expect(AUTH_WELCOME_HOLD_MS).toBe(2200);
    expect(AUTH_WELCOME_FADE_MS).toBe(720);
    expect(AUTH_WELCOME_COLLAPSE_MS).toBe(520);
    expect(AUTH_WELCOME_EXIT_MS).toBe(1240);
  });

  it('crossfades the invitation into frost dew before opening login', () => {
    const { container, getByText } = renderCardDom('guest');

    fireEvent.click(getByText('轻轻一点，恰逢所喜。'));

    const action = container.querySelector('[data-auth-action="login"]');
    const shell = container.querySelector('[data-auth-shell]');
    const prompt = container.querySelector('[data-auth-prompt="login"]');
    const frostDew = container.querySelector('[data-auth-loader-style="frost-dew"]');

    expect(action?.getAttribute('data-auth-state')).toBe('entering');
    expect(action?.getAttribute('aria-busy')).toBe('true');
    expect(shell?.getAttribute('data-auth-shell')).toBe('checking');
    expect(prompt?.className).toContain('opacity-0');
    expect(frostDew?.parentElement?.className).toContain('opacity-100');
  });

  it('restores the invitation when the user returns from login', () => {
    const { container, getByText } = renderCardDom('guest');

    fireEvent.click(getByText('轻轻一点，恰逢所喜。'));
    fireEvent(window, new Event('pageshow'));

    const action = container.querySelector('[data-auth-action="login"]');
    const prompt = container.querySelector('[data-auth-prompt="login"]');

    expect(action?.getAttribute('data-auth-state')).toBe('idle');
    expect(action?.hasAttribute('aria-busy')).toBe(false);
    expect(prompt?.className).toContain('opacity-100');
  });

  it('welcomes the member, then fades and collapses the whole card upward', () => {
    vi.useFakeTimers();
    const { container, getByText } = renderCardDom('authenticated');

    expect(getByText('欢迎 Ethan 回来')).toBeTruthy();
    expect(container.querySelector('[data-auth-phase]')?.getAttribute('data-auth-phase')).toBe('visible');

    act(() => vi.advanceTimersByTime(AUTH_WELCOME_HOLD_MS));
    expect(container.querySelector('[data-auth-phase]')?.getAttribute('data-auth-phase')).toBe('fading');

    act(() => vi.advanceTimersByTime(AUTH_WELCOME_FADE_MS));
    const collapsingShell = container.querySelector('[data-auth-phase="collapsing"]');
    expect(collapsingShell?.className).toContain('h-0');

    act(() => vi.advanceTimersByTime(AUTH_WELCOME_COLLAPSE_MS));
    expect(container.querySelector('[data-auth-shell]')).toBeNull();
  });
});
