import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
export class CatalogRiskDecisionService {
  private readonly transactions = new PgTransactionAccess();
  async execute(
    context: WriteTransactionContext,
    command: Readonly<{
      decision: string;
      scope: string;
      listing: string;
    }>
  ): Promise<void> {
    const database = this.transactions.database(context);
    if (!command.decision || !command.scope || !command.listing) throw new Error('CATALOG_RISK_COMMAND_INVALID');
    const result = await database.query(
      `update catalog.listing set status='unpublished',expires_at=clock_timestamp(),version=version+1,
      updated_at=clock_timestamp() where id=$1 and scope_id=$2 and status='published' returning id`,
      [command.listing, command.scope]
    );
    if (result.rowCount === 0) return;
    await new PgRuntimeWriter(database).append({
      id: `event:catalog:risk:${command.decision}`,
      type: 'catalog.listing.unpublished',
      aggregateType: 'listing',
      aggregate: command.listing,
      scope: command.scope,
      payload: Object.freeze({ listing: command.listing, reason: 'risk', decision: command.decision }),
      trace: command.decision,
    });
  }
}
