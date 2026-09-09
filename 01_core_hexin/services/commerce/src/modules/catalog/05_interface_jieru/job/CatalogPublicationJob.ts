import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { CATALOG_LISTING_MANAGEMENT_STATUS_SQL } from '../../03_application_yingyong/CatalogListingManagement';

interface ListingIdRow extends Record<string, unknown> {
  readonly id: string;
}

interface PublicationOutcomeRow extends Record<string, unknown> {
  readonly id: string;
  readonly sku_id: string | null;
  readonly title: string | null;
  readonly outcome: 'published' | 'skipped' | 'failed';
  readonly code: string | null;
}

interface PublicationFailure {
  readonly id: string;
  readonly sku_id: string | null;
  readonly title: string | null;
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

interface PublicationProgress {
  readonly total: number;
  readonly processed: number;
  readonly succeeded: number;
  readonly published: number;
  readonly failed: number;
  readonly skipped: number;
  readonly phase: 'publishing' | 'completed';
  readonly failures: readonly PublicationFailure[];
  readonly started_at: string;
  readonly completed_at?: string;
}

interface PublicationCheckpoint {
  readonly processed: number;
  readonly published: number;
  readonly failed: number;
  readonly skipped: number;
  readonly failures: readonly PublicationFailure[];
  readonly startedAt: string;
}

type PublicationDatabase = Pick<DatabasePool, 'query'>;

export class CatalogPublicationProcessor implements JobProcessor {
  constructor(private readonly pool: DatabasePool) {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'catalogpublication') throw new Error('JOB_KIND_MISMATCH');
    if (!job.scope_id) throw new Error('CATALOGPUBLICATION_SCOPE_REQUIRED');
    if (signal.aborted) throw signal.reason;

    const targetIds = await this.targetIds(job);
    const checkpoint = publicationCheckpoint(job.payload, targetIds.length);
    const startedAt = checkpoint.startedAt;
    let published = checkpoint.published;
    let skipped = checkpoint.skipped;
    let failures: PublicationFailure[] = [...checkpoint.failures];
    await this.progress(this.pool, job.id, {
      total: targetIds.length, processed: checkpoint.processed, succeeded: published, published,
      failed: failures.length, skipped,
      phase: 'publishing', failures, started_at: startedAt,
    }, checkpoint.processed);

    for (let index = checkpoint.processed; index < targetIds.length; index += 1) {
      const id = targetIds[index]!;
      if (signal.aborted) throw signal.reason;
      const client = await this.pool.connect();
      try {
        await client.query('begin');
        const outcome = await this.publishOne(client as unknown as PublicationDatabase, job.scope_id, id);
        const nextPublished = published + (outcome.outcome === 'published' ? 1 : 0);
        const nextSkipped = skipped + (outcome.outcome === 'skipped' ? 1 : 0);
        const nextFailures = outcome.outcome === 'failed' ? [...failures, publicationFailure(outcome)] : failures;
        const processed = index + 1;
        const completed = processed === targetIds.length;
        await this.progress(client as unknown as PublicationDatabase, job.id, {
          total: targetIds.length, processed, succeeded: nextPublished, published: nextPublished,
          failed: nextFailures.length, skipped: nextSkipped, phase: completed ? 'completed' : 'publishing',
          failures: nextFailures, started_at: startedAt,
          ...(completed ? { completed_at: new Date().toISOString() } : {}),
        }, index);
        await client.query('commit');
        published = nextPublished;
        skipped = nextSkipped;
        failures = nextFailures;
      } catch (cause) {
        await client.query('rollback').catch(() => undefined);
        throw cause;
      } finally {
        client.release();
      }
    }
    if (signal.aborted) throw signal.reason;
    if (checkpoint.processed === targetIds.length) {
      await this.progress(this.pool, job.id, {
        total: targetIds.length, processed: targetIds.length, succeeded: published, published,
        failed: failures.length, skipped, phase: 'completed', failures, started_at: startedAt,
        completed_at: new Date().toISOString(),
      }, targetIds.length);
    }
  }

  private async targetIds(job: ClaimedJob): Promise<readonly string[]> {
    const payload = record(job.payload);
    if (Array.isArray(payload.target_ids)) {
      if (payload.target_ids.length > 1_000
        || payload.target_ids.some((id) => typeof id !== 'string' || id.length === 0 || id.length > 300)) {
        throw new Error('CATALOGPUBLICATION_TARGETS_INVALID');
      }
      return [...new Set(payload.target_ids as string[])];
    }
    const legacy = await this.pool.query<ListingIdRow>(`select listing.id from catalog.listing listing
      join catalog.sku sku on sku.id=listing.sku_id join catalog.product product on product.id=sku.product_id
      where listing.scope_id=$1 and listing.status='draft'
        and (${CATALOG_LISTING_MANAGEMENT_STATUS_SQL})='pending_review'
      order by listing.id`, [job.scope_id]);
    return legacy.rows.map(({ id }) => id);
  }

