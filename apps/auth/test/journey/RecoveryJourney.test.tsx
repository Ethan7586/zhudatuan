// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecoveryDialog } from '../../src/feature/recovery/view/RecoveryDialog';
import { useRecoveryViewModel } from '../../src/feature/recovery/viewmodel/RecoveryViewModel';
import { actionSuccess } from '../../src/shared/ui/ActionResult';
import { bootstrap } from '../TestData';

describe('recovery journey', () => {
  it('verifies the subject, applies bootstrap password policy and clears secrets after reset', async () => {
    const challenge = vi.fn(async () => actionSuccess({ id: 'challenge-1', purpose: 'password_reset' as const, expiresAt: '2099-01-01T00:00:00.000Z', retryAt: '2098-01-01T00:00:00.000Z', attemptsRemaining: 10, validSeconds: 300, resendSeconds: 60 }));
    const reset = vi.fn(async () => actionSuccess(undefined));
    const user = userEvent.setup();
    render(<RecoveryTest onChallenge={challenge} onReset={reset} />);
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

function RecoveryTest({ onChallenge, onReset }: Readonly<{ onChallenge: Parameters<typeof useRecoveryViewModel>[1]; onReset: Parameters<typeof useRecoveryViewModel>[2] }>) {
  return <RecoveryDialog open viewmodel={useRecoveryViewModel(bootstrap, onChallenge, onReset, vi.fn())} />;
}
