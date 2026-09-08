import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { CATALOG_LISTING_MANAGEMENT_STATUS_SQL } from '../../03_application_yingyong/CatalogListingManagement';

interface CountRow extends Record<string, unknown> {
  readonly count: number;
}

const PUBLICATION_BATCH_SIZE = 20;

export class CatalogPublicationProcessor implements JobProcessor {
  constructor(private readonly pool: DatabasePool) {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'catalogpublication') throw new Error('JOB_KIND_MISMATCH');
    if (!job.scope_id) throw new Error('CATALOGPUBLICATION_SCOPE_REQUIRED');
    if (signal.aborted) throw signal.reason;

    const total = await this.pool.query<CountRow>(`select count(*)::integer count
      from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id
      join catalog.product product on product.id=sku.product_id
      where listing.scope_id=$1 and listing.status='draft'
        and (${CATALOG_LISTING_MANAGEMENT_STATUS_SQL})='pending_review'`, [job.scope_id]);
    const expected = total.rows[0]?.count ?? 0;
    await this.progress(job.id, expected, 0, 'publishing');

    let published = 0;
    while (!signal.aborted) {
      const result = await this.pool.query(`with eligible as(
        select listing.id from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id
        join catalog.product product on product.id=sku.product_id
        where listing.scope_id=$1 and listing.status='draft'
          and (${CATALOG_LISTING_MANAGEMENT_STATUS_SQL})='pending_review'
        order by listing.id limit $2 for update of listing skip locked
      )
      update catalog.listing listing set status='published',effective_at=clock_timestamp(),expires_at=null,
        version=listing.version+1,updated_at=clock_timestamp()
      from eligible where listing.id=eligible.id returning listing.id`, [job.scope_id, PUBLICATION_BATCH_SIZE]);
      const changed = result.rowCount ?? 0;
      if (changed === 0) break;
      published += changed;
      await this.progress(job.id, expected, published, 'publishing');
    }
    if (signal.aborted) throw signal.reason;
    await this.progress(job.id, expected, published, 'completed');
  }

  private async progress(id: string, total: number, published: number, phase: string): Promise<void> {
    await this.pool.query(`update runtime.job set payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object(
      'total',$2::integer,'processed',$3::integer,'published',$3::integer,'skipped',greatest($2::integer-$3::integer,0),'phase',$4::text),
      updated_at=clock_timestamp() where id=$1`, [id, total, published, phase]);
  }
}
