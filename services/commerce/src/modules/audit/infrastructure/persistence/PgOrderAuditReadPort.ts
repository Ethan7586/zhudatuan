import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OrderAuditReadPort } from '../../public';

export class PgOrderAuditReadPort implements OrderAuditReadPort {
  private readonly transactions = new PgTransactionAccess();

  async timeline(context: ReadTransactionContext, scope: string, resources: readonly string[]) {
    if (resources.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<{
      id: string;
      action: string;
      resourceType: string;
      resourceMasked: string | null;
      actorMasked: string;
      occurredAt: string;
      traceMasked: string;
    }>(
      `select id,action,resource_type "resourceType",
      case when resource_id is null then null else resource_type||' ····'||right(resource_id,4) end "resourceMasked",
      actor_type||' ····'||right(actor_id,4) "actorMasked",recorded_at "occurredAt",
      '追踪 ····'||right(trace_id,4) "traceMasked"
      from audit.record where scope_id=$1 and resource_id=any($2::text[])
      order by recorded_at desc,id desc limit 100`,
      [scope, resources]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
}
