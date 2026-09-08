const SUBJECT_REQUIRED = '请输入登录账号或已绑定手机号';
const AGREEMENT_REQUIRED = '请先阅读并同意服务协议与隐私政策';

export function subjectIssue(subject: string): string | undefined {
  return subject.trim() ? undefined : SUBJECT_REQUIRED;
}

export function passwordIssues(subject: string, password: string): Readonly<Record<string, string>> {
  return Object.freeze({ ...(subjectIssue(subject) ? { subject: SUBJECT_REQUIRED } : {}), ...(!password ? { password: '请输入密码' } : {}) });
}

export function otpIssues(subject: string, challenge: string, code: string): Readonly<Record<string, string>> {
  return Object.freeze({
    ...(subjectIssue(subject) ? { subject: SUBJECT_REQUIRED } : {}),
    ...(!challenge || !/^\d{6}$/.test(code) ? { code: challenge ? '请输入 6 位短信验证码' : '请先获取验证码' } : {}),
  });
}

export function invitationIssues(code: string, accepted: boolean): Readonly<Record<string, string>> {
  return Object.freeze({ ...(!code.trim() ? { invitation: '请输入企业邀请码' } : {}), ...(!accepted ? { agreement: AGREEMENT_REQUIRED } : {}) });
}
