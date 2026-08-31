import { describe, expect, it } from 'vitest';
import { challengeNotice, OTP_POLICY } from './ChallengePolicy';

describe('one-time-code user policy', () => {
  it('keeps validity and resend cooldown as separate canonical values', () => {
    expect(OTP_POLICY).toEqual({ validMinutes: 10, resendSeconds: 30 });
    expect(challengeNotice()).toContain('10 分钟内有效');
    expect(challengeNotice()).toContain('30 秒后可重新获取');
  });

  it('uses an account-enumeration-safe notice when requested', () => {
    expect(challengeNotice(true)).toContain('无论账号是否存在均显示相同结果');
  });
});
