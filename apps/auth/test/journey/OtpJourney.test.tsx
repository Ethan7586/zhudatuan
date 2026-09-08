// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OtpForm } from '../../src/feature/login/view/OtpForm';
import { actionFailure, actionSuccess } from '../../src/shared/ui/ActionResult';
import type { Challenge } from '../../src/feature/challenge';

const issued: Challenge = Object.freeze({
  id: 'challenge-1',
  purpose: 'login',
  expiresAt: '2099-01-01T00:10:00.000Z',
  retryAt: '2099-01-01T00:00:30.000Z',
  attemptsRemaining: 10,
  validSeconds: 600,
  resendSeconds: 30,
});

describe('OTP journey', () => {
  it('binds a received challenge to the current subject before login', async () => {
    const submit = vi.fn();
    const challenge = vi.fn(async () => actionSuccess(issued));
    const user = userEvent.setup();
    render(<OtpForm busy={false} error={{}} agreement={<span />} submitLabel="登录并进入消费者商城" onChallenge={challenge} onSubmit={submit} />);
    await user.type(screen.getByLabelText(/登录账号或已绑定手机号/), '13800000000');
    await user.click(screen.getByRole('button', { name: '获取验证码' }));
    await user.type(screen.getByLabelText('短信验证码'), '123456');
    await user.click(screen.getByRole('button', { name: '登录并进入消费者商城' }));
    expect(challenge).toHaveBeenCalledWith('13800000000');
    expect(submit).toHaveBeenCalledWith('13800000000', 'challenge-1', '123456');
    expect(screen.getByLabelText('验证码状态').textContent).toContain('登录验证');
    expect(screen.getByLabelText('验证码状态').textContent).toContain('10 次');
  });

  it('does not create a challenge binding after a safe failure', async () => {
    const submit = vi.fn();
    const challenge = vi.fn(async () => actionFailure<Challenge>({ title: '暂时不可用', message: '请稍后重试', severity: 'warning', action: { kind: 'retry', label: '重试' }, retryable: true }));
    const user = userEvent.setup();
    render(<OtpForm busy={false} error={{}} agreement={<span />} submitLabel="登录并进入消费者商城" onChallenge={challenge} onSubmit={submit} />);
    await user.type(screen.getByLabelText(/登录账号或已绑定手机号/), '13800000000');
    await user.click(screen.getByRole('button', { name: '获取验证码' }));
    await user.click(screen.getByRole('button', { name: '登录并进入消费者商城' }));
    expect(submit).toHaveBeenCalledWith('13800000000', '', '');
  });

  it('coalesces rapid challenge clicks into one running request', async () => {
    let complete: ((value: ReturnType<typeof actionSuccess<Challenge>>) => void) | undefined;
    const challenge = vi.fn(
      () =>
        new Promise<ReturnType<typeof actionSuccess<Challenge>>>((resolve) => {
          complete = resolve;
        })
    );
    const user = userEvent.setup();
    render(<OtpForm busy={false} error={{}} agreement={<span />} submitLabel="登录并进入消费者商城" onChallenge={challenge} onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/登录账号或已绑定手机号/), '13800000000');
    const send = screen.getByRole('button', { name: '获取验证码' });
    send.click();
    send.click();
    expect(challenge).toHaveBeenCalledTimes(1);
    complete?.(actionSuccess(issued));
  });

  it('invalidates the challenge when the account or mobile changes', async () => {
    const submit = vi.fn();
    const user = userEvent.setup();
    render(<OtpForm busy={false} error={{}} agreement={<span />} submitLabel="登录并进入消费者商城" onChallenge={vi.fn(async () => actionSuccess(issued))} onSubmit={submit} />);
    const subject = screen.getByLabelText(/登录账号或已绑定手机号/);

    await user.type(subject, '13800000000');
    await user.click(screen.getByRole('button', { name: '获取验证码' }));
    await user.clear(subject);
    await user.type(subject, '13900000000');
    await user.type(screen.getByLabelText('短信验证码'), '123456');
    await user.click(screen.getByRole('button', { name: '登录并进入消费者商城' }));

    expect(screen.queryByLabelText('验证码状态')).toBeNull();
    expect(submit).toHaveBeenCalledWith('13900000000', '', '123456');
  });
});
