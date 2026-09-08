import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
export class ListingWithdrawal {
  private readonly transactions = new PgTransactionAccess();
  async execute(
    context: WriteTransactionContext,
    command: Readonly<{
      decision: string;
      scope: string;
      listing: string;
      proof: string;
      action: 'suggestunlist';
      evidenceHash: string;
    }>
  ): Promise<void> {
    const database = this.transactions.database(context);
    if (!command.decision || !command.scope || !command.listing || !command.proof || command.action !== 'suggestunlist' || !/^[0-9a-f]{64}$/.test(command.evidenceHash)) {
      throw new Error('CATALOG_RISK_COMMAND_INVALID');
    }
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

  async qualification(
    context: WriteTransactionContext,
    command: Readonly<{
      event: string;
      qualification: string;
      scope: string;
      subjectKind: string;
      subjectId: string;
      productIds: readonly string[];
      categoryIds: readonly string[];
      regionIds: readonly string[];
    }>
  ): Promise<number> {
    if (!command.event || !command.qualification || !command.scope) throw new Error('CATALOG_QUALIFICATION_COMMAND_INVALID');
    const global = command.regionIds.length > 0 || command.subjectKind === 'region';
    const database = this.transactions.database(context);
    const result = await database.query<{ id: string; version: number }>(
      `update catalog.listing listing set status='unpublished',expires_at=clock_timestamp(),version=listing.version+1,updated_at=clock_timestamp()
       from catalog.sku sku join catalog.product product on product.id=sku.product_id
       where listing.sku_id=sku.id and listing.scope_id=$1 and listing.status='published' and(
         $5::boolean or product.id=any($2::text[]) or product.category_id=any($3::text[])
         or ($4='partner' and product.owner_partner_id=$6)
       ) returning listing.id,listing.version`,
      [command.scope, command.productIds, command.categoryIds, command.subjectKind, global, command.subjectId]
    );
    await new PgRuntimeWriter(database).appendMany(
      result.rows.map((listing) => ({
        id: `event:catalog:qualification:${command.event}:${listing.id}`,
        type: 'catalog.listing.unpublished',
        aggregateType: 'listing',
        aggregate: listing.id,
        aggregateVersion: Number(listing.version),
        scope: command.scope,
        payload: Object.freeze({ listing: listing.id, reason: 'qualification', decision: command.event }),
        trace: command.event,
        actor: 'job:riskscan',
        correlation: command.event,
        causation: command.event,
      }))
    );
    return result.rows.length;
  }
}
