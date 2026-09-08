import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { Clock } from '@shop/kernel';
import { SystemClock } from '@shop/kernel';
import { DomainError } from '../../../../platform/error/DomainError';
import { boundedIdentifiers } from '../../../../platform/database/BoundedIdentifiers';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { StockItem } from '../../domain/model/StockItem';
import { StockSource } from '../../domain/model/StockSource';
import { appendMovements } from './InventoryLedger';
import { inventoryDigest, restoreStock, stockEvent, type StockRow } from './InventoryRecord';

export class PgStockRepository {
  constructor(
    private readonly transactions = new PgTransactionAccess(),
    private readonly clock: Clock = new SystemClock()
  ) {}

  async availability(context: ReadTransactionContext, scope: string, skus: readonly string[]) {
    const selected = boundedIdentifiers(skus, 200, 'INVENTORY_AVAILABILITY_SKUS_INVALID');
    if (selected.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<{
      sku: string;
      stockitem: string;
      onhand: number;
      safety: number;
      reserved: number;
      version: number;
    }>(
      `select distinct on(stock.sku_id) stock.sku_id sku,stock.id stockitem,stock.onhand::float8 onhand,
      stock.safety::float8 safety,coalesce(sum(reservation.quantity) filter(where reservation.state='reserved'
      and reservation.expires_at>clock_timestamp()),0)::float8 reserved,stock.version::integer version
      from inventory.stockitem stock left join inventory.reservation reservation on reservation.stockitem_id=stock.id
      where stock.scope_id=$1 and stock.sku_id=any($2::text[]) and stock.status='active'
      group by stock.id order by stock.sku_id,
      stock.onhand-stock.safety-coalesce(sum(reservation.quantity) filter(where reservation.state='reserved'
      and reservation.expires_at>clock_timestamp()),0) desc,stock.id`,
      [scope, selected]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }

  async stock(context: ReadTransactionContext, skus: readonly string[], scopes: readonly string[]): Promise<readonly Readonly<Record<string, unknown>>[]> {
    const selectedSkus = boundedIdentifiers(skus, 200, 'INVENTORY_STOCK_SKUS_INVALID');
    const selectedScopes = boundedIdentifiers(scopes, 50, 'INVENTORY_STOCK_SCOPES_INVALID');
    if (selectedSkus.length === 0 || selectedScopes.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query(
      `select stock.sku_id sku,stock.scope_id scope,stock.location_id location,stock.onhand::text onhand,stock.safety::text safety,
      coalesce(reservation.quantity,0)::text reserved,stock.status,stock.version::text version,stock.updated_at watermark
      from inventory.stockitem stock left join lateral(select sum(value.quantity) quantity from inventory.reservation value
        where value.stockitem_id=stock.id and value.state='reserved' and value.expires_at>clock_timestamp()) reservation on true
      where stock.sku_id=any($1::text[]) and stock.scope_id=any($2::text[]) order by stock.scope_id,stock.location_id,stock.sku_id`,
      [selectedSkus, selectedScopes]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }

  async observe(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; sku: string; location: string; onhand: number; safety: number; provider: string; version: string }>): Promise<void> {
    const database = this.transactions.database(context);
    const now = this.clock.now().toISOString();
    const current = await database.query<StockRow>(
      `select stock.id,stock.scope_id,stock.sku_id,stock.location_id,stock.onhand::float8 onhand,stock.safety::float8 safety,
       coalesce(reservation.quantity,0)::float8 reserved,stock.version::integer,stock.status,stock.updated_at
       from inventory.stockitem stock left join lateral(select sum(value.quantity) quantity from inventory.reservation value
         where value.stockitem_id=stock.id and value.state='reserved' and value.expires_at>clock_timestamp()) reservation on true
       where stock.scope_id=$1 and stock.sku_id=$2 and stock.location_id=$3 for update of stock`,
      [input.scope, input.sku, input.location]
    );
    const existing = current.rows[0];
    const stock = existing ? restoreStock(existing) : StockItem.create({ id: input.id, scope: input.scope, sku: input.sku, location: input.location, onhand: input.onhand, safety: input.safety, state: 'active', updatedAt: now });
    const source = StockSource.observe({
      id: `source:${inventoryDigest(`${stock.snapshot().id}:${input.provider}:${input.version}`)}`,
      stockitem: stock.snapshot().id,
      provider: input.provider,
      reference: input.version,
      onhand: input.onhand,
      observedAt: now,
    }).snapshot();
    if (!existing) {
      const created = stock.snapshot();
      await database.query(
        `insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [created.id, created.scope, created.sku, created.location, created.onhand, created.safety, created.version, created.state, created.updatedAt]
      );
    }
    const observation = await database.query(
      `insert into inventory.snapshot(stockitem_id,observed_at,source,onhand,source_version)
       values($1,$2,$3,$4,$5) on conflict(stockitem_id,source,source_version) do nothing returning stockitem_id`,
      [source.stockitem, source.observedAt, source.provider, source.onhand, source.reference]
    );
    if (!observation.rows[0]) return;
    const changed = existing ? stock.observe({ onhand: input.onhand, safety: input.safety, at: now }, existing.reserved) : stock;
    const delta = input.onhand - (existing?.onhand ?? 0);
    if (existing && changed !== stock) {
      const next = changed.snapshot();
      const result = await database.query(
        `update inventory.stockitem set onhand=$2,safety=$3,status=$4,version=$5,updated_at=$6
        where id=$1 and version=$7 returning id`,
        [next.id, next.onhand, next.safety, next.state, next.version, next.updatedAt, stock.snapshot().version]
      );
      if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
    }
    if (delta !== 0)
      await appendMovements(database, [{ id: `movement:${source.id.slice('source:'.length)}`, stockitem: source.stockitem, kind: 'adjust', quantity: delta, referenceKind: 'provider', reference: `${input.provider}:${input.version}` }]);
    await new PgRuntimeWriter(database).append(stockEvent(context, changed.snapshot(), existing?.reserved ?? 0));
  }
}
