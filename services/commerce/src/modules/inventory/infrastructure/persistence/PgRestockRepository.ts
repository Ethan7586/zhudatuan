import { createHash, randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { RestockRepository, RestockRequest } from '../../application/port/RestockRepository';
import { StockItem, type StockItemState } from '../../domain/model/StockItem';

interface RestockRow {
  readonly stockitem_id: string;
  readonly quantity: number;
  readonly scope_id: string;
  readonly sku_id: string;
  readonly location_id: string;
  readonly onhand: number;
  readonly safety: number;
  readonly reserved: number;
  readonly status: StockItemState;
  readonly version: number;
  readonly updated_at: Date | string;
}

export class PgRestockRepository implements RestockRepository {
  private readonly transactions = new PgTransactionAccess();

  async apply(context: WriteTransactionContext, request: RestockRequest): Promise<void> {
    const database = this.transactions.database(context);
    const lines = await database.query<RestockRow>(
      `with requested as(
        select line,sku,quantity from jsonb_to_recordset($1::jsonb) as item(line text,sku text,quantity bigint)
      ) select requested.line,stock.id stockitem_id,requested.quantity::float8 quantity,stock.scope_id,stock.sku_id,stock.location_id,
      stock.onhand::float8 onhand,stock.safety::float8 safety,coalesce(reservation.quantity,0)::float8 reserved,stock.status,
      stock.version::integer,stock.updated_at
      from requested join lateral(
        select candidate.id from inventory.stockitem candidate
        where candidate.scope_id=$2 and candidate.sku_id=requested.sku and candidate.status='active'
        order by (candidate.location_id=coalesce($3,'')) desc,candidate.id limit 1
      ) selected on true join inventory.stockitem stock on stock.id=selected.id
      left join lateral(select sum(value.quantity) quantity from inventory.reservation value where value.stockitem_id=stock.id
        and value.state='reserved' and value.expires_at>clock_timestamp()) reservation on true
      order by requested.sku,requested.line for update of stock`,
      [JSON.stringify(request.lines), request.scope, request.location]
    );
    if (lines.rows.length !== request.lines.length) throw new Error('RETURN_STOCKITEM_NOT_FOUND');
    const changed = [];
    for (const line of aggregate(lines.rows)) {
      const movement = await database.query(
        `insert into inventory.movement(id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
        values($1,$2,'return',$3,'return',$4,clock_timestamp())
        on conflict(stockitem_id,kind,reference_type,reference_id) do nothing returning id`,
        [`movement:${digest(`${line.stockitem_id}:${request.id}`)}`, line.stockitem_id, line.quantity, request.id]
      );
      if (movement.rows[0]) {
        const current = StockItem.restore({
          id: line.stockitem_id,
          scope: line.scope_id,
          sku: line.sku_id,
          location: line.location_id,
          onhand: line.onhand,
          safety: line.safety,
          state: line.status,
          version: line.version,
          updatedAt: iso(line.updated_at),
        });
        const next = current.restock(line.quantity, new Date().toISOString()).snapshot();
        const saved = await database.query(`update inventory.stockitem set onhand=$2,version=$3,updated_at=$4 where id=$1 and version=$5 returning id`, [next.id, next.onhand, next.version, next.updatedAt, current.snapshot().version]);
        if (!saved.rows[0]) throw new Error('INVENTORY_RETURN_VERSION_CONFLICT');
        changed.push({ ...next, reserved: line.reserved });
      }
    }
    await new PgRuntimeWriter(database).appendMany(
      changed.map((stock) => ({
        id: `event:${randomUUID()}`,
        type: 'inventory.stock.changed',
        aggregateType: 'stockitem',
        aggregate: stock.id,
        scope: stock.scope,
        trace: context.trace,
        payload: { stockitem: stock.id, sku: stock.sku, available: Math.max(0, stock.onhand - stock.safety - stock.reserved), reserved: stock.reserved, version: stock.version },
      }))
    );
  }
}

function aggregate(lines: readonly RestockRow[]): readonly RestockRow[] {
  const values = new Map<string, RestockRow>();
  for (const line of lines) {
    const prior = values.get(line.stockitem_id);
    values.set(line.stockitem_id, prior ? { ...prior, quantity: prior.quantity + line.quantity } : line);
  }
  return Object.freeze([...values.values()].sort((left, right) => left.stockitem_id.localeCompare(right.stockitem_id)));
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function iso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('INVENTORY_TIME_INVALID');
  return date.toISOString();
}
