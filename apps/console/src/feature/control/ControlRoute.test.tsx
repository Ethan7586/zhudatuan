import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Component } from './ControlRoute';

describe('Merchant management preview', () => {
  it('renders the approved presentation without exposing unfinished writes', () => {
    render(<Component />);

    expect(screen.getByRole('heading', { level: 1, name: '商家管理' })).toBeTruthy();
    expect(screen.getByText('共享业务逻辑')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '标准开通路径' })).toBeTruthy();
    expect(screen.getByText('商家身份')).toBeTruthy();
    expect(screen.getByText('默认商城')).toBeTruthy();
    expect(screen.getByText('微信生态')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '商家目录' })).toBeTruthy();
    expect(screen.getByText('L0 ～ L11')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('不读取商家数据');
    expect(screen.getByRole('button', { name: '开通商家' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: '开通第一个商家' }).hasAttribute('disabled')).toBe(true);
  });
});
