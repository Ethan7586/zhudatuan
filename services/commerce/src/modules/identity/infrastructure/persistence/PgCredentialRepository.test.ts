import { describe, expect, it, vi } from 'vitest';
import { PgCredentialRepository } from './PgCredentialRepository';
import { withReadTransaction } from '../../../../test/TransactionFixture';

describe('PgCredentialRepository principal lookup', () => {
  it('uses canonical password and OTP subject indexes without accepting collisions', async () => {
    const repository = new PgCredentialRepository();
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ principal_id: 'principal:one' }] })
      .mockResolvedValueOnce({ rows: [{ principal_id: 'principal:one' }, { principal_id: 'principal:two' }] });
    await expect(withReadTransaction(query, (context) => repository.principalForSubject(context, 'a'.repeat(64)))).resolves.toBe('principal:one');
    await expect(withReadTransaction(query, (context) => repository.principalForSubject(context, 'b'.repeat(64)))).resolves.toBeNull();
    expect(query.mock.calls[0]?.[0]).toContain("credential.provider in('password','otp')");
  });
});
