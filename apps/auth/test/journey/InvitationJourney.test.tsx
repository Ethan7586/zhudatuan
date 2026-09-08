// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InvitationForm } from '../../src/feature/invitation/view/InvitationForm';
import { InvitationJourney } from '../../src/feature/invitation/view/InvitationJourney';
import { RegistrationPage } from '../../src/feature/invitation/view/RegistrationPage';
import { bootstrap } from '../TestData';

describe('invitation journey', () => {
  it('submits an invitation outside URL and persistent storage and clears it immediately', async () => {
    const submit = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(<InvitationForm busy={false} agreement={<span />} onSubmit={submit} />);
    const input = screen.getByLabelText('企业邀请码');
    await user.type(input, ' invite-secret ');
    await user.click(screen.getByRole('button', { name: '验证邀请码，继续注册' }));
    expect(submit).toHaveBeenCalledWith('invite-secret');
    expect((input as HTMLInputElement).value).toBe('');
    expect(window.location.href).not.toContain('invite-secret');
    expect(JSON.stringify(window.sessionStorage)).not.toContain('invite-secret');
  });

  it('announces an invitation validation issue next to the field', () => {
    render(<InvitationForm busy={false} error="请输入企业邀请码" agreement={<span />} onSubmit={vi.fn(async () => undefined)} />);
    expect(screen.getByLabelText('企业邀请码').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('请输入企业邀请码')).toBeTruthy();
  });

  it('explains the complete journey and server-bound target scope', () => {
    render(<InvitationJourney target="storefront" current={3} />);
    expect(screen.getByLabelText('邀请码注册进度').textContent).toContain('验证邀请');
    expect(screen.getByLabelText('邀请码注册进度').textContent).toContain('完善账号');
    expect(screen.getByLabelText('邀请码注册进度').textContent).toContain('确认身份');
    expect(screen.getByLabelText('邀请码注册进度').textContent).toContain('消费者商城');
    expect(screen.getByText('确认身份').parentElement?.getAttribute('aria-current')).toBe('step');
  });

  it('keeps invitation registration separate from login methods', () => {
    render(
      <RegistrationPage
        bootstrap={bootstrap}
        target="storefront"
        accepted={false}
        busy={false}
        fields={{}}
        current={1}
        complete={false}
        onTarget={vi.fn()}
        onAccepted={vi.fn()}
        onInvitation={vi.fn(async () => undefined)}
        onBack={vi.fn()}
        onLogin={vi.fn()}
      />
    );
    expect(screen.getByRole('heading', { name: '使用企业邀请码注册' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: '目标系统' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '验证邀请码，继续注册' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '返回登录' })).toBeTruthy();
    expect(screen.queryByRole('tablist', { name: '登录方式' })).toBeNull();
  });
});
