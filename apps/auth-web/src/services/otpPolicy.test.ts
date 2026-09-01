import { describe, expect, it } from 'vitest';
<<<<<<< HEAD
<<<<<<< HEAD
import { SMS_CODE_RESEND_SECONDS, smsResendDeadline, smsResendSecondsRemaining } from './otpPolicy';
=======
import { SMS_CODE_RESEND_SECONDS } from './otpPolicy';
>>>>>>> 4dd41dd1 (fix(auth): cap SMS resend wait at 30 seconds)
=======
import { SMS_CODE_RESEND_SECONDS, smsResendDeadline, smsResendSecondsRemaining } from './otpPolicy';
>>>>>>> 31b27b78 (fix(auth): measure SMS cooldown by wall clock)

describe('SMS verification-code resend policy', () => {
  it('never makes the user wait longer than 30 seconds', () => {
    expect(SMS_CODE_RESEND_SECONDS).toBe(30);
    expect(SMS_CODE_RESEND_SECONDS).toBeLessThanOrEqual(30);
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 31b27b78 (fix(auth): measure SMS cooldown by wall clock)
    expect(smsResendDeadline(1_000, 600)).toBe(31_000);
  });

  it('uses wall-clock time instead of counting throttled timer ticks', () => {
    const deadline = smsResendDeadline(10_000);
    expect(smsResendSecondsRemaining(deadline, 10_000)).toBe(30);
    expect(smsResendSecondsRemaining(deadline, 39_001)).toBe(1);
    expect(smsResendSecondsRemaining(deadline, 40_000)).toBe(0);
    expect(smsResendSecondsRemaining(deadline, 75_000)).toBe(0);
<<<<<<< HEAD
=======
>>>>>>> 4dd41dd1 (fix(auth): cap SMS resend wait at 30 seconds)
=======
>>>>>>> 31b27b78 (fix(auth): measure SMS cooldown by wall clock)
  });
});
