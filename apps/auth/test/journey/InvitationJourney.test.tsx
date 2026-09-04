// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InvitationForm } from '../../src/feature/invitation/view/InvitationForm';
import { InvitationJourney } from '../../src/feature/invitation/view/InvitationJourney';

describe('invitation journey', () => {
  it('submits an invitation outside URL and persistent storage and clears it immediately', async () => {
    const submit = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(<InvitationForm busy={false} onSubmit={submit} />);
    const input = screen.getByLabelText('企业邀请码');
    await user.type(input, ' invite-secret ');
    await user.click(screen.getByRole('button', { name: '继续接受邀请' }));
    expect(submit).toHaveBeenCalledWith('invite-secret');
    expect((input as HTMLInputElement).value).toBe('');
    expect(window.location.href).not.toContain('invite-secret');
    expect(JSON.stringify(window.sessionStorage)).not.toContain('invite-secret');
  });

  it('explains the complete journey and server-bound target scope', () => {
    render(<InvitationJourney target="storefront" current={3} />);
    expect(screen.getByLabelText('接受邀请进度').textContent).toContain('校验邀请');
    expect(screen.getByLabelText('接受邀请进度').textContent).toContain('登录或注册');
    expect(screen.getByLabelText('接受邀请进度').textContent).toContain('确认身份和范围');
    expect(screen.getByLabelText('接受邀请进度').textContent).toContain('消费者商城');
    expect(screen.getByText('确认身份和范围').parentElement?.getAttribute('aria-current')).toBe('step');
  });
});
