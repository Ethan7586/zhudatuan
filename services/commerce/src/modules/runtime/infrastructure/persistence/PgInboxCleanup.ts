import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { InboxCleanup, InboxCleanupKey } from '../../application/port/CleanupPort';
import { cleanupLimit } from './PgCleanupValue';
import { retentionBoundary } from './PgMessageRetention';

export class PgInboxCleanup implements InboxCleanup {
  constructor(private readonly transactions = new PgTransactionAccess()) {}
  async plan(context: ReadTransactionContext, before: Date, limit: number): Promise<readonly InboxCleanupKey[]> {
    cleanupLimit(limit);
    const result = await this.transactions.database(context).query<{ consumer: string; event: string }>(
      `select consumer,event_id event from runtime.inbox where processed_at is not null and processed_at<$1
       order by processed_at,consumer,event_id limit $2`,
      [retentionBoundary(before), limit]
    );
    return inboxKeys(result.rows);
  }

  async purge(context: WriteTransactionContext, keys: readonly InboxCleanupKey[], before: Date): Promise<number> {
    const planned = inboxKeys(keys);
    if (planned.length === 0) return 0;
    const result = await this.transactions.database(context).query(
      `delete from runtime.inbox where processed_at is not null and processed_at<$2
       and (consumer,event_id) in(select value->>'consumer',value->>'event' from jsonb_array_elements($1::jsonb) value)
       returning event_id`,
      [JSON.stringify(planned), retentionBoundary(before)]
    );
    return result.rows.length;
  }
}

function inboxKeys(rows: readonly InboxCleanupKey[]): readonly InboxCleanupKey[] {
  const values = rows.map(({ consumer, event }) => Object.freeze({ consumer, event }));
  const identities = values.map(({ consumer, event }) => JSON.stringify([consumer, event]));
  if (values.length > 5000 || new Set(identities).size !== values.length || values.some(({ consumer, event }) => [consumer, event].some((value) => typeof value !== 'string' || value.length < 1)))
    throw new Error('CLEANUP_INBOX_SET_INVALID');
  return Object.freeze(values);
}
