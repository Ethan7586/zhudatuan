import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { PgNotificationIdentity } from '../infrastructure/persistence/PgNotificationIdentity';
import { withWriteTransaction } from '../../../test/TransactionFixture';

describe('IdentityNotificationPort attempt state', () => {
  it('atomically fences a prior sending attempt as ambiguous before considering a new send', async () => {
    const query = vi.fn<(text: string, values?: readonly unknown[]) => Promise<QueryResult>>(async () => result([]));
    const port = new PgNotificationIdentity();

    await withWriteTransaction(query, (context) => port.beginAttempt(context, 'challenge:one', 'aliyun'));

    const [sql, values] = query.mock.calls[0]!;
    expect(sql).toContain("update identity.challengedelivery set state='ambiguous'");
    expect(sql).toContain("state in('sent','ambiguous')");
    expect(sql).toContain('select $1,coalesce((select max(sequence)');
    expect(sql).toContain('where not exists(select 1 from terminal)');
    expect(values).toEqual(['challenge:one', 'aliyun']);
  });

  it('only completes, fails or marks ambiguous from the sending state', async () => {
    const query = vi.fn<(text: string, values?: readonly unknown[]) => Promise<QueryResult>>(async () => result([]));
    const port = new PgNotificationIdentity();
    await withWriteTransaction(query, (context) => port.completeAttempt(context, 'challenge:one', 1, 'aliyun', 'sms:one'));
    await withWriteTransaction(query, (context) => port.failAttempt(context, 'challenge:one', 1, 'SEND_FAILED'));
    await withWriteTransaction(query, (context) => port.ambiguousAttempt(context, 'challenge:one', 1, 'SEND_UNKNOWN'));

    expect(query.mock.calls.every(([sql]) => sql.includes("state='sending' returning"))).toBe(true);
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
