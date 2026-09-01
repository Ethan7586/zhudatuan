// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider, type SessionState } from '../../../shared/runtime/SessionContext';
import { StorefrontStepup } from './StorefrontStepup';

vi.mock('../infrastructure/StepupGateway', () => ({
  StepupGateway: {
    phoneMasked: vi.fn(async () => null),
    start: vi.fn(),
    complete: vi.fn(),
  },
}));

afterEach(cleanup);

describe('StorefrontStepup mobile readiness', () => {
  it('prevents challenge delivery when the account has no bound mobile', async () => {
    render(
      <SessionProvider value={session()}>
        <StorefrontStepup open onClose={vi.fn()} onVerified={vi.fn()} />
      </SessionProvider>
    );

    expect(await screen.findByText('当前账号未绑定手机号，请先在安全中心完成绑定。')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '发送验证码' }).disabled).toBe(true);
  });
});

function session(): SessionState {
  return {
    status: 'authenticated',
    session: { membership: 'membership:one', scope: { kind: 'mall', id: 'mall:one' }, accessVersion: 1, csrfToken: 'csrf-token-from-session' },
    scope: 'mall:one',
    entry: { handle: 'test', url: 'https://fufu.wang/s/test' },
    navigation: [],
    toasts: [],
    showToast: vi.fn(),
    removeToast: vi.fn(),
    logout: vi.fn(async () => undefined),
  };
}
