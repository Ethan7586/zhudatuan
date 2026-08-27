import { createHash } from 'node:crypto';
import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';

export class InventorySyncJobProcessor implements JobProcessor {
  constructor(private readonly pool: DatabasePool, private readonly channel: JobProcessor) {}

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
      const lines = await client.query<{ stockitem_id: string; quantity: number }>(`select stock.id stockitem_id,line.quantity::float8 quantity
        from fulfillment.returnrecord returned join fulfillment.fulfillmentorder fulfillment on fulfillment.id=returned.fulfillment_id
        join fulfillment.line line on line.fulfillment_id=fulfillment.id join ordering.line ordered on ordered.id=line.order_line_id
        join ordering.orderrecord orders on orders.id=fulfillment.order_id join lateral(select stock.id from inventory.stockitem stock
          where stock.scope_id=orders.scope_id and stock.sku_id=ordered.sku_id and stock.status='active'
          order by (stock.location_id=coalesce(fulfillment.store_id,'')) desc,stock.id limit 1) stock on true
        where returned.id=$1 and returned.state='accepted' for update of returned`, [returnid]);
      if (lines.rows.length === 0) throw new Error('RETURN_RESTOCK_NOT_RUNNABLE');
      for (const line of lines.rows) {
        const movement = await client.query(`insert into inventory.movement(id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
          values($1,$2,'return',$3,'return',$4,clock_timestamp())
          on conflict(stockitem_id,kind,reference_type,reference_id) do nothing returning id`,
        [`movement:${digest(`${line.stockitem_id}:${returnid}`)}`, line.stockitem_id, line.quantity, returnid]);
        if (movement.rows[0]) await client.query(`update inventory.stockitem set onhand=onhand+$2,version=version+1,updated_at=clock_timestamp()
          where id=$1`, [line.stockitem_id, line.quantity]);
      }
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally { client.release(); }
  }
}

function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
