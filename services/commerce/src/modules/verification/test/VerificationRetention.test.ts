import { describe, expect, it, vi } from 'vitest';
import { result, withWriteTransaction } from '../../../test/TransactionFixture';
import { PgVerificationRetentionPort } from '../infrastructure/persistence/PgVerificationRetentionPort';

describe('verification runtime retention', () => {
  it('expires active records before purging old proofs and token material', async () => {
    const query = vi.fn(async (_sql: string, _params?: readonly unknown[]) => result([]));
    await withWriteTransaction(query, (context) => new PgVerificationRetentionPort().purge(context));
    expect(query.mock.calls.map(([sql]) => String(sql))).toEqual([
      expect.stringContaining("update verification.session set state='expired'"),
      expect.stringContaining("update verification.proof set state='expired'"),
      expect.stringContaining('delete from verification.proof'),
      expect.stringContaining('delete from verification.token'),
    ]);
  });
});
