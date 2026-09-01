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
    await this.restock(text(job.scope_id, 'INVENTORY_RETURN_MALL_REQUIRED'), payload.return);
  }

  private async restock(mall: string, returnid: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const lines = await client.query<{ stockitem_id: string; quantity: number }>(`select stock.id stockitem_id,line.quantity::float8 quantity
        from fulfillment.returnrecord returned join fulfillment.fulfillmentorder fulfillment
          on fulfillment.mall_id=returned.mall_id and fulfillment.id=returned.fulfillment_id
        join fulfillment.line line on line.mall_id=fulfillment.mall_id and line.fulfillment_id=fulfillment.id
        join ordering.line ordered on ordered.id=line.order_line_id join lateral(select stock.id from inventory.stockitem stock
          where stock.scope_id=returned.mall_id and stock.sku_id=ordered.sku_id and stock.status='active'
          order by (stock.location_id=coalesce(fulfillment.store_id,'')) desc,stock.id limit 1) stock on true
        where returned.mall_id=$1 and returned.id=$2 and returned.state='accepted' for update of returned`, [mall, returnid]);
      if (lines.rows.length === 0) throw new Error('RETURN_RESTOCK_NOT_RUNNABLE');
      for (const line of lines.rows) {
        const movement = await client.query(`insert into inventory.movement(id,mall_id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
          values($1,$2,$3,'return',$4,'return',$5,clock_timestamp())
          on conflict(mall_id,stockitem_id,kind,reference_type,reference_id) do nothing returning id`,
        [`movement:${digest(`${mall}:${line.stockitem_id}:${returnid}`)}`, mall, line.stockitem_id, line.quantity, returnid]);
        if (movement.rows[0]) await client.query(`update inventory.stockitem set onhand=onhand+$2,version=version+1,updated_at=clock_timestamp()
          where id=$1 and scope_id=$3`, [line.stockitem_id, line.quantity, mall]);
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
function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
