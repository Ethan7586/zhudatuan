// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InvitationForm } from '../../src/feature/invitation/view/InvitationForm';
import { InvitationJourney } from '../../src/feature/invitation/view/InvitationJourney';
import { InvitationPage } from '../../src/feature/invitation/view/InvitationPage';
import { bootstrap } from '../TestData';

describe('invitation journey', () => {
  it('submits an invitation outside URL and persistent storage and clears it immediately', async () => {
    const submit = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(<InvitationForm busy={false} agreement={<span />} onSubmit={submit} />);
    const input = screen.getByLabelText('企业邀请码');
    await user.type(input, ' invite-secret ');
    await user.click(screen.getByRole('button', { name: '验证邀请码，继续' }));
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

  it('does not misrepresent an unresolved invitation as registration', () => {
    render(<InvitationJourney target="storefront" current={2} mode="unknown" />);
    const journey = screen.getByLabelText('企业邀请处理进度');
    expect(journey.textContent).toContain('验证邀请');
    expect(journey.textContent).toContain('识别用途');
    expect(journey.textContent).toContain('身份确认');
    expect(journey.textContent).toContain('消费者商城');
    expect(journey.textContent).toContain('自动识别注册或安全进入');
    expect(screen.getByText('识别用途').parentElement?.getAttribute('aria-current')).toBe('step');
    expect(screen.queryByText('完善账号')).toBeNull();
  });

  it('makes the existing-member branch explicit without implying registration or elevation', () => {
    render(<InvitationJourney target="console" current={3} mode="signin" />);
    const journey = screen.getByLabelText('企业邀请处理进度');
    expect(journey.textContent).toContain('确认成员');
    expect(journey.textContent).toContain('安全验证');
    expect(journey.textContent).toContain('不会创建新账号或增加权限');
    expect(journey.textContent).toContain('运营控制台');
  });

  it('keeps invitation registration separate from login methods', () => {
    render(
      <InvitationPage
        bootstrap={bootstrap}
        target="storefront"
        accepted={false}
        busy={false}
        fields={{}}
        current={1}
        mode="unknown"
        complete={false}
        onTarget={vi.fn()}
        onAccepted={vi.fn()}
        onInvitation={vi.fn(async () => undefined)}
        onBack={vi.fn()}
        onLogin={vi.fn()}
      />
    );
    expect(screen.getByRole('heading', { name: '验证企业邀请' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: '目标系统' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '验证邀请码，继续' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '返回登录' })).toBeTruthy();
    expect(screen.queryByRole('tablist', { name: '登录方式' })).toBeNull();
  });
});
