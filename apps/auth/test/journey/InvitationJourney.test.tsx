// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InvitationForm } from '../../src/feature/invitation/ui/InvitationForm';

describe('invitation journey', () => {
  it('submits an invitation outside URL and persistent storage and clears it immediately', async () => {
    const submit = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(<InvitationForm busy={false} onSubmit={submit} />);
    const input = screen.getByLabelText('企业邀请码');
    await user.type(input, ' invite-secret ');
    await user.click(screen.getByRole('button', { name: '使用邀请码登录' }));
    expect(submit).toHaveBeenCalledWith('invite-secret');
    expect((input as HTMLInputElement).value).toBe('');
    expect(window.location.href).not.toContain('invite-secret');
    expect(JSON.stringify(window.sessionStorage)).not.toContain('invite-secret');
  });
});
