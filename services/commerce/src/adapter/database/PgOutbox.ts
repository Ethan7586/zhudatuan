import type { QueryResultRow } from 'pg';
import { retryDelay } from '../../foundation/performance/Retry';
import type { DomainEvent } from '../../foundation/domain/DomainEvent';
import type { OutboxMessage, OutboxWriter } from '../../foundation/messaging/Outbox';
import type { DeadletterStore } from '../../foundation/application/DeadletterStore';
import { PgDeadletterStore } from './PgDeadletterStore';
import { safeErrorCode } from '../../foundation/domain/SafeError';
import { parseEventPayload } from '@shop/contract';
import type { WriteTransactionContext } from '../../foundation/persistence/TransactionContext';
import type { TransactionManager } from '../../foundation/persistence/TransactionManager';
import { PgTransactionAccess } from './PgTransactionAccess';

interface PgOutboxRow extends QueryResultRow, OutboxMessage {}

export class PgOutbox implements OutboxWriter {
  private readonly transactions = new PgTransactionAccess();

  constructor(
    private readonly manager: TransactionManager,
    private readonly deadletters: DeadletterStore = new PgDeadletterStore()
  ) {}

  claim(owner: string, batch: number, signal: AbortSignal, deadline: number, leaseSeconds = 30): Promise<readonly OutboxMessage[]> {
    if (!owner || !Number.isSafeInteger(batch) || batch < 1 || batch > 1000 || !Number.isSafeInteger(leaseSeconds) || leaseSeconds < 5 || leaseSeconds > 900) {
      throw new Error('OUTBOX_CLAIM_INVALID');
    }
    return this.manager.write(runtimeOptions(owner, signal, deadline, 'claim'), async (context) => {
      const result = await this.transactions.database(context).query<PgOutboxRow>(
        `with eligible as (
        select target.id,row_number() over(partition by target.aggregate_id order by target.occurred_at,target.id) aggregate_sequence
        from runtime.outbox target where target.published_at is null and target.failed_at is null and target.available_at<=clock_timestamp()
          and (target.claim_until is null or target.claim_until<=clock_timestamp())
          and not exists(select 1 from runtime.outbox earlier where earlier.aggregate_id=target.aggregate_id and earlier.published_at is null
            and earlier.failed_at is null and (earlier.occurred_at,earlier.id)<(target.occurred_at,target.id))
      ), candidates as (
        select id from eligible where aggregate_sequence=1 order by id for update skip locked limit $1
      ) update runtime.outbox target set claimed_by=$2,claim_until=clock_timestamp()+make_interval(secs=>$3),attempts=target.attempts+1,
        fencing_token=target.fencing_token+1
        from candidates where target.id=candidates.id returning target.id,target.event_type,target.event_version,target.aggregate_id,target.scope_id,
        target.actor_id,target.correlation_id,target.causation_id,target.payload_version,target.payload,target.trace_id,target.attempts,
        target.aggregate_version,target.fencing_token`,
        [batch, owner, leaseSeconds]
      );
      return result.rows;
    });
  }

  published(event: OutboxMessage, owner: string, signal: AbortSignal, deadline: number): Promise<void> {
    return this.manager.write(runtimeOptions(owner, signal, deadline, 'published'), async (context) => {
      const result = await this.transactions.database(context).query(
        `update runtime.outbox set published_at=clock_timestamp(),claimed_by=null,claim_until=null
        where id=$1 and claimed_by=$2 and fencing_token=$3 and published_at is null`,
        [event.id, owner, event.fencing_token]
      );
      if (result.rowCount !== 1) throw new Error('OUTBOX_LEASE_LOST');
    });
  }

  fail(event: OutboxMessage, owner: string, cause: unknown, signal: AbortSignal, deadline: number, maximumAttempts = 8): Promise<void> {
    const error = safeErrorCode(cause, 'OUTBOX_PUBLISH_FAILED');
    const terminal = event.attempts >= maximumAttempts;
    return this.manager.write(runtimeOptions(owner, signal, deadline, 'fail'), async (context) => {
      if (terminal) await this.deadletters.record(context, { id: `outbox:${event.id}`, kind: 'outbox', source: event.id, owner: 'runtime', payload: event.payload, error, attempts: event.attempts });
      const delay = retryDelay(event.attempts, 250, 60_000);
      const result = await this.transactions.database(context).query(
        `update runtime.outbox set claimed_by=null,claim_until=null,error_code=$3,
        failed_at=case when $4 then clock_timestamp() else null end,
        available_at=case when $4 then available_at else clock_timestamp()+make_interval(secs=>$5::double precision/1000) end
        where id=$1 and claimed_by=$2 and fencing_token=$6`,
        [event.id, owner, error, terminal, delay, event.fencing_token]
      );
      if (result.rowCount !== 1) throw new Error('OUTBOX_LEASE_LOST');
    });
  }
  async append(context: WriteTransactionContext, event: DomainEvent): Promise<void> {
    const transaction = this.transactions.database(context);
    const payload = parseEventPayload(event.type, event.payload);
    await transaction.query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,scope_id,payload,
      trace_id,actor_id,correlation_id,causation_id,payload_version,occurred_at,available_at)
      values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,clock_timestamp())`,
      [
        event.event,
        event.type,
        event.version,
        event.aggregate.type,
        event.aggregate.id,
        event.aggregate.version,
        event.tenant,
        JSON.stringify(payload),
        event.trace,
        event.actor,
        event.correlation,
        event.causation,
        event.payloadVersion,
        event.occurred,
      ]
    );
  }
}

function runtimeOptions(owner: string, signal: AbortSignal, deadline: number, action: string) {
  return { tenant: '', membership: '', scope: 'runtime', actor: owner, trace: `outbox:${owner}`, operation: `runtime.outbox.${action}`, deadline, signal, workload: 'jobs' as const };
}
