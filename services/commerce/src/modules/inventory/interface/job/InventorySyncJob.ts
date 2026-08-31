import { createHash } from 'node:crypto';
import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { InventoryReturnPort } from '../../../fulfillment/public';

export class InventorySyncJobProcessor implements JobProcessor {
  constructor(
    private readonly pool: DatabasePool,
    private readonly channel: JobProcessor,
    private readonly returns: InventoryReturnPort
  ) {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'inventorysync') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    if (typeof payload.return !== 'string' || !payload.return) return this.channel.process(job, signal);
    await this.restock(payload.return);
  }

  private async restock(returnid: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const returned = await this.returns.restock(client, returnid);
      if (!returned) throw new Error('RETURN_RESTOCK_NOT_RUNNABLE');
      const lines = await client.query<{ line: string; stockitem_id: string; quantity: number }>(
        `with requested as(
          select line,sku,quantity from jsonb_to_recordset($1::jsonb) as item(line text,sku text,quantity bigint)
        ) select requested.line,stock.id stockitem_id,requested.quantity::float8 quantity
        from requested join lateral(
          select candidate.id from inventory.stockitem candidate
          where candidate.scope_id=$2 and candidate.sku_id=requested.sku and candidate.status='active'
          order by (candidate.location_id=coalesce($3,'')) desc,candidate.id limit 1
        ) selected on true join inventory.stockitem stock on stock.id=selected.id
        order by requested.sku,requested.line for update of stock`,
        [JSON.stringify(returned.lines), returned.scope, returned.location]
      );
      if (lines.rows.length !== returned.lines.length) throw new Error('RETURN_STOCKITEM_NOT_FOUND');
      for (const line of aggregate(lines.rows)) {
        const movement = await client.query(
          `insert into inventory.movement(id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
          values($1,$2,'return',$3,'return',$4,clock_timestamp())
          on conflict(stockitem_id,kind,reference_type,reference_id) do nothing returning id`,
          [`movement:${digest(`${line.stockitem_id}:${returnid}`)}`, line.stockitem_id, line.quantity, returnid]
        );
        if (movement.rows[0])
          await client.query(
            `update inventory.stockitem set onhand=onhand+$2,version=version+1,updated_at=clock_timestamp()
          where id=$1`,
            [line.stockitem_id, line.quantity]
          );
      }
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
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
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
