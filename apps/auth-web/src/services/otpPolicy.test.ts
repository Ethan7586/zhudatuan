import { describe, expect, it } from 'vitest';
import { SMS_CODE_RESEND_SECONDS, smsResendDeadline, smsResendSecondsRemaining } from './otpPolicy';

describe('SMS verification-code resend policy', () => {
  it('never makes the user wait longer than 30 seconds', () => {
    expect(SMS_CODE_RESEND_SECONDS).toBe(30);
    expect(SMS_CODE_RESEND_SECONDS).toBeLessThanOrEqual(30);
    expect(smsResendDeadline(1_000, 600)).toBe(31_000);
  });

  it('uses wall-clock time instead of counting throttled timer ticks', () => {
    const deadline = smsResendDeadline(10_000);
    expect(smsResendSecondsRemaining(deadline, 10_000)).toBe(30);
    expect(smsResendSecondsRemaining(deadline, 39_001)).toBe(1);
    expect(smsResendSecondsRemaining(deadline, 40_000)).toBe(0);
    expect(smsResendSecondsRemaining(deadline, 75_000)).toBe(0);
  });
});
