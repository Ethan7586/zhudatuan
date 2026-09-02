// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EnrollmentState } from '../model/Enrollment';
import { EnrollmentPage } from './EnrollmentPage';

afterEach(cleanup);

describe('EnrollmentPage', () => {
  it('keeps a bound invitation immutable and focuses the employee name', async () => {
    render(<EnrollmentPage enrollment={enrollment('bound')} createChallenge={vi.fn()} onComplete={vi.fn()} onClose={vi.fn()} />);

    const name = screen.getByLabelText('姓名') as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(name));
    expect(name.readOnly).toBe(true);
    expect(name.value).toBe('张三');
    expect(screen.queryByLabelText('登录手机号')).toBeNull();
    expect(screen.getByText('138****8000')).toBeTruthy();
    expect(screen.getByText(/注册仅开通员工商城，控制台权限需另行授权。/)).toBeTruthy();
  });

  it('retains every user-entered value when completion fails', async () => {
    const complete = vi.fn().mockRejectedValue(new Error('验证码校验失败，请重试。'));
    render(
      <EnrollmentPage
        enrollment={enrollment('input')}
        createChallenge={vi.fn().mockResolvedValue({ id: 'challenge:one', expiresAt: '2026-09-02T13:10:00.000Z' })}
        onComplete={complete}
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('姓名'), { target: { value: '李四' } });
    fireEvent.change(screen.getByLabelText('登录手机号'), { target: { value: '13900001301' } });
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }));
    await screen.findByRole('status');
    fireEvent.change(screen.getByLabelText('手机验证码'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('设置密码'), { target: { value: 'StrongPass1!' } });
    fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'StrongPass1!' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '创建普通员工账号' }));

    expect((await screen.findByRole('alert')).textContent).toContain('验证码校验失败，请重试。');
    expect(complete).toHaveBeenCalledOnce();
    expect((screen.getByLabelText('姓名') as HTMLInputElement).value).toBe('李四');
    expect((screen.getByLabelText('登录手机号') as HTMLInputElement).value).toBe('13900001301');
    expect((screen.getByLabelText('手机验证码') as HTMLInputElement).value).toBe('123456');
    expect((screen.getByLabelText('设置密码') as HTMLInputElement).value).toBe('StrongPass1!');
    expect((screen.getByLabelText('确认密码') as HTMLInputElement).value).toBe('StrongPass1!');
  });
});

function enrollment(subjectMode: EnrollmentState['subjectMode']): EnrollmentState {
  return {
    id: 'enrollment:one',
    kind: subjectMode === 'bound' ? 'enrollment' : 'campaign',
    target: 'storefront',
    expiresAt: '2099-09-09T00:00:00.000Z',
    subjectMode,
    organization: { id: 'enterprise:one', name: '示例企业' },
    ...(subjectMode === 'bound' ? { recipientMasked: '138****8000', employee: { displayName: '张三', employeeNo: 'E001' } } : {}),
    policy: {
      termsTitle: '服务协议',
      termsBody: '服务协议正文',
      privacyTitle: '隐私政策',
      privacyBody: '隐私政策正文',
      termsHash: 'terms:one',
    },
  };
}