  private async publishOne(database: PublicationDatabase, scope: string, id: string): Promise<PublicationOutcomeRow> {
    const result = await database.query<PublicationOutcomeRow>(`with selected_pool as(
      select binding.pool_id from experience.binding binding
      join experience.application application on application.id=binding.application_id
        and application.status='active' and binding.domain=application.public_slug
      where binding.mall_id=$2 and exists(
        select 1 from experience.release release where release.application_id=application.id
          and release.state='active' and release.effective_at<=clock_timestamp()
          and (release.retired_at is null or release.retired_at>clock_timestamp())
      ) order by application.updated_at desc,application.id,binding.pool_id limit 1
    ),candidate as(
      select listing.id,listing.sku_id,coalesce(nullif(btrim(listing.title),''),nullif(btrim(product.title),'')) title,
        listing.status,(${CATALOG_LISTING_MANAGEMENT_STATUS_SQL}) management_status,
        coalesce(listing.pool_id,(select pool_id from selected_pool)) pool_id
      from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id
      join catalog.product product on product.id=sku.product_id
      where listing.id=$1 and listing.scope_id=$2 for update of listing
    ),published as(
      update catalog.listing listing set pool_id=candidate.pool_id,status='published',
        effective_at=clock_timestamp(),expires_at=null,version=listing.version+1,updated_at=clock_timestamp()
      from candidate where listing.id=candidate.id and candidate.status='draft'
        and candidate.management_status='pending_review' and candidate.pool_id is not null
      returning listing.id,listing.pool_id,listing.sku_id,listing.version
    ),pooled as(
      insert into catalog.poolitem(pool_id,sku_id,state,source_version,added_at)
      select published.pool_id,published.sku_id,'included',
        'listing:'||published.id||':v'||published.version::text,clock_timestamp()
      from published on conflict(pool_id,sku_id) do update
        set state='included',source_version=excluded.source_version
      returning pool_id,sku_id
    )
    select $1::text id,candidate.sku_id,candidate.title,
      case when published.id is not null and pooled.sku_id is not null then 'published'
        when candidate.status='published' then 'skipped' else 'failed' end outcome,
      case when candidate.id is null then 'LISTING_NOT_FOUND'
        when candidate.status='published' then null
        when candidate.status<>'draft' then 'LISTING_STATE_INVALID'
        when candidate.management_status='needs_attention' then 'LISTING_NOT_READY'
        when candidate.pool_id is null then 'STOREFRONT_POOL_MISSING'
        when published.id is null or pooled.sku_id is null then 'LISTING_CHANGED'
        else null end code
    from (select 1) seed left join candidate on true left join published on true left join pooled on true`, [id, scope]);
    const row = result.rows[0];
    if (!row) throw new Error('CATALOGPUBLICATION_OUTCOME_MISSING');
    return row;
  }

  private async progress(database: PublicationDatabase, id: string, progress: PublicationProgress,
    expectedProcessed: number): Promise<void> {
    if (progress.processed !== progress.succeeded + progress.failed + progress.skipped
      || progress.processed < expectedProcessed || progress.processed > progress.total
      || progress.failures.length !== progress.failed) throw new Error('CATALOGPUBLICATION_PROGRESS_INVALID');
    const result = await database.query(`update runtime.job
      set payload=coalesce(payload,'{}'::jsonb)||$2::jsonb,updated_at=clock_timestamp()
      where id=$1 and state='running'
        and coalesce((payload->>'processed')::integer,0)=$3
        and coalesce((payload->>'succeeded')::integer,(payload->>'published')::integer,0)<=$4
        and coalesce((payload->>'failed')::integer,0)<=$5
        and coalesce((payload->>'skipped')::integer,0)<=$6`,
    [id, JSON.stringify(progress), expectedProcessed, progress.succeeded, progress.failed, progress.skipped]);
    if (result.rowCount !== 1) throw new Error('CATALOGPUBLICATION_PROGRESS_CONFLICT');
  }
}

function publicationFailure(row: PublicationOutcomeRow): PublicationFailure {
  const code = row.code ?? 'CATALOG_PUBLICATION_FAILED';
  const messages: Readonly<Record<string, string>> = {
    LISTING_NOT_FOUND: '未找到商品，请确认商品已导入后重试',
    LISTING_STATE_INVALID: '商品当前状态不允许审核上架',
    LISTING_NOT_READY: '商品资料、价格或库存尚未完善',
    STOREFRONT_POOL_MISSING: '商城尚未绑定可用的公开商品池',
    LISTING_CHANGED: '商品在执行期间发生变化，请重试',
  };
  return {
    id: row.id,
    sku_id: row.sku_id,
    title: row.title,
    code,
    message: messages[code] ?? '商品审核上架失败',
    retryable: code === 'LISTING_NOT_FOUND' || code === 'STOREFRONT_POOL_MISSING' || code === 'LISTING_CHANGED',
  };
}

function publicationCheckpoint(value: unknown, total: number): PublicationCheckpoint {
  const payload = record(value);
  const processed = integer(payload.processed);
  const published = integer(payload.succeeded ?? payload.published);
  const failed = integer(payload.failed);
  const skipped = integer(payload.skipped);
  const failures = publicationFailures(payload.failures);
  if (processed !== published + failed + skipped || processed > total || failures.length !== failed) {
    throw new Error('CATALOGPUBLICATION_PROGRESS_INVALID');
  }
  return {
    processed, published, failed, skipped, failures,
    startedAt: typeof payload.started_at === 'string' && payload.started_at.length > 0
      ? payload.started_at : new Date().toISOString(),
  };
}

function publicationFailures(value: unknown): readonly PublicationFailure[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const failure = record(item);
    if (typeof failure.id !== 'string' || typeof failure.code !== 'string' || typeof failure.message !== 'string') return [];
    return [{
      id: failure.id,
      sku_id: typeof failure.sku_id === 'string' ? failure.sku_id : null,
      title: typeof failure.title === 'string' ? failure.title : null,
      code: failure.code,
      message: failure.message,
      retryable: failure.retryable === true,
    }];
  });
}

function integer(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('CATALOGPUBLICATION_PROGRESS_INVALID');
  return parsed;
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
