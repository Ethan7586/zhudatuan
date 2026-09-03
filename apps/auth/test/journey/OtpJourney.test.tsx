// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OtpForm } from '../../src/feature/login/ui/OtpForm';
import { actionFailure, actionSuccess } from '../../src/shared/ui/ActionResult';

describe('OTP journey', () => {
  it('binds a received challenge to the current subject before login', async () => {
    const submit = vi.fn();
    const challenge = vi.fn(async () => actionSuccess({ id: 'challenge-1', resendSeconds: 60 }));
    const user = userEvent.setup();
    render(<OtpForm busy={false} error={{}} onChallenge={challenge} onSubmit={submit} />);
    await user.type(screen.getByLabelText(/登录账号或已绑定手机号/), '13800000000');
    await user.click(screen.getByRole('button', { name: '获取验证码' }));
    await user.type(screen.getByLabelText('短信验证码'), '123456');
    await user.click(screen.getByRole('button', { name: '登录' }));
    expect(challenge).toHaveBeenCalledWith('13800000000');
    expect(submit).toHaveBeenCalledWith('13800000000', 'challenge-1', '123456');
  });

  it('does not create a challenge binding after a safe failure', async () => {
    const submit = vi.fn();
    const challenge = vi.fn(async () => actionFailure<Readonly<{ id: string; resendSeconds: number }>>({ title: '暂时不可用', message: '请稍后重试', severity: 'warning', action: { kind: 'retry', label: '重试' }, retryable: true }));
    const user = userEvent.setup();
    render(<OtpForm busy={false} error={{}} onChallenge={challenge} onSubmit={submit} />);
    await user.type(screen.getByLabelText(/登录账号或已绑定手机号/), '13800000000');
    await user.click(screen.getByRole('button', { name: '获取验证码' }));
    await user.click(screen.getByRole('button', { name: '登录' }));
    expect(submit).toHaveBeenCalledWith('13800000000', '', '');
  });

  it('coalesces rapid challenge clicks into one running request', async () => {
    let complete: ((value: ReturnType<typeof actionSuccess<Readonly<{ id: string; resendSeconds: number }>>>) => void) | undefined;
    const challenge = vi.fn(() => new Promise<ReturnType<typeof actionSuccess<Readonly<{ id: string; resendSeconds: number }>>>>((resolve) => { complete = resolve; }));
    const user = userEvent.setup();
    render(<OtpForm busy={false} error={{}} onChallenge={challenge} onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/登录账号或已绑定手机号/), '13800000000');
    const send = screen.getByRole('button', { name: '获取验证码' });
    send.click();
    send.click();
    expect(challenge).toHaveBeenCalledTimes(1);
    complete?.(actionSuccess({ id: 'challenge-1', resendSeconds: 60 }));
  });
});
