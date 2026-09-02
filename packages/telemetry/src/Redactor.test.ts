import { describe, expect, it } from 'vitest';
import { Redactor } from './Redactor';

describe('Redactor', () => {
  it('redacts secrets and PII recursively at the logger boundary', () => {
    const value = new Redactor().redact({ token: 'secret', nested: { phone: '13800138000', note: 'mail a@b.com' } });
    expect(value).toEqual({ token: '[REDACTED]', nested: { phone: '[REDACTED]', note: 'mail [EMAIL]' } });
  });

  it('preserves bounded operational codes without allowing arbitrary error messages through', () => {
    const value = new Redactor().redact({ errorCode: 'AUTHORIZATION_DENIED', faultCode: 'SW-ACCESS-102', verificationCode: '123456', nested: { errorCode: 'user 13800138000 failed' } });
    expect(value).toEqual({ errorCode: 'AUTHORIZATION_DENIED', faultCode: 'SW-ACCESS-102', verificationCode: '[REDACTED]', nested: { errorCode: '[REDACTED]' } });
  });

  it('redacts invitation and support payload fields from logs, metrics and audit records', () => {
    const value = new Redactor().redact({
      invitationCode: 'ABCD-EFGH-JKMN-PQRS',
      destination: '+8613800138000',
      body: 'customer message',
      ciphertext: 'encrypted body',
      attachment: { filename: 'private.pdf', objectref: 'object:one' },
      evidence: 'evidence:one',
    });
    expect(value).toEqual({
      invitationCode: '[REDACTED]',
      destination: '[REDACTED]',
      body: '[REDACTED]',
      ciphertext: '[REDACTED]',
      attachment: '[REDACTED]',
      evidence: '[REDACTED]',
    });
  });
});
