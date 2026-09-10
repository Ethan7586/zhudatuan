// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginMethod } from '../../src/feature/login/view/LoginMethod';
import { TargetPicker } from '../../src/shared/view/TargetPicker';

describe('keyboard journey', () => {
  it('moves through login method tabs with arrows, Home and End', async () => {
    const select = vi.fn();
    const user = userEvent.setup();
    render(<LoginMethod method="password" methods={['password', 'otp']} busy={false} onChange={select} />);

    const password = screen.getByRole('tab', { name: '密码登录' });
    const otp = screen.getByRole('tab', { name: '验证码登录' });
    password.focus();
    await user.keyboard('{ArrowRight}');
    expect(select).toHaveBeenLastCalledWith('otp');
    expect(document.activeElement).toBe(otp);
    await user.keyboard('{End}');
    expect(select).toHaveBeenLastCalledWith('otp');
    expect(document.activeElement).toBe(otp);
    await user.keyboard('{Home}');
    expect(select).toHaveBeenLastCalledWith('password');
    expect(document.activeElement).toBe(password);
  });

  it('moves through application targets as one radio group and wraps at either edge', async () => {
    const select = vi.fn();
    const user = userEvent.setup();
    render(<TargetPicker target="storefront" busy={false} onTarget={select} />);

    const storefront = screen.getByRole('radio', { name: /消费者商城/ });
    const consoleTarget = screen.getByRole('radio', { name: /运营控制台/ });
    storefront.focus();
    await user.keyboard('{ArrowLeft}');
    expect(select).toHaveBeenLastCalledWith('console');
    expect(document.activeElement).toBe(consoleTarget);
    await user.keyboard('{ArrowRight}');
    expect(select).toHaveBeenLastCalledWith('storefront');
    expect(document.activeElement).toBe(storefront);
  });

  it.each([
    ['supplier', '供应链后台'],
    ['store', '门店工作台'],
  ] as const)('keeps the %s entry focused on its own workspace and the operations console', (entryTarget, label) => {
    const { rerender } = render(<TargetPicker target={entryTarget} entryTarget={entryTarget} busy={false} onTarget={vi.fn()} />);

    expect(screen.getByRole('radio', { name: new RegExp(label) })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /运营控制台/ })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /消费者商城/ })).toBeNull();
    expect(screen.getAllByRole('radio')).toHaveLength(2);

    rerender(<TargetPicker target="console" entryTarget={entryTarget} busy={false} onTarget={vi.fn()} />);
    expect(screen.getByRole('radio', { name: new RegExp(label) })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /消费者商城/ })).toBeNull();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });
});
