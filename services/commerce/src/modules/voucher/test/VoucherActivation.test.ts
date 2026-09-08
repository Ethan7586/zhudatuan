import { describe, expect, it, vi } from 'vitest';
import { VoucherActivation } from '../application/service/VoucherActivation';

describe('voucher activation input', () => {
  it('uses the same normalized number as credential creation and preserves secret case', async () => {
    const fingerprint = vi.fn(async (_value: string, purpose: string) => (purpose === 'number' ? 'a'.repeat(64) : 'b'.repeat(64)));
    const service = new VoucherActivation({} as never, { fingerprint });
    expect(await service.prepare('mall:one', 'Secret123', 'vc001234')).toEqual({ numberFingerprint: 'a'.repeat(64), secretFingerprint: 'b'.repeat(64) });
    expect(fingerprint).toHaveBeenCalledWith('VC001234', 'number', 'mall:one');
    expect(fingerprint).toHaveBeenCalledWith('Secret123', 'secret', 'mall:one');
  });
  it('validates card format before starting either remote call', async () => {
    const fingerprint = vi.fn();
    const service = new VoucherActivation({} as never, { fingerprint });
    await expect(service.prepare('mall:one', 'Secret123', 'bad number')).rejects.toThrow('VALIDATION_FAILED');
    expect(fingerprint).not.toHaveBeenCalled();
  });
  it.each(['A'.repeat(129), 'Ａbc123', 'ABC 123', 'abc\ndef'])('rejects invalid secret before calling KMS: %j', async (secret) => {
    const fingerprint = vi.fn();
    await expect(new VoucherActivation({} as never, { fingerprint }).prepare('mall:one', secret, 'VC001234')).rejects.toThrow('VOUCHER_SECRET_INVALID');
    expect(fingerprint).not.toHaveBeenCalled();
  });
});
