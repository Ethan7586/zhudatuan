import { createHash } from 'node:crypto';
import type { IdempotencyClaim, IdempotencyRepository, IdempotencyState } from '../../pipeline/IdempotencyRepository';
import type { OperationReply } from '../../pipeline/OperationHandler';
import type { WriteTransactionContext } from '../../platform/database/TransactionContext';
import { DomainError } from '../../platform/error/DomainError';
import { PgTransactionAccess } from './PgTransactionAccess';

interface IdempotencyRow {
  readonly request_hash: string;
  readonly state: 'started' | 'checkpointed' | 'completed';
  readonly response: OperationReply<unknown> | null;
}

export class PgIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}

  async claim(context: WriteTransactionContext, claim: IdempotencyClaim): Promise<IdempotencyState> {
    const database = this.transactions.database(context);
    await database.query(
      `insert into runtime.idempotency(scope,actor_id,operation,key,request_hash,state,expires_at)
      values($1,$2,$3,$4,$5,'started',clock_timestamp()+interval '24 hours') on conflict do nothing`,
      [claim.scope, claim.actor, claim.operation, claim.key, claim.requestHash]
    );
    const result = await database.query<IdempotencyRow & Record<string, unknown>>('select request_hash,state,response from runtime.idempotency where scope=$1 and actor_id=$2 and operation=$3 and key=$4 for update', [
      claim.scope,
      claim.actor,
      claim.operation,
      claim.key,
    ]);
    const row = result.rows[0];
    if (!row || row.request_hash !== claim.requestHash) throw new DomainError('IDEMPOTENCY_CONFLICT');
    if (row.state === 'started') return Object.freeze({ state: 'started' });
    if (row.response === null) throw new Error('IDEMPOTENCY_RESPONSE_MISSING');
    return Object.freeze({ state: row.state, response: row.response });
  }

  checkpoint(context: WriteTransactionContext, claim: IdempotencyClaim, response: OperationReply<unknown>): Promise<void> {
    return this.finish(context, claim, response, 'checkpointed');
  }

  complete(context: WriteTransactionContext, claim: IdempotencyClaim, response: OperationReply<unknown>): Promise<void> {
    return this.finish(context, claim, response, 'completed');
  }

  private async finish(context: WriteTransactionContext, claim: IdempotencyClaim, response: OperationReply<unknown>, state: 'checkpointed' | 'completed'): Promise<void> {
    const serialized = JSON.stringify(response);
    const result = await this.transactions.database(context).query(
      `update runtime.idempotency set state=$5,response=$6::jsonb,checkpoint=$7::jsonb,response_hash=$8
      where scope=$1 and actor_id=$2 and operation=$3 and key=$4 and request_hash=$9`,
      [claim.scope, claim.actor, claim.operation, claim.key, state, serialized, JSON.stringify({ phase: state }), createHash('sha256').update(serialized).digest('hex'), claim.requestHash]
    );
    if (result.rowCount !== 1) throw new Error('IDEMPOTENCY_CLAIM_MISSING');
  }
}
