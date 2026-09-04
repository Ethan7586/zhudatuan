import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { PgFederationRepository } from '../infrastructure/persistence/PgFederationRepository';
import { withReadTransaction } from '../../../test/TransactionFixture';

describe('federation callback replay', () => {
  it('distinguishes a consumed Wechat/OIDC state from an unknown state without reopening the transaction', async () => {
    let query = 0;
    const repository = new PgFederationRepository({} as never, {} as never);
    await expect(withReadTransaction(async () => {
      query += 1;
      return (query === 1
        ? { rows: [], rowCount: 0 }
        : { rows: [{ status: 'completed', expires_at: new Date('2099-01-01T00:00:00.000Z'), consumed_at: new Date('2026-09-04T00:00:00.000Z') }], rowCount: 1 }) as unknown as QueryResult;
    }, (context) => repository.pending(context, 'provider:wechat', Buffer.alloc(32, 7)))).rejects.toThrow('FEDERATION_TRANSACTION_CONSUMED');
    expect(query).toBe(2);
  });
});
