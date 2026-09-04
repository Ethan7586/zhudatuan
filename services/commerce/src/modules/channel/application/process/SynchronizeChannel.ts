import type { ProviderCallContext, SourceSkuKey } from '@shop/contract';
import type { ExtensionRegistry } from '../../../../bootstrap/ExtensionRegistry';
import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import type { ChannelCatalogPort } from '../../../catalog/public';
import type { ChannelReconciliationPort } from '../../../finance/public';
import type { ChannelInventoryPort } from '../../../inventory/public';
import type { ChannelPricingPort } from '../../../pricing/public';
import { ExternalMapping } from '../../domain/model/ExternalMapping';
import type { ChannelJobRepository, ChannelSyncKind, ChannelSyncRun } from '../port/ChannelJobRepository';
import { channelDigest as digest, channelInteger as integer, channelObject as object, channelOwner as syncOwner, channelRequired as required, channelText as text } from './ChannelSyncValue';

export interface ChannelSyncDependencies {
  readonly catalog?: ChannelCatalogPort;
  readonly pricing?: ChannelPricingPort;
  readonly inventory?: ChannelInventoryPort;
  readonly finance?: ChannelReconciliationPort;
}

export interface ChannelSyncExecution {
  readonly job: ChannelSyncKind;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class SynchronizeChannel {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: ChannelJobRepository,
    private readonly extensions: ExtensionRegistry,
    private readonly kind: ChannelSyncKind,
    private readonly dependencies: ChannelSyncDependencies
  ) {}

  async execute(id: string, execution: ChannelSyncExecution): Promise<void> {
    if (execution.job !== this.kind) throw new Error('CHANNEL_SYNC_JOB_KIND_MISMATCH');
    const run = await this.claim(id, execution);
    if (run.kind === 'catalog' && this.kind === 'catalogsync') return this.catalog(run, execution);
    if (run.kind === 'price' && this.kind === 'pricesync') return this.price(run, execution);
    if (run.kind === 'stock' && this.kind === 'inventorysync') return this.stock(run, execution);
    if (run.kind === 'statement' && this.kind === 'statementsync') return this.statement(run, execution);
    throw new Error('CHANNEL_SYNC_JOB_KIND_MISMATCH');
  }

  private async claim(id: string, execution: ChannelSyncExecution): Promise<ChannelSyncRun> {
    const run = await this.transactions.write(this.options('system', 'channel.sync.claim', execution), (context) => this.repository.claim(context, id));
    if (!run) throw new Error('CHANNEL_SYNC_RUN_NOT_RUNNABLE');
    if (!this.extensions.has(run.provider, run.scope)) throw new Error('PROVIDER_INSTALLATION_NOT_ACTIVE');
    return run;
  }

  private async catalog(run: ChannelSyncRun, execution: ChannelSyncExecution): Promise<void> {
    const batch = await this.extensions.require(run.provider, run.scope, 'Catalog', 'catalog').pullCatalog(await this.providerContext(run, execution), run.cursor ?? undefined);
    await this.transactions.write(this.options(run.scope, 'channel.catalog.persist', execution), async (context) => {
      const catalog = required(this.dependencies.catalog, 'CHANNEL_CATALOG_PORT_MISSING');
      for (const record of batch.records) {
        const external = text(record.externalId, 'PROVIDER_EXTERNAL_ID_INVALID');
        const version = text(record.version, 'PROVIDER_SOURCE_VERSION_INVALID');
        const payload = object(record.payload);
        const serialized = JSON.stringify(payload);
        const hash = digest(serialized);
        await this.repository.saveSource(context, { provider: run.provider, scope: run.scope, external, version, payload });
        await catalog.accept(context, {
          id: `listing:${digest(`${run.scope}:${run.provider}:${external}`)}`,
          provider: run.provider,
          external,
          scope: run.scope,
          version,
          payload: serialized,
          hash,
        });
      }
      await this.finish(context, run, execution, batch.records.length, batch.errors.length, batch.complete, batch.nextCursor ?? null, batch.errors);
    });
  }

  private async price(run: ChannelSyncRun, execution: ChannelSyncExecution): Promise<void> {
    const keys = await this.keys(run, execution);
    if (keys.length === 0) return this.completeEmpty(run, execution);
    const batch = await this.extensions.require(run.provider, run.scope, 'Price', 'price').pullPrice(await this.providerContext(run, execution), keys);
    const book = `pricebook:${digest(`${run.scope}:${run.provider}`)}`;
    await this.transactions.write(this.options(run.scope, 'channel.price.persist', execution), async (context) => {
      const catalog = required(this.dependencies.catalog, 'CHANNEL_CATALOG_PORT_MISSING');
      const pricing = required(this.dependencies.pricing, 'CHANNEL_PRICING_PORT_MISSING');
      await pricing.ensureProviderBook(context, book, run.scope, run.provider);
      for (const record of batch.records) {
        const external = text(record.externalId, 'PROVIDER_EXTERNAL_ID_INVALID');
        const amount = integer(record.amountMinor, 'PROVIDER_PRICE_INVALID');
        const sku = await catalog.sku(context, run.provider, run.scope, external);
        if (!sku) continue;
        new ExternalMapping(run.provider, 'product', external, 'sku', sku, String(record.version ?? record.effectiveAt ?? 'current'));
        const effective = typeof record.effectiveAt === 'string' ? record.effectiveAt : new Date().toISOString();
        await pricing.saveProviderPrice(context, {
          id: `price:${digest(`${book}:${sku}:${effective}`)}`,
          book,
          sku,
          amountMinor: amount,
          compareMinor: record.compareMinor ?? null,
          effectiveAt: effective,
          expiresAt: record.expiresAt ?? null,
        });
      }
      await this.finish(context, run, execution, batch.records.length, 0, keys.length < 500, keys.at(-1)?.externalId ?? null, []);
    });
  }

