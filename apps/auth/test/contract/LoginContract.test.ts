import { describe, expect, it } from 'vitest';
import { mapLogin } from '../../src/feature/login/infrastructure/LoginMapper';
import { membership } from '../TestData';

describe('login contract', () => {
  it('preserves rich membership choices', () => {
    const result = mapLogin({ kind: 'selection', transaction: 'selection-1', memberships: [membership] });
    expect(result).toEqual({ kind: 'membership', transaction: 'selection-1', memberships: [membership] });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('maps proof and enrollment discriminators and rejects an empty proof reference', () => {
    expect(mapLogin({ kind: 'proofRequired', proof: { reference: 'proof-1', expiresAt: '2099-01-01T00:00:00.000Z', method: 'otp', target: 'storefront' } })).toMatchObject({ kind: 'proof', reference: 'proof-1' });
    expect(mapLogin({ kind: 'enrollment', enrollment: { id: 'enrollment-1', expiresAt: '2099-01-01T00:00:00.000Z', target: 'storefront' } })).toMatchObject({ kind: 'enrollment', id: 'enrollment-1' });
    expect(() => mapLogin({ kind: 'proofRequired', proof: { expiresAt: '2099-01-01T00:00:00.000Z', method: 'otp', target: 'storefront' } })).toThrow('CONTRACT_INVALID');
  });
});
