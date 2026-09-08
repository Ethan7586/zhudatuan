import { describe, expect, it, vi } from 'vitest';
import { PgCredentialRepository } from './PgCredentialRepository';
import { withReadTransaction, withWriteTransaction } from '../../../../test/TransactionFixture';

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

  it('loads password material without a row lock and confirms its version under a write lock', async () => {
    const repository = new PgCredentialRepository();
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 'credential:one', principal_id: 'principal:one', secret_hash: 'encoded', credential_version: 7 }] })
      .mockResolvedValueOnce({ rows: [{ exists: 1 }] });

    const loaded = await withReadTransaction(query, (context) => repository.matchPassword(context, ['subject:one']));
    const confirmed = await withWriteTransaction(query, (context) => repository.confirmPassword(context, loaded!));

    expect(loaded).toEqual({ id: 'credential:one', principal: 'principal:one', secretHash: 'encoded', version: 7 });
    expect(confirmed).toBe(true);
    expect(String(query.mock.calls[0]?.[0])).not.toContain('for update');
    expect(String(query.mock.calls[1]?.[0])).toContain('for update of credential,principal');
  });
});
