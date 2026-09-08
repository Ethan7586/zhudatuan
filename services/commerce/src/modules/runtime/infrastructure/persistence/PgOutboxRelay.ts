import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { OutboxRelayPort, RelayOutboxEvent } from '../../public';

export class PgOutboxRelay implements OutboxRelayPort {
  private readonly transactions = new PgTransactionAccess();

  async claim(context: WriteTransactionContext, input: Readonly<{ event: string; worker: string; prefix: string }>): Promise<RelayOutboxEvent | null> {
    const result = await this.transactions.database(context).query<{
      id: string;
      event_type: string;
      event_version: number;
      scope_id: string;
      aggregate_id: string;
      payload: Record<string, unknown>;
      occurred_at: string;
    }>(
      `update runtime.outbox set realtime_claimed_by=$2,realtime_claim_until=clock_timestamp()+interval '30 seconds',realtime_attempts=realtime_attempts+1
      where id=$1 and event_type like $3||'%' and realtime_published_at is null
      and (realtime_claim_until is null or realtime_claim_until<clock_timestamp())
      returning id,event_type,event_version,scope_id,aggregate_id,payload,occurred_at`,
      [input.event, input.worker, input.prefix]
    );
    const row = result.rows[0];
    return row
      ? Object.freeze({ id: row.id, type: row.event_type, version: Number(row.event_version), scope: row.scope_id, aggregate: row.aggregate_id, payload: Object.freeze(row.payload), occurredAt: new Date(row.occurred_at).toISOString() })
      : null;
  }

  async complete(context: WriteTransactionContext, input: Readonly<{ event: string; worker: string; cursor: string }>): Promise<void> {
    const result = await this.transactions.database(context).query(
      `update runtime.outbox set realtime_published_at=clock_timestamp(),realtime_cursor=$3,realtime_claimed_by=null,realtime_claim_until=null,realtime_error=null
      where id=$1 and realtime_claimed_by=$2 and realtime_published_at is null`,
      [input.event, input.worker, input.cursor]
    );
    if (result.rowCount !== 1) throw new Error('OUTBOX_RELAY_LEASE_LOST');
  }

  async fail(context: WriteTransactionContext, input: Readonly<{ event: string; worker: string; reason: string }>): Promise<void> {
    await this.transactions.database(context).query(
      `update runtime.outbox set realtime_claimed_by=null,realtime_claim_until=null,realtime_error=$3
      where id=$1 and realtime_claimed_by=$2 and realtime_published_at is null`,
      [input.event, input.worker, input.reason]
    );
  }
}
