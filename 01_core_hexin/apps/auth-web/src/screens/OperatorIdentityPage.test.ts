// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const registration = vi.hoisted(() => ({
  createChallenge: vi.fn(),
  createMember: vi.fn(),
  resolveInvite: vi.fn(),
}));

const identity = vi.hoisted(() => ({
  currentSession: vi.fn(),
}));

vi.mock('../services/canonicalRegistration', () => ({
  createCanonicalMember: registration.createMember,
  createCanonicalRegistrationChallenge: registration.createChallenge,
  resolveCanonicalInvite: registration.resolveInvite,
}));

vi.mock('../services/canonicalIdentity', () => ({
  createCanonicalPasswordResetChallenge: vi.fn(),
  hasCurrentCanonicalConsoleSession: identity.currentSession,
  loginCanonicalConsole: vi.fn(),
  resetCanonicalPassword: vi.fn(),
}));

vi.mock('./MorviaIdentityShell', () => ({
  MorviaIdentityShell: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

import { OperatorIdentityPage } from './OperatorIdentityPage';

const invitation = Object.freeze({
  termsTitle: '服务协议', termsBody: '条款', privacyTitle: '隐私政策', privacyBody: '隐私', termsHash: 'a'.repeat(64),
  organizationId: 'organization:one', organizationName: '宏泰甄选', target: 'console' as const,
  governanceLevel: 'senior_administrator' as const, effectiveAt: '2026-09-12T00:00:00.000Z', expiresAt: '2026-09-19T00:00:00.000Z',
});

beforeEach(() => {
  window.history.replaceState({}, '', '/?invite=INVITE1234');
  registration.resolveInvite.mockResolvedValue(invitation);
  registration.createChallenge.mockResolvedValue({
    challengeId: 'challenge:one', purpose: 'registration', expiresAt: '2026-09-12T01:00:00.000Z', identityExists: true,
  });
  identity.currentSession.mockResolvedValue(false);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('operator invitation registration', () => {
  it('explains why an existing identity does not receive new password fields', async () => {
    render(React.createElement(OperatorIdentityPage, {
      target: 'console', expectedOrigin: 'https://console.hbbtzn.com', displayName: '宏泰甄选', brand: 'hongtai', onAudienceSwitch: vi.fn(),
    }));
    await waitFor(() => expect(registration.resolveInvite).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '19287247586' } });
    fireEvent.click(screen.getByRole('button', { name: /获取验证码/ }));

    await waitFor(() => expect(screen.getByText(/无需重复设置密码/)).toBeTruthy());
    expect(screen.getByLabelText('管理员姓名')).toBeTruthy();
    expect(screen.queryByLabelText('设置密码')).toBeNull();
    expect(screen.getByPlaceholderText('6 位验证码').getAttribute('autocomplete')).toBe('one-time-code');
  });

  it('clears a login password before another identity flow is opened', () => {
    window.history.replaceState({}, '', '/');
    render(React.createElement(OperatorIdentityPage, {
      target: 'console', expectedOrigin: 'https://console.hbbtzn.com', displayName: '宏泰甄选', brand: 'hongtai', onAudienceSwitch: vi.fn(),
    }));
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'temporary-password' } });
    fireEvent.click(screen.getByRole('tab', { name: '邀请注册' }));
    fireEvent.click(screen.getByRole('tab', { name: '登录' }));
    expect((screen.getByLabelText('密码') as HTMLInputElement).value).toBe('');
  });
});
