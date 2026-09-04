import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StepupViewModel } from '../viewmodel/StepupViewModel';
import { StepupDialog } from './StepupDialog';

afterEach(cleanup);

describe('StepupDialog mobile readiness', () => {
  it('explains an unbound mobile and prevents sending a challenge', () => {
    render(<StepupDialog model={model({ phoneMasked: null })} />);

    expect(screen.getByText('当前账号未绑定手机号，暂时无法开启二次验证。')).toBeTruthy();
    expect(screen.getByText('请先在员工商城安全中心绑定手机号，再开启二次验证。')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '发送验证码' }).disabled).toBe(true);
  });

  it('shows the masked destination before a challenge is sent', () => {
    render(<StepupDialog model={model({ phoneMasked: '138****0000' })} />);

    expect(screen.getByText(/验证码将发送到 138\*\*\*\*0000/)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '发送验证码' }).disabled).toBe(false);
  });
});

function model(overrides: Partial<StepupViewModel>): StepupViewModel {
  return {
    open: true,
    phoneMasked: '138****0000',
    challenge: undefined,
    code: '',
    busy: false,
    error: undefined,
    approval: '',
    purpose: 'session',
    proof: undefined,
    expires: '未知',
    actions: {
      close: vi.fn(),
      request: vi.fn(),
      complete: vi.fn(),
      selectPurpose: vi.fn(),
      updateApproval: vi.fn(),
      updateCode: vi.fn(),
      copyProof: vi.fn(),
    },
    ...overrides,
  };
}
