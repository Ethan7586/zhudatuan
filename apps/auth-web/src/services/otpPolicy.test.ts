import { describe, expect, it } from 'vitest';
import { SMS_CODE_RESEND_SECONDS, smsResendDeadline, smsResendSecondsRemaining } from './otpPolicy';

describe('SMS verification-code resend policy', () => {
  it('never makes the user wait longer than 45 seconds', () => {
    expect(SMS_CODE_RESEND_SECONDS).toBe(45);
    expect(SMS_CODE_RESEND_SECONDS).toBeLessThanOrEqual(45);
    expect(smsResendDeadline(1_000, 600)).toBe(46_000);
  });

  it('uses wall-clock time instead of counting throttled timer ticks', () => {
    const deadline = smsResendDeadline(10_000);
    expect(smsResendSecondsRemaining(deadline, 10_000)).toBe(45);
    expect(smsResendSecondsRemaining(deadline, 54_001)).toBe(1);
    expect(smsResendSecondsRemaining(deadline, 55_000)).toBe(0);
    expect(smsResendSecondsRemaining(deadline, 90_000)).toBe(0);
  });
});
