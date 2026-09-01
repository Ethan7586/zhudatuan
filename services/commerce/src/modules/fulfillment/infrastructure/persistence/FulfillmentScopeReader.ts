import { type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

import { DomainError } from '../../../../foundation/domain/DomainError';

import type { FulfillmentOrderPort } from '../../../order/public';
import type { OrganizationReadPort } from '../../../organization/public';
export interface ManagedFulfillment {
  readonly id: string;
  readonly order: string;
  readonly partner: string | null;
  readonly store: string | null;
  readonly state: string;
  readonly version: number;
}
export interface ManagedReturn extends ManagedFulfillment {
  readonly returnId: string;
  readonly returnState: string;
  readonly returnVersion: number;
}
export class FulfillmentScopeReader {
  private readonly transactions = new PgTransactionAccess();
  constructor(
    readonly orders: FulfillmentOrderPort,
    private readonly organizations: OrganizationReadPort
  ) {}
  async member(context: ReadTransactionContext, order: string, member: string): Promise<void> {
    const database = this.transactions.database(context);
    const snapshot = await this.orders.snapshot(database.transaction, order);
    if (!snapshot || snapshot.member !== member) throw new DomainError('RESOURCE_NOT_FOUND');
  }
  async fulfillment(context: WriteTransactionContext, id: string, scope: string): Promise<ManagedFulfillment> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
      order: string;
      partner: string | null;
      store: string | null;
      state: string;
      version: number;
    }>(
      `select id,order_id "order",partner_id partner,store_id store,state,version::float8 version
      from fulfillment.fulfillmentorder where id=$1 for update`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    await this.authorize(database, row, scope);
    return Object.freeze(row);
  }
  async returned(context: WriteTransactionContext, id: string, scope: string): Promise<ManagedReturn> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
      order: string;
      partner: string | null;
      store: string | null;
      state: string;
      version: number;
      returnId: string;
      returnState: string;
      returnVersion: number;
    }>(
      `select fulfillment.id,fulfillment.order_id "order",fulfillment.partner_id partner,fulfillment.store_id store,
      fulfillment.state,fulfillment.version::float8 version,returned.id "returnId",returned.state "returnState",
      returned.version::float8 "returnVersion"
      from fulfillment.returnrecord returned join fulfillment.fulfillmentorder fulfillment on fulfillment.id=returned.fulfillment_id
      where returned.id=$1 for update of returned,fulfillment`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    await this.authorize(database, row, scope);
    return Object.freeze(row);
  }
  private async authorize(database: SqlExecutor, fulfillment: ManagedFulfillment, scope: string): Promise<void> {
    if (fulfillment.partner === scope || fulfillment.store === scope) return;
    const order = await this.orders.snapshot(database.transaction, fulfillment.order);
    if (!order) throw new DomainError('RESOURCE_NOT_FOUND');
    const descendants = await this.organizations.descendants(database.transaction, scope);
    if (!descendants.includes(order.scope)) throw new DomainError('RESOURCE_NOT_FOUND');
  }
}
