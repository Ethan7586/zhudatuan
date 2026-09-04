// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { useStepupViewModel } from '../viewmodel/StepupViewModel';
import { StorefrontStepup } from './StorefrontStepup';

afterEach(cleanup);

describe('StorefrontStepup mobile readiness', () => {
  it('prevents challenge delivery when the account has no bound mobile', () => {
    render(<StorefrontStepup open onClose={vi.fn()} viewmodel={viewmodel()} />);

    expect(screen.getByText('当前账号未绑定手机号，请先在安全中心完成绑定。')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '发送验证码' }).disabled).toBe(true);
  });
});

function viewmodel(): ReturnType<typeof useStepupViewModel> {
  return Object.freeze({ challenge: null, code: '', busy: false, error: null, phoneMasked: null, actions: Object.freeze({ send: vi.fn(() => Promise.resolve()), verify: vi.fn(() => Promise.resolve()), changeCode: vi.fn() }) });
}
