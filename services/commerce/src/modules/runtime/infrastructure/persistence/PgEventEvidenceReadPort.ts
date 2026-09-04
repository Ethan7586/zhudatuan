import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { EventEvidenceReadPort, RuntimeEventEvidence } from '../../public';

interface EventEvidenceRow extends Omit<RuntimeEventEvidence, 'occurredAt'> {
  readonly occurredAt: Date;
}

export class PgEventEvidenceReadPort implements EventEvidenceReadPort {
  private readonly transactions = new PgTransactionAccess();

  async events(context: ReadTransactionContext, scopes: readonly string[], resources: readonly string[]) {
    if (scopes.length === 0 || resources.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<EventEvidenceRow>(
      `select id,type,event_version "eventVersion",aggregate_type "aggregateType",aggregate_id "aggregateId",state,
      occurred_at "occurredAt",trace_id "traceId"
      from runtime.event_evidence($1::text[],$2::text[])`,
      [scopes, resources]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row, occurredAt: row.occurredAt.toISOString() })));
  }
}
