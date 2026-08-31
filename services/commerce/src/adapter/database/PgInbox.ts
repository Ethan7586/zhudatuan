import type { Inbox } from '../../foundation/messaging/Inbox';
import type { OutboxMessage } from '../../foundation/messaging/Outbox';
import type { Transaction } from '../../foundation/persistence/UnitOfWork';

export class PgInbox implements Inbox {
  async accept(transaction: Transaction, provider: string, operation: string, event: OutboxMessage): Promise<boolean> {
    if (!provider || !operation) throw new Error('INBOX_IDENTITY_INVALID');
    const result = await transaction.query<{ inserted: boolean }>('select runtime.accept_inbox($1,$2,$3,$4,$5,$6,$7::jsonb) inserted', [
      provider,
      event.id,
      operation,
      event.event_type,
      event.event_version,
      event.trace_id,
      JSON.stringify(event.payload),
    ]);
    return result.rows[0]?.inserted === true;
  }

  async complete(transaction: Transaction, provider: string, operation: string, event: string): Promise<void> {
    const result = await transaction.query(
      `update runtime.inbox set processed_at=clock_timestamp(),attempts=attempts+1
      where provider=$1 and operation=$2 and event_id=$3 and processed_at is null`,
      [provider, operation, event]
    );
    if (result.rowCount !== 1) throw new Error('INBOX_NOT_PENDING');
  }
}
