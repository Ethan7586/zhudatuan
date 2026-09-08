// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PasswordForm } from '../../src/feature/login/view/PasswordForm';

describe('password journey', () => {
  it('submits the account and short-lived password, then clears the secret field', async () => {
    const submit = vi.fn();
    const user = userEvent.setup();
    render(<PasswordForm busy={false} error={{}} agreement={<span />} submitLabel="登录并进入消费者商城" onSubmit={submit} onReset={vi.fn()} />);
    await user.type(screen.getByLabelText(/登录账号或已绑定手机号/), 'employee');
    const password = screen.getByLabelText(/^密码$/);
    await user.type(password, 'Secret-12345!');
    await user.click(screen.getByRole('button', { name: '登录并进入消费者商城' }));
    expect(submit).toHaveBeenCalledWith('employee', 'Secret-12345!');
    expect((password as HTMLInputElement).value).toBe('');
  });

  it('keeps field issues local and exposes the nearby recovery action', async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    render(<PasswordForm busy={false} error={{ subject: '请输入账号', password: '请输入密码' }} agreement={<span />} submitLabel="登录并进入消费者商城" onSubmit={vi.fn()} onReset={reset} />);
    expect(screen.getAllByText(/请输入/)).toHaveLength(2);
    expect(screen.getByLabelText(/登录账号或已绑定手机号/).getAttribute('aria-errormessage')).toBeTruthy();
    expect(screen.getByLabelText(/^密码$/).getAttribute('aria-errormessage')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '忘记密码？' }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
