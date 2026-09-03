// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecoveryDialog } from '../../src/feature/recovery/ui/RecoveryDialog';
import { actionSuccess } from '../../src/shared/ui/ActionResult';
import { bootstrap } from '../TestData';

describe('recovery journey', () => {
  it('verifies the subject, applies bootstrap password policy and clears secrets after reset', async () => {
    const challenge = vi.fn(async () => actionSuccess({ id: 'challenge-1', expiresAt: '2099-01-01T00:00:00.000Z', retryAt: '2098-01-01T00:00:00.000Z', validSeconds: 300, resendSeconds: 60 }));
    const reset = vi.fn(async () => actionSuccess(undefined));
    const user = userEvent.setup();
    render(<RecoveryDialog open bootstrap={bootstrap} onChallenge={challenge} onReset={reset} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText('登录账号或已绑定手机号'), '13800000000');
    await user.click(screen.getByRole('button', { name: '获取验证码' }));
    await user.type(screen.getByLabelText('短信验证码'), '123456');
    await user.type(screen.getByLabelText('新密码'), 'Secret-12345!');
    await user.type(screen.getByLabelText('确认新密码'), 'Secret-12345!');
    await user.click(screen.getByRole('button', { name: '重置密码并下线全部设备' }));
    await waitFor(() => expect(reset).toHaveBeenCalledWith('challenge-1', '123456', 'Secret-12345!'));
    expect((screen.getByLabelText('新密码') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('确认新密码') as HTMLInputElement).value).toBe('');
  });
});
