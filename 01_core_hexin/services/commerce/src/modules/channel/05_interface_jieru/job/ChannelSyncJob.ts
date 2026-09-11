import { createHash, randomUUID } from 'node:crypto';
import type { JsonObject, ProviderCallContext, SourceSkuKey } from '@shop/contract';
import type { ExtensionRegistry } from '../../../../bootstrap/ExtensionRegistry';
import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { SecretStore } from '../../../../foundation/infrastructure/SecretStore';
import { ExternalMapping } from '../../02_domain_yewu/model/ExternalMapping';
import { catalogSourcePort, catalogSourceProjection } from '../../../catalog';
import { pricingPort } from '../../../pricing';
import { inventoryPort } from '../../../inventory';
import { FinancePort } from '../../../finance';

interface ConnectionRow {
  readonly id: string;
  readonly provider: string;
  readonly scope_id: string;
  readonly version: number;
  readonly region: string;
}

interface RunRow extends ConnectionRow {
  readonly run: string;
  readonly kind: 'catalog' | 'price' | 'stock' | 'statement';
  readonly cursor_value: string | null;
  readonly input: Record<string, unknown>;
}

export class ChannelJobProcessor implements JobProcessor {
  private readonly finance = new FinancePort();
  constructor(private readonly pool: DatabasePool, private readonly extensions: ExtensionRegistry, private readonly secrets: SecretStore,
    private readonly kind: 'catalogsync' | 'pricesync' | 'inventorysync' | 'statementsync') {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== this.kind) throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    const run = await this.run(text(payload.run, 'CHANNEL_SYNC_RUN_REQUIRED'));
    if (run.kind === 'catalog' && this.kind === 'catalogsync') return this.catalog(job, run);
    if (run.kind === 'price' && this.kind === 'pricesync') return this.price(job, run);
    if (run.kind === 'stock' && this.kind === 'inventorysync') return this.stock(job, run);
    if (run.kind === 'statement' && this.kind === 'statementsync') return this.statement(job, run);
    throw new Error('CHANNEL_SYNC_JOB_KIND_MISMATCH');
  }

  private async run(id: string): Promise<RunRow> {
    const result = await this.pool.query<RunRow>(`update channel.syncrun run set state='running',started_at=coalesce(started_at,clock_timestamp())
      from channel.connection connection where run.id=$1 and connection.id=run.connection_id and run.state in('queued','running') and connection.status='enabled'
      returning run.id run,run.kind,run.cursor_value,run.input,connection.id,connection.provider,connection.scope_id,connection.version,connection.region`, [id]);
    const run = result.rows[0];
    if (!run) throw new Error('CHANNEL_SYNC_RUN_NOT_RUNNABLE');
    await this.ensure(run);
    return run;
  }

  private async catalog(job: ClaimedJob, run: RunRow): Promise<void> {
    const batch = await this.extensions.require(run.provider, run.scope_id, 'Catalog', 'catalog').pullCatalog(await this.context(job, run), run.cursor_value ?? undefined);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      for (const record of batch.records) {
        const external = text(record.externalId, 'PROVIDER_EXTERNAL_ID_INVALID');
        const version = text(record.version, 'PROVIDER_SOURCE_VERSION_INVALID');
        const source = object(record.payload);
        const serialized = JSON.stringify(source);
        const hash = digest(serialized);
        await client.query(`insert into channel.sourcerecord(id,provider,scope_id,objecttype,externalid,sourceversion,payload,payload_hash,disposition,observed_at)
          values($1,$2,$3,'product',$4,$5,$6::jsonb,$7,'accepted',clock_timestamp())
          on conflict(provider,scope_id,objecttype,externalid,sourceversion) do nothing`,
        [`source:${digest(`${run.scope_id}:${run.provider}:${external}:${version}`)}`, run.provider, run.scope_id, external, version, serialized, hash]);
        await catalogSourcePort.accept(client, { id: `listing:${digest(`${run.scope_id}:${run.provider}:${external}`)}`,
          provider: run.provider, external, scope: run.scope_id, version, payload: serialized, hash });
        await catalogSourceProjection.project(client, {
          provider: run.provider,
          scope: run.scope_id,
          region: run.region,
          external,
          version,
          payload: source,
        });
      }
      await this.finish(client, job, run, batch.records.length, batch.errors.length, batch.complete, batch.nextCursor ?? null, batch.errors);
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally { client.release(); }
  }

  private async price(job: ClaimedJob, run: RunRow): Promise<void> {
    const keys = await this.keys(run);
    if (keys.length === 0) return this.completeEmpty(run);
    const batch = await this.extensions.require(run.provider, run.scope_id, 'Price', 'price').pullPrice(await this.context(job, run), keys);
    const book = `pricebook:${digest(`${run.scope_id}:${run.provider}`)}`;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await pricingPort.ensureProviderBook(client, book, run.scope_id, run.provider);
      for (const record of batch.records) {
        const external = text(record.externalId, 'PROVIDER_EXTERNAL_ID_INVALID');
        const amount = integer(record.amountMinor, 'PROVIDER_PRICE_INVALID');
        const sku = await catalogSourcePort.sku(client, run.provider, run.scope_id, external);
        if (!sku) continue;
        new ExternalMapping(run.provider, 'product', external, 'sku', sku, String(record.version ?? record.effectiveAt ?? 'current'));
        const effective = typeof record.effectiveAt === 'string' ? record.effectiveAt : new Date().toISOString();
        await pricingPort.saveProviderPrice(client, { id: `price:${digest(`${book}:${sku}:${effective}`)}`, book, sku, amountMinor: amount,
          compareMinor: record.compareMinor ?? null, effectiveAt: effective, expiresAt: record.expiresAt ?? null });
      }
      await this.finish(client, job, run, batch.records.length, 0, keys.length < 500, keys.at(-1)?.externalId ?? null, []);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async stock(job: ClaimedJob, run: RunRow): Promise<void> {
    const keys = await this.keys(run);
    if (keys.length === 0) return this.completeEmpty(run);
    const batch = await this.extensions.require(run.provider, run.scope_id, 'Inventory', 'stock').pullStock(await this.context(job, run), keys);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      for (const record of batch.records) {
        const external = text(record.externalId, 'PROVIDER_EXTERNAL_ID_INVALID');
        const sku = await catalogSourcePort.sku(client, run.provider, run.scope_id, external);
        if (!sku) continue;
        new ExternalMapping(run.provider, 'product', external, 'sku', sku, String(record.version ?? job.id));
        const id = `stock:${digest(`${run.scope_id}:${sku}:${run.region}`)}`;
        const onhand = integer(record.onhand, 'PROVIDER_STOCK_INVALID');
        await inventoryPort.observe(client, { id, scope: run.scope_id, sku, location: run.region, onhand,
          safety: integer(record.safety ?? 0, 'PROVIDER_SAFETY_STOCK_INVALID'), provider: run.provider, version: String(record.version ?? job.id) });
      }
      await this.finish(client, job, run, batch.records.length, 0, keys.length < 500, keys.at(-1)?.externalId ?? null, []);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async statement(job: ClaimedJob, run: RunRow): Promise<void> {
    const start = text(run.input.start, 'STATEMENT_START_REQUIRED');
    const end = text(run.input.end, 'STATEMENT_END_REQUIRED');
    const timezone = text(run.input.timezone, 'STATEMENT_TIMEZONE_REQUIRED');
    const partner = text(run.input.partner, 'STATEMENT_PARTNER_REQUIRED');
    const statement = await this.extensions.require(run.provider, run.scope_id, 'Statement', 'statement')
      .pullStatement(await this.context(job, run), { start, end, timezone });
    if (!/^[a-f0-9]{64}$/.test(statement.sha256)) throw new Error('STATEMENT_HASH_INVALID');
    const id = `statement:${digest(`${run.id}:${start}:${end}`)}`;
    const reconciliation = `reconciliation:${id}`;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(`insert into channel.statement(id,connection_id,provider,scope_id,partner_id,period_start,period_end,timezone,object_ref,sha256,generated_at)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,clock_timestamp()) on conflict(connection_id,period_start,period_end) do nothing`,
      [id, run.id, run.provider, run.scope_id, partner, start, end, timezone, statement.objectRef, statement.sha256]);
      await this.finance.receiveReconciliation(client, { id: reconciliation, scope: run.scope_id, provider: run.provider,
        partner, period: `${start}/${end}`, statement: id, hash: statement.sha256, run: run.run });
      await client.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
        values($1,'reconciliation','finance',$2,jsonb_build_object('reconciliation',$3),'queued',20,clock_timestamp(),clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
      [`job:${reconciliation}`, run.scope_id, reconciliation]);
      await this.finish(client, job, run, 1, 0, true, null, []);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async keys(run: RunRow): Promise<SourceSkuKey[]> {
    const keys = await catalogSourcePort.keys(this.pool, run.provider, run.scope_id, run.cursor_value);
    return keys.map((externalId) => ({ externalId, region: run.region }));
  }

  private async finish(database: import('../../../../foundation/application/ModuleOperations').OperationDatabase, job: ClaimedJob, run: RunRow, accepted: number,
    rejected: number, complete: boolean, cursor: string | null, errors: readonly unknown[]): Promise<void> {
    await database.query(`update channel.syncrun set state=$2,cursor_value=$3,pulled_count=pulled_count+$4,accepted_count=accepted_count+$5,
      rejected_count=rejected_count+$6,error_summary=error_summary||$7::jsonb,watermark=clock_timestamp(),completed_at=case when $2='completed' then clock_timestamp() end
      where id=$1`, [run.run, complete ? 'completed' : 'running', cursor, accepted + rejected, accepted, rejected, JSON.stringify(errors)]);
    if (complete) await database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
      values($1,'channel.sync.completed',1,'syncrun',$2,$3,jsonb_build_object('run',$2,'kind',$4,'provider',$5,'accepted',$6,'rejected',$7),$8,clock_timestamp(),clock_timestamp())`,
    [`event:${randomUUID()}`, run.run, run.scope_id, run.kind, run.provider, accepted, rejected, job.id]);
    if (!complete) await database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values($1,$2,'channel',$3,jsonb_build_object('subtype','channelsync','run',$4),'queued',30,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
    [`job:${randomUUID()}`, job.kind, run.scope_id, run.run]);
  }

  private async completeEmpty(run: RunRow): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(`update channel.syncrun set state='completed',watermark=clock_timestamp(),completed_at=clock_timestamp() where id=$1`, [run.run]);
      await client.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
        values($1,'channel.sync.completed',1,'syncrun',$2,$3,jsonb_build_object('run',$2,'kind',$4,'provider',$5,'accepted',0,'rejected',0),$1,clock_timestamp(),clock_timestamp())`,
      [`event:${randomUUID()}`, run.run, run.scope_id, run.kind, run.provider]);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async ensure(connection: ConnectionRow): Promise<void> {
    if (!this.extensions.has(connection.provider, connection.scope_id)) throw new Error('PROVIDER_INSTALLATION_NOT_ACTIVE');
  }

  private async context(job: ClaimedJob, run: RunRow): Promise<ProviderCallContext> {
    const result = await this.pool.query<{ tenant: string | null }>(`select access.scope_object($1)->>'tenant' tenant`, [run.scope_id]);
    return { tenantId: result.rows[0]?.tenant ?? run.scope_id, requestId: job.id, traceId: job.id, deadline: Date.now() + 300_000 };
  }
}

function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function object(value: unknown): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as JsonObject;
}
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(code); return value; }
function integer(value: unknown, code: string): number { if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(code); return value as number; }
