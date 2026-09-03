// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PasswordForm } from '../../src/feature/login/view/PasswordForm';

describe('password journey', () => {
  it('submits the account and short-lived password, then clears the secret field', async () => {
    const submit = vi.fn();
    const user = userEvent.setup();
    render(<PasswordForm busy={false} error={{}} onSubmit={submit} onReset={vi.fn()} onInvitation={vi.fn()} />);
    await user.type(screen.getByLabelText(/登录账号或已绑定手机号/), 'employee');
    const password = screen.getByLabelText(/^密码$/);
    await user.type(password, 'Secret-12345!');
    await user.click(screen.getByRole('button', { name: '登录' }));
    expect(submit).toHaveBeenCalledWith('employee', 'Secret-12345!');
    expect((password as HTMLInputElement).value).toBe('');
  });

  it('keeps field issues local and exposes reset and registration actions', async () => {
    const reset = vi.fn();
    const invitation = vi.fn();
    const user = userEvent.setup();
    render(<PasswordForm busy={false} error={{ subject: '请输入账号', password: '请输入密码' }} onSubmit={vi.fn()} onReset={reset} onInvitation={invitation} />);
    expect(screen.getAllByText(/请输入/)).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: '忘记密码？' }));
    await user.click(screen.getByRole('button', { name: '新用户注册' }));
    expect(reset).toHaveBeenCalledOnce();
    expect(invitation).toHaveBeenCalledOnce();
  });
});
