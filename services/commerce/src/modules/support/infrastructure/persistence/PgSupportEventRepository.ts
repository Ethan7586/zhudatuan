import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { SupportEventStore } from '../../application/port/SupportPersistence';

export class PgSupportEventRepository implements SupportEventStore {
  private readonly transactions = new PgTransactionAccess();
  async history(context: WriteTransactionContext, ticket: string, scope: string, kind: string, actor: string, evidence: Readonly<Record<string, unknown>>): Promise<void> {
    await this.transactions.database(context).query(
      `insert into support.history(ticket_id,sequence,kind,actor_id,evidence,occurred_at,scope_id)
      select $1,coalesce(max(sequence),0)+1,$3,$4,$5::jsonb,clock_timestamp(),$2 from support.history where ticket_id=$1`,
      [ticket, scope, kind, actor, JSON.stringify(evidence)]
    );
  }

  async append(
    context: WriteTransactionContext,
    input: Readonly<{ type: string; aggregateType: 'ticket' | 'conversation' | 'evidence'; aggregate: string; scope: string; trace: string; payload: Readonly<Record<string, unknown>> }>
  ): Promise<void> {
    const writer = new PgRuntimeWriter(this.transactions.database(context));
    const id = `event:${randomUUID()}`;
    await writer.append({ id, ...input });
    await writer.schedule({ id: `job:relay:${id}`, kind: 'supportrelay', owner: 'support', scope: input.scope, payload: { event: id }, priority: 20 });
  }

  enqueue(context: WriteTransactionContext, kind: 'supportsla' | 'supportscan' | 'supportreassign' | 'supportrelay', scope: string, payload: Readonly<Record<string, unknown>>, availableAt?: Date | string, stableId?: string): Promise<void> {
    return new PgRuntimeWriter(this.transactions.database(context)).schedule({
      id: stableId ?? `job:${randomUUID()}`,
      kind,
      owner: 'support',
      scope,
      payload,
      priority: 10,
      ...(availableAt === undefined ? {} : { availableAt: availableAt instanceof Date ? availableAt.toISOString() : availableAt }),
    });
  }
}
