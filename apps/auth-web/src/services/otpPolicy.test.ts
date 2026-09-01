import { describe, expect, it } from 'vitest';
import { SMS_CODE_RESEND_SECONDS } from './otpPolicy';

describe('SMS verification-code resend policy', () => {
  it('never makes the user wait longer than 30 seconds', () => {
    expect(SMS_CODE_RESEND_SECONDS).toBe(30);
    expect(SMS_CODE_RESEND_SECONDS).toBeLessThanOrEqual(30);
  });
});
