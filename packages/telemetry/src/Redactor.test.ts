import { describe, expect, it } from 'vitest';
import { Redactor } from './Redactor';

describe('Redactor', () => {
  it('redacts secrets and PII recursively at the logger boundary', () => {
    const value = new Redactor().redact({ token: 'secret', nested: { actionProof: { proof: 'single-use' }, phone: '13800138000', note: 'mail a@b.com' } });
    expect(value).toEqual({ token: '[REDACTED]', nested: { actionProof: '[REDACTED]', phone: '[REDACTED]', note: 'mail [EMAIL]' } });
  });
});