  private async stock(run: ChannelSyncRun, execution: ChannelSyncExecution): Promise<void> {
    const keys = await this.keys(run, execution);
    if (keys.length === 0) return this.completeEmpty(run, execution);
    const batch = await this.extensions.require(run.provider, run.scope, 'Inventory', 'stock').pullStock(await this.providerContext(run, execution), keys);
    await this.transactions.write(this.options(run.scope, 'channel.stock.persist', execution), async (context) => {
      const catalog = required(this.dependencies.catalog, 'CHANNEL_CATALOG_PORT_MISSING');
      const inventory = required(this.dependencies.inventory, 'CHANNEL_INVENTORY_PORT_MISSING');
      for (const record of batch.records) {
        const external = text(record.externalId, 'PROVIDER_EXTERNAL_ID_INVALID');
        const sku = await catalog.sku(context, run.provider, run.scope, external);
        if (!sku) continue;
        new ExternalMapping(run.provider, 'product', external, 'sku', sku, String(record.version ?? execution.trace));
        await inventory.observe(context, {
          id: `stock:${digest(`${run.scope}:${sku}:${run.region}`)}`,
          scope: run.scope,
          sku,
          location: run.region,
          onhand: integer(record.onhand, 'PROVIDER_STOCK_INVALID'),
          safety: integer(record.safety ?? 0, 'PROVIDER_SAFETY_STOCK_INVALID'),
          provider: run.provider,
          version: String(record.version ?? execution.trace),
        });
      }
      await this.finish(context, run, execution, batch.records.length, 0, keys.length < 500, keys.at(-1)?.externalId ?? null, []);
    });
  }

  private async statement(run: ChannelSyncRun, execution: ChannelSyncExecution): Promise<void> {
    const start = text(run.input.start, 'STATEMENT_START_REQUIRED');
    const end = text(run.input.end, 'STATEMENT_END_REQUIRED');
    const timezone = text(run.input.timezone, 'STATEMENT_TIMEZONE_REQUIRED');
    const partner = text(run.input.partner, 'STATEMENT_PARTNER_REQUIRED');
    const statement = await this.extensions.require(run.provider, run.scope, 'Statement', 'statement').pullStatement(await this.providerContext(run, execution), { start, end, timezone });
    if (!/^[a-f0-9]{64}$/.test(statement.sha256)) throw new Error('STATEMENT_HASH_INVALID');
    const id = `statement:${digest(`${run.connection}:${start}:${end}`)}`;
    const reconciliation = `reconciliation:${id}`;
    await this.transactions.write(this.options(run.scope, 'channel.statement.persist', execution), async (context) => {
      await this.repository.saveStatement(context, {
        id,
        connection: run.connection,
        provider: run.provider,
        scope: run.scope,
        partner,
        start,
        end,
        timezone,
        objectReference: statement.objectRef,
        sha256: statement.sha256,
      });
      await required(this.dependencies.finance, 'CHANNEL_FINANCE_PORT_MISSING').receiveReconciliation(context, {
        id: reconciliation,
        scope: run.scope,
        provider: run.provider,
        partner,
        period: `${start}/${end}`,
        statement: id,
        hash: statement.sha256,
        run: run.run,
      });
      await this.repository.scheduleReconciliation(context, reconciliation, run.scope);
      await this.finish(context, run, execution, 1, 0, true, null, []);
    });
  }

  private async keys(run: ChannelSyncRun, execution: ChannelSyncExecution): Promise<SourceSkuKey[]> {
    const keys = await this.transactions.read(this.options(run.scope, 'channel.keys.read', execution), (context) => required(this.dependencies.catalog, 'CHANNEL_CATALOG_PORT_MISSING').keys(context, run.provider, run.scope, run.cursor));
    return keys.map((externalId) => ({ externalId, region: run.region }));
  }

  private completeEmpty(run: ChannelSyncRun, execution: ChannelSyncExecution): Promise<void> {
    return this.transactions.write(this.options(run.scope, 'channel.sync.complete', execution), (context) => this.finish(context, run, execution, 0, 0, true, null, []));
  }

  private finish(
    context: Parameters<ChannelJobRepository['finish']>[0],
    run: ChannelSyncRun,
    execution: ChannelSyncExecution,
    accepted: number,
    rejected: number,
    complete: boolean,
    cursor: string | null,
    errors: readonly unknown[]
  ): Promise<void> {
    return this.repository.finish(context, {
      run,
      job: this.kind,
      owner: syncOwner(this.kind),
      trace: execution.trace,
      accepted,
      rejected,
      complete,
      cursor,
      errors,
    });
  }

  private async providerContext(run: ChannelSyncRun, execution: ChannelSyncExecution): Promise<ProviderCallContext> {
    const tenant = await this.transactions.read(this.options(run.scope, 'channel.provider.context', execution), (context) => this.repository.providerTenant(context, run.scope));
    return { tenantId: tenant, requestId: execution.trace, traceId: execution.trace, deadline: execution.deadline };
  }

  private options(scope: string, operation: string, execution: ChannelSyncExecution): TransactionOptions {
    return {
      tenant: scope,
      membership: 'system',
      scope,
      actor: 'system',
      trace: execution.trace,
      operation,
      deadline: execution.deadline,
      signal: execution.signal,
      workload: 'jobs',
    };
  }
}
