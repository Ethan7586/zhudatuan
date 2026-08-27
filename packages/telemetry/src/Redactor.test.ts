import { describe, expect, it } from 'vitest';
import { Redactor } from './Redactor';

describe('Redactor', () => {
  it('redacts secrets and PII recursively at the logger boundary', () => {
<<<<<<< HEAD
    const value = new Redactor().redact({ token: 'secret', nested: { actionProof: { proof: 'single-use' }, phone: '13800138000', note: 'mail a@b.com' } });
    expect(value).toEqual({ token: '[REDACTED]', nested: { actionProof: '[REDACTED]', phone: '[REDACTED]', note: 'mail [EMAIL]' } });
=======
    const value = new Redactor().redact({ token: 'secret', nested: { phone: '13800138000', note: 'mail a@b.com' } });
    expect(value).toEqual({ token: '[REDACTED]', nested: { phone: '[REDACTED]', note: 'mail [EMAIL]' } });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  });
});
