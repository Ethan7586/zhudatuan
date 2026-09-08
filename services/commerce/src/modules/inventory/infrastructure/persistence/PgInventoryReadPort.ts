import type { QueryResultRow } from 'pg';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { boundedIdentifiers } from '../../../../platform/database/BoundedIdentifiers';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import { available } from '../../domain/model/StockItem';
import type { InventoryAvailabilityProjection, InventoryReadPort, StockSourceProjection, StorefrontAvailability } from '../../public/InventoryReadPort';

interface AvailabilityRow extends QueryResultRow {
  readonly id: string;
  readonly sku: string;
  readonly scope: string;
  readonly location: string;
  readonly onhand: number;
  readonly safety: number;
  readonly reserved: number;
  readonly active_count: number;
  readonly earliest_expiry: Date | string | null;
  readonly status: 'active' | 'blocked' | 'retired';
  readonly version: string;
  readonly source: string | null;
  readonly source_reference: string | null;
  readonly watermark: Date | string;
}

export class PgInventoryReadPort implements InventoryReadPort {
  constructor(private readonly transactions = new PgTransactionAccess()) {}
  async availability(context: ReadTransactionContext, mall: string, skus: readonly string[]): Promise<readonly StorefrontAvailability[]> {
    const values = await this.read(context, mall, boundedIdentifiers(skus, 50, 'STOREFRONT_INVENTORY_SKUS_INVALID'), null);
    return Object.freeze(values.map(({ sku, available: quantity, state, version }) => Object.freeze({ sku, available: quantity, state: state === 'blocked' ? ('unavailable' as const) : state, version })));
  }

  async details(context: ReadTransactionContext, scope: string, skus: readonly string[], source: string | null): Promise<readonly InventoryAvailabilityProjection[]> {
    const selected = boundedIdentifiers(skus, 50, 'INVENTORY_AVAILABILITY_SKUS_INVALID');
    return this.read(context, scope, selected, source);
  }

  private async read(context: ReadTransactionContext, scope: string, selected: readonly string[], source: string | null): Promise<readonly InventoryAvailabilityProjection[]> {
    if (selected.length === 0) return Object.freeze([]);
    const database = this.transactions.database(context);
    const result = await database.query<AvailabilityRow>(
      `select stock.id,stock.sku_id sku,stock.scope_id scope,stock.location_id location,stock.onhand::float8 onhand,
        stock.safety::float8 safety,reservation.reserved::float8 reserved,reservation.active_count,
        reservation.earliest_expiry,stock.status,stock.version::text version,snapshot.source,
        snapshot.source_version source_reference,greatest(stock.updated_at,coalesce(snapshot.observed_at,stock.updated_at)) watermark
        from inventory.stockitem stock left join lateral(
          select coalesce(sum(value.quantity),0) reserved,count(*)::integer active_count,min(value.expires_at) earliest_expiry
          from inventory.reservation value where value.stockitem_id=stock.id and value.state='reserved'
          and value.expires_at>clock_timestamp()
        ) reservation on true left join lateral(
          select value.source,value.source_version,value.observed_at from inventory.snapshot value
          where value.stockitem_id=stock.id and ($3::text is null or value.source=$3)
          order by value.observed_at desc,value.source limit 1
        ) snapshot on true where stock.scope_id=$1 and stock.sku_id=any($2::text[])
        and ($3::text is null or snapshot.source is not null or $3='local')
        order by stock.sku_id,stock.location_id,stock.id`,
      [scope, selected, source]
    );
    return project(result.rows);
  }
}

function project(rows: readonly AvailabilityRow[]): readonly InventoryAvailabilityProjection[] {
  const grouped = new Map<string, AvailabilityRow[]>();
  for (const row of rows) grouped.set(row.sku, [...(grouped.get(row.sku) ?? []), row]);
  return Object.freeze(
    [...grouped.entries()].map(([sku, stock]) => {
      const active = stock.filter(({ status }) => status === 'active');
      const onhand = sum(active, 'onhand');
      const safety = sum(active, 'safety');
      const reserved = sum(active, 'reserved');
      const quantity = available(onhand, reserved, safety);
      const sources = Object.freeze(stock.map(sourceProjection));
      const watermark = newest(stock.map(({ watermark: value }) => iso(value)));
      const expiry = stock.flatMap(({ earliest_expiry: value }) => (value === null ? [] : [iso(value)]));
      return Object.freeze({
        sku,
        scope: stock[0]!.scope,
        onhand,
        safety,
        reserved,
        available: quantity,
        state: active.length === 0 && stock.some(({ status }) => status === 'blocked') ? ('blocked' as const) : quantity > 0 ? ('available' as const) : ('unavailable' as const),
        reservation: Object.freeze({ activeCount: sum(stock, 'active_count'), activeQuantity: reserved, earliestExpiry: expiry.length === 0 ? null : expiry.sort()[0]! }),
        sources,
        version: sources
          .map(({ version }) => version)
          .sort()
          .join(':'),
        watermark,
      });
    })
  );
}

function sourceProjection(row: AvailabilityRow): StockSourceProjection {
  const onhand = Number(row.onhand);
  const safety = Number(row.safety);
  const reserved = Number(row.reserved);
  return Object.freeze({
    id: row.id,
    source: row.source ?? 'local',
    reference: row.source_reference,
    location: row.location,
    onhand,
    safety,
    reserved,
    available: row.status === 'active' ? available(onhand, reserved, safety) : 0,
    state: row.status,
    version: row.version,
    watermark: iso(row.watermark),
  });
}

function sum(rows: readonly AvailabilityRow[], field: 'onhand' | 'safety' | 'reserved' | 'active_count'): number {
  return rows.reduce((total, row) => total + Number(row[field]), 0);
}

function newest(values: readonly string[]): string {
  const selected = [...values].sort().at(-1);
  if (!selected) throw new Error('INVENTORY_AVAILABILITY_WATERMARK_MISSING');
  return selected;
}

function iso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('INVENTORY_AVAILABILITY_TIME_INVALID');
  return date.toISOString();
}
