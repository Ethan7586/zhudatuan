import { describe, expect, it } from 'vitest';
import { invitationIssues, otpIssues, passwordIssues, subjectIssue } from './LoginValidation';

describe('login validation', () => {
  it('uses the same understandable subject guidance for password and challenge flows', () => {
    expect(subjectIssue('')).toBe('请输入登录账号或已绑定手机号');
    expect(passwordIssues('', '')).toEqual({ subject: '请输入登录账号或已绑定手机号', password: '请输入密码' });
  });

  it('distinguishes requesting a code from entering an invalid code', () => {
    expect(otpIssues('员工甲', '', '')).toEqual({ code: '请先获取验证码' });
    expect(otpIssues('员工甲', 'challenge', '123')).toEqual({ code: '请输入 6 位短信验证码' });
    expect(otpIssues('员工甲', 'challenge', '123456')).toEqual({});
  });

  it('validates invitation registration and legal agreement independently', () => {
    expect(invitationIssues('', false)).toEqual({ invitation: '请输入企业邀请码', agreement: '请先阅读并同意服务协议与隐私政策' });
    expect(invitationIssues('TEAM2026', true)).toEqual({});
  });
});
