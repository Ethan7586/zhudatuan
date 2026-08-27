import type { Transaction } from '../application/UnitOfWork';
import type { OutboxEvent } from './OutboxStore';

export class InboxStore {
  async accept(transaction: Transaction, consumer: string, event: OutboxEvent): Promise<boolean> {
    if (!consumer) throw new Error('INBOX_CONSUMER_INVALID');
    const result = await transaction.query<{ inserted: boolean }>('select runtime.accept_inbox($1,$2,$3,$4,$5,$6::jsonb) inserted',
    [consumer, event.id, event.event_type, event.event_version, event.trace_id, JSON.stringify(event.payload)]);
    return result.rows[0]?.inserted === true;
  }

  async complete(transaction: Transaction, consumer: string, event: string): Promise<void> {
    const result = await transaction.query(`update runtime.inbox set processed_at=clock_timestamp(),attempts=attempts+1
      where consumer=$1 and event_id=$2 and processed_at is null`, [consumer, event]);
    if (result.rowCount !== 1) throw new Error('INBOX_NOT_PENDING');
  }
}
