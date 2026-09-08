import type { ProviderCallContext, ProviderCapability, ProviderPortForCapability, SourceSkuKey } from '@shop/contract';
import type { ExtensionRegistry } from '../../../../composition/ExtensionRegistry';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { TransactionManager, TransactionOptions } from '../../../../platform/database/TransactionManager';
import type { ChannelCatalogPort } from '../../../catalog/public';
import type { ChannelReconciliationPort } from '../../../finance/public';
import type { ChannelInventoryPort } from '../../../inventory/public';
import type { ChannelPricingPort } from '../../../pricing/public';
import type { ChannelJobRepository, ChannelSyncKind, ChannelSyncRun } from '../port/ChannelJobRepository';
import { channelOwner, channelRequired } from './ChannelSyncValue';

export interface ChannelSyncDependencies {
  readonly catalog?: ChannelCatalogPort;
  readonly pricing?: ChannelPricingPort;
  readonly inventory?: ChannelInventoryPort;
  readonly finance?: ChannelReconciliationPort;
}

export interface ChannelSyncExecution {
  readonly job: ChannelSyncKind;
  readonly scope: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export interface SyncOutcome {
  readonly accepted: number;
  readonly rejected: number;
  readonly complete: boolean;
  readonly cursor: string | null;
  readonly errors: readonly unknown[];
}

export class SyncSession {
  constructor(
    readonly run: ChannelSyncRun,
    readonly execution: ChannelSyncExecution,
    readonly dependencies: ChannelSyncDependencies,
    private readonly transactions: TransactionManager,
    private readonly repository: ChannelJobRepository,
    private readonly extensions: ExtensionRegistry,
    private readonly job: ChannelSyncKind
  ) {}

  provider<C extends ProviderCapability>(capabilities: C | readonly C[]): ProviderPortForCapability<C> {
    this.assertActive();
    return this.extensions.strategy(this.run.provider, this.run.scope, capabilities);
  }

  async providerContext(): Promise<ProviderCallContext> {
    this.assertActive();
    const tenant = await this.transactions.read(this.options('channel.provider.context'), (context) => this.repository.providerTenant(context, this.run.scope));
    return { tenantId: tenant, requestId: this.execution.trace, traceId: this.execution.trace, deadline: this.execution.deadline };
  }

  async keys(): Promise<SourceSkuKey[]> {
    const catalog = channelRequired(this.dependencies.catalog, 'CHANNEL_CATALOG_PORT_MISSING');
    const keys = await this.transactions.read(this.options('channel.keys.read'), (context) => catalog.keys(context, this.run.provider, this.run.scope, this.run.cursor));
    return keys.map((externalId) => ({ externalId, region: this.run.region }));
  }

  async apply(operation: string, work: (context: WriteTransactionContext, applying: ChannelSyncRun) => Promise<void>): Promise<void> {
    this.assertActive();
    await this.transactions.write(this.options(operation), async (context) => {
      const applying = await this.repository.beginApply(context, this.run);
      this.assertActive();
      await work(context, applying);
    });
  }

  finish(context: WriteTransactionContext, run: ChannelSyncRun, outcome: SyncOutcome): Promise<void> {
    return this.repository.finish(context, {
      run,
      job: this.job,
      owner: channelOwner(this.job),
      trace: this.execution.trace,
      ...outcome,
    });
  }

  saveSource(context: WriteTransactionContext, input: Parameters<ChannelJobRepository['saveSource']>[1]): Promise<void> {
    return this.repository.saveSource(context, input);
  }

  saveStatement(context: WriteTransactionContext, input: Parameters<ChannelJobRepository['saveStatement']>[1]): Promise<void> {
    return this.repository.saveStatement(context, input);
  }

  scheduleReconciliation(context: WriteTransactionContext, reconciliation: string): Promise<void> {
    return this.repository.scheduleReconciliation(context, reconciliation, this.run.scope);
  }

  complete(): Promise<void> {
    return this.apply('channel.sync.complete', (context, applying) => this.finish(context, applying, { accepted: 0, rejected: 0, complete: true, cursor: this.run.cursor, errors: [] }));
  }

  assertActive(): void {
    if (this.execution.signal.aborted) throw this.execution.signal.reason ?? new Error('CHANNEL_SYNC_CANCELLED');
    if (Date.now() >= this.execution.deadline) throw new Error('CHANNEL_SYNC_DEADLINE_EXCEEDED');
  }

  private options(operation: string): TransactionOptions {
    return {
      tenant: this.run.scope,
      membership: 'system',
      scope: this.run.scope,
      actor: 'system',
      trace: this.execution.trace,
      operation,
      deadline: this.execution.deadline,
      signal: this.execution.signal,
      workload: 'jobs',
    };
  }
}
