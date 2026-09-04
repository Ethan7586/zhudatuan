import { describe, expect, it } from 'vitest';
import { credentialSecret, voucherCredential, voucherNumber } from './VoucherCredential';
import { VOUCHER_BODY_SCHEMAS } from './schema/VoucherSchema';

describe('single credential format contract', () => {
  it('normalizes number case but preserves secret case and supported punctuation', () => {
    expect(voucherNumber('  vc001234  ')).toBe('VC001234');
    expect(credentialSecret('  Ab12!@#$%^&*  ')).toBe('Ab12!@#$%^&*');
    expect(credentialSecret('Secret123')).not.toBe(credentialSecret('secret123'));
  });

  it.each(['Ａbc123', 'Abc①23', 'Abc\u000023', 'ABC 123', 'abc\ndef', 'abc\tdef', '密钥123456'])('does not fold invalid secret %j into a different credential', value => {
    expect(credentialSecret(value)).toBeNull();
    expect(VOUCHER_BODY_SCHEMAS.VoucherActivationsSecretInput.safeParse({ secret: value }).success).toBe(false);
  });

  it('keeps the wire contract and shared validation identical at every secret length boundary', () => {
    for (const length of [0, voucherCredential.secret.minimum - 1, voucherCredential.secret.minimum, voucherCredential.secret.maximum, voucherCredential.secret.maximum + 1, 256]) {
      const secret = 'A'.repeat(length);
      const valid = credentialSecret(secret) !== null;
      expect(VOUCHER_BODY_SCHEMAS.VoucherActivationsSecretInput.safeParse({ secret }).success).toBe(valid);
      expect(VOUCHER_BODY_SCHEMAS.VoucherActivationsNumbersecretInput.safeParse({ number: 'VC001234', secret }).success).toBe(valid);
    }
  });

  it.each(['1234567', '1'.repeat(41), 'VC-001234', 'ＶＣ001234', 'VC\n001234'])('rejects invalid card number %j in both entry points', number => {
    expect(voucherNumber(number)).toBeNull();
    expect(VOUCHER_BODY_SCHEMAS.VoucherActivationsNumbersecretInput.safeParse({ number, secret: 'Secret123' }).success).toBe(false);
  });
});
