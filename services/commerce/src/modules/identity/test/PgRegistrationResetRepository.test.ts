import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { PgRegistrationResetRepository } from '../infrastructure/persistence/PgRegistrationResetRepository';
import { withWriteTransaction } from '../../../test/TransactionFixture';

describe('PgRegistrationResetRepository', () => {
  it('requires recent actor password assurance and hard-resets login data with principal CAS while retaining history', async () => {
    const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    const query = async (text: string, values: readonly unknown[] = []) => {
      queries.push({ text, values });
      if (text.includes('from identity.principal target')) return result([{ id: 'principal:target', version: 7, password_verified: true }]);
      if (text.includes('returning id,credential_version,version')) return result([{ id: 'principal:target', credential_version: 9, version: 8 }]);
      return result([]);
    };
    const repository = new PgRegistrationResetRepository();
    const receipt = await withWriteTransaction(query, async (context) => {
      await repository.lock(context, 'membership:target');
      const target = await repository.target(context, 'principal:target', 'principal:owner');
      return repository.reset(context, target, 'reset-salt');
    });

    expect(receipt).toEqual({ principal: 'principal:target', credentialVersion: 9, version: 8 });
    expect(queries[0]).toMatchObject({ values: ['identity-registration:membership:target'] });
    expect(queries[1]!.text).toContain("proof.method='password'");
    expect(queries[1]!.text).toContain("interval '10 minutes'");
    expect(queries[2]!.text).toContain("identity.credential set status='revoked'");
    expect(queries[2]!.text).toContain('secret_hash=null');
    expect(queries[3]!.text).toContain("identity.federatedidentity set status='revoked'");
    expect(queries[4]!.text).toContain("revoked_reason=coalesce(revoked_reason,'registration_reset')");
    expect(queries[5]!.text).toContain("where id=$1 and version=$2 and status in('pending','active')");
    expect(queries.every(({ text }) => !/\bdelete\b/i.test(text))).toBe(true);
  });

  it('rejects self reset and missing password assurance before mutating credentials', async () => {
    const query = vi.fn(async () => result([{ id: 'principal:target', version: 1, password_verified: false }]));
    const repository = new PgRegistrationResetRepository();
    await expect(withWriteTransaction(query, (context) => repository.target(context, 'principal:owner', 'principal:owner'))).rejects.toThrow('OWNER_MEMBERSHIP_PROTECTED');
    expect(query).not.toHaveBeenCalled();
    await expect(withWriteTransaction(query, (context) => repository.target(context, 'principal:target', 'principal:owner'))).rejects.toThrow('STEPUP_REQUIRED');
    expect(query).toHaveBeenCalledOnce();
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
