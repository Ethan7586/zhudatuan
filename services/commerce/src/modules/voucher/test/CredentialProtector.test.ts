import { describe, expect, it, vi } from 'vitest';
import type { KmsClient } from '../../../foundation/application/KmsPort';
import { EnvelopeCredentialProtector } from '../infrastructure/crypto/EnvelopeCredentialProtector';

const binding = { scope: 'mall:one', pool: 'pool:one', credential: 'credential:one' };

describe('credential envelope format and purpose binding', () => {
  it('uses identical canonical bytes for encryption and lookup, preserving case-sensitive secrets', async () => {
    const encrypt = vi.fn(async () => ({ ciphertext: 'encrypted-ciphertext', fingerprint: 'f'.repeat(64), keyVersion: 'key:one' }));
    const protector = new EnvelopeCredentialProtector({ encrypt } as unknown as KmsClient);
    await protector.protect('  vc001234 ', 'number', binding);
    expect(encrypt).toHaveBeenCalledWith('pii', 'voucher/credential/number', 'VC001234', expect.objectContaining({ ...binding, use: 'credential' }));
    expect(encrypt).toHaveBeenCalledWith('pii', 'voucher/index/number', 'VC001234', expect.objectContaining({ scope: binding.scope, use: 'lookup' }));
    encrypt.mockClear();
    await protector.protect(' AbCd!@#123 ', 'secret', binding);
    expect(encrypt).toHaveBeenCalledWith('pii', 'voucher/credential/secret', 'AbCd!@#123', expect.objectContaining({ ...binding, purpose: 'secret' }));
    expect(encrypt).toHaveBeenCalledWith('pii', 'voucher/index/secret', 'AbCd!@#123', expect.anything());
  });

  it.each(['Ａbc123', 'A'.repeat(129), 'abc\u0000def'])('never calls the encryption provider for invalid secret %j', async secret => {
    const encrypt = vi.fn();
    const protector = new EnvelopeCredentialProtector({ encrypt } as unknown as KmsClient);
    await expect(protector.protect(secret, 'secret', binding)).rejects.toThrow('VOUCHER_SECRET_INVALID');
    await expect(protector.fingerprint(secret, 'secret', binding.scope)).rejects.toThrow('VOUCHER_SECRET_INVALID');
    expect(encrypt).not.toHaveBeenCalled();
  });
});
