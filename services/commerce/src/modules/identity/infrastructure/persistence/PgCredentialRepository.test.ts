import { describe, expect, it, vi } from 'vitest';
import { PgCredentialRepository } from './PgCredentialRepository';

describe('PgCredentialRepository principal lookup', () => {
  it('uses canonical password and OTP subject indexes without accepting collisions', async () => {
    const repository = new PgCredentialRepository();
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ principal_id: 'principal:one' }] })
      .mockResolvedValueOnce({ rows: [{ principal_id: 'principal:one' }, { principal_id: 'principal:two' }] });
    const database = { query } as never;

    await expect(repository.principalForSubject(database, 'a'.repeat(64))).resolves.toBe('principal:one');
    await expect(repository.principalForSubject(database, 'b'.repeat(64))).resolves.toBeNull();
    expect(query.mock.calls[0]?.[0]).toContain("credential.provider in('password','otp')");
  });
});
