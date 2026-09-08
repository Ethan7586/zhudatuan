// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage, type LoginPageProps } from '../../src/feature/login/view/LoginPage';
import { bootstrap } from '../TestData';

describe('small-screen login journey', () => {
  it('keeps target, method, credential, recovery, registration and policy actions available at 375px', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    render(<LoginPage {...props()} />);

    expect(screen.getByRole('radiogroup', { name: '登录后进入' })).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('tablist', { name: '登录方式' })).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.queryByRole('tab', { name: '邀请码登录' })).toBeNull();
    expect(screen.getByLabelText(/登录账号或已绑定手机号/)).toBeTruthy();
    expect(screen.getByLabelText(/^密码$/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '忘记密码？' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '新用户注册' })).toBeTruthy();
    expect(screen.getByRole('checkbox')).toBeTruthy();
    expect(screen.getByRole('button', { name: /服务协议/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /隐私政策/ })).toBeTruthy();
  });
});

function props(): LoginPageProps {
  return {
    bootstrap,
    target: 'storefront',
    method: 'password',
    accepted: false,
    busy: false,
    fields: {},
    providers: Object.freeze({ credentials: Object.freeze(['password', 'otp'] as const), federations: Object.freeze([]) }),
    providersLoading: false,
    onMethod: vi.fn(),
    onTarget: vi.fn(),
    onAccepted: vi.fn(),
    onPassword: vi.fn(),
    onOtp: vi.fn(),
    onChallenge: vi.fn(),
    onRegister: vi.fn(),
    onProvider: vi.fn(),
    onProviderRetry: vi.fn(),
    onBack: vi.fn(),
    onReset: vi.fn(),
  };
}
