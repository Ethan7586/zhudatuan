import { createHash } from 'node:crypto';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { RestockRepository, RestockRequest } from '../../application/port/RestockRepository';

export class PgRestockRepository implements RestockRepository {
  private readonly transactions = new PgTransactionAccess();

  async apply(context: WriteTransactionContext, request: RestockRequest): Promise<void> {
    const database = this.transactions.database(context);
    const lines = await database.query<{ stockitem_id: string; quantity: number }>(
      `with requested as(
        select line,sku,quantity from jsonb_to_recordset($1::jsonb) as item(line text,sku text,quantity bigint)
      ) select requested.line,stock.id stockitem_id,requested.quantity::float8 quantity
      from requested join lateral(
        select candidate.id from inventory.stockitem candidate
        where candidate.scope_id=$2 and candidate.sku_id=requested.sku and candidate.status='active'
        order by (candidate.location_id=coalesce($3,'')) desc,candidate.id limit 1
      ) selected on true join inventory.stockitem stock on stock.id=selected.id
      order by requested.sku,requested.line for update of stock`,
      [JSON.stringify(request.lines), request.scope, request.location]
    );
    if (lines.rows.length !== request.lines.length) throw new Error('RETURN_STOCKITEM_NOT_FOUND');
    for (const line of aggregate(lines.rows)) {
      const movement = await database.query(
        `insert into inventory.movement(id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
        values($1,$2,'return',$3,'return',$4,clock_timestamp())
        on conflict(stockitem_id,kind,reference_type,reference_id) do nothing returning id`,
        [`movement:${digest(`${line.stockitem_id}:${request.id}`)}`, line.stockitem_id, line.quantity, request.id]
      );
      if (movement.rows[0]) {
        await database.query(`update inventory.stockitem set onhand=onhand+$2,version=version+1,updated_at=clock_timestamp() where id=$1`, [line.stockitem_id, line.quantity]);
      }
    }
  }
}

function aggregate(lines: readonly Readonly<{ stockitem_id: string; quantity: number }>[]): readonly Readonly<{ stockitem_id: string; quantity: number }>[] {
  const quantities = new Map<string, number>();
  for (const line of lines) quantities.set(line.stockitem_id, (quantities.get(line.stockitem_id) ?? 0) + line.quantity);
  return Object.freeze([...quantities].sort(([left], [right]) => left.localeCompare(right)).map(([stockitem_id, quantity]) => Object.freeze({ stockitem_id, quantity })));
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
