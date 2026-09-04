import { describe, expect, it } from 'vitest';
import { OTP_RESEND_AFTER_SECONDS } from './otpDelivery';

describe('legacy SMS verification-code resend contract', () => {
  it('never instructs a client to wait longer than 30 seconds', () => {
    expect(OTP_RESEND_AFTER_SECONDS).toBe(30);
    expect(OTP_RESEND_AFTER_SECONDS).toBeLessThanOrEqual(30);
  });
});
