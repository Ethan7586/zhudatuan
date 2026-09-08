import { describe, expect, it } from 'vitest';
import { Redactor } from './Redactor';

describe('Redactor', () => {
  it('redacts secrets and PII recursively at the logger boundary', () => {
    const value = new Redactor().redact({
      token: 'private-token', password: 'Private-Password-1!', otp: '483921', session: 'private-session',
      cookie: 'shop_session=private-cookie', ticket: 'private-ticket', requestBody: { mobile: '13800138000' },
      nested: { phone: '13800138000', note: 'mail a@b.com; OTP: 483921; 验证码：593810' },
    });
    expect(value).toEqual({
      token: '[REDACTED]', password: '[REDACTED]', otp: '[REDACTED]', session: '[REDACTED]', cookie: '[REDACTED]',
      ticket: '[REDACTED]', requestBody: '[REDACTED]',
      nested: { phone: '[REDACTED]', note: 'mail [EMAIL]; OTP [REDACTED]; 验证码 [REDACTED]' },
    });
    const serialized = JSON.stringify(value);
    for (const secret of ['private-token', 'Private-Password-1!', '483921', 'private-session', 'private-cookie',
      'private-ticket', '13800138000', '593810']) expect(serialized).not.toContain(secret);
  });
});
