import type { ProviderCapability } from '@shop/contract';
import type { ExtensionRegistry } from '../../../../composition/ExtensionRegistry';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { TransactionManager, TransactionOptions } from '../../../../platform/database/TransactionManager';
import { ChannelPolicy } from '../../domain/policy/ChannelPolicy';
import { SyncPolicy } from '../../domain/policy/SyncPolicy';
import type { ChannelJobRepository, ChannelSyncKind, ChannelSyncRun } from '../port/ChannelJobRepository';
import { synchronizeCatalog } from './CatalogSync';
import { synchronizePrice } from './PriceSync';
import { SyncSession, type ChannelSyncDependencies, type ChannelSyncExecution } from './SyncSession';
import { synchronizeStatement } from './StatementSync';
import { synchronizeStock } from './StockSync';

export type { ChannelSyncDependencies, ChannelSyncExecution } from './SyncSession';

type SyncStage = (session: SyncSession) => Promise<void>;

const STAGES: Readonly<Record<ChannelSyncRun['kind'], SyncStage>> = Object.freeze({
  catalog: synchronizeCatalog,
  price: synchronizePrice,
  stock: synchronizeStock,
  statement: synchronizeStatement,
});

export class SynchronizeChannel {
  private readonly channelPolicy = new ChannelPolicy();
  private readonly syncPolicy = new SyncPolicy();
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: ChannelJobRepository,
    private readonly extensions: ExtensionRegistry,
    private readonly kind: ChannelSyncKind,
    private readonly dependencies: ChannelSyncDependencies
  ) {}

  async execute(id: string, execution: ChannelSyncExecution): Promise<void> {
    if (execution.job !== this.kind) throw new Error('CHANNEL_SYNC_JOB_KIND_MISMATCH');
    assertExecution(execution);
    const run = await this.claim(id, execution);
    this.syncPolicy.requireRunnable('running', run.kind, syncKind(this.kind));
    await STAGES[run.kind](new SyncSession(run, execution, this.dependencies, this.transactions, this.repository, this.extensions, this.kind));
  }

  fail(context: WriteTransactionContext, run: string, scope: string, cause: unknown): Promise<void> {
    return this.repository.fail(context, run, scope, this.syncPolicy.terminal(cause));
  }

  private async claim(id: string, execution: ChannelSyncExecution): Promise<ChannelSyncRun> {
    const run = await this.transactions.write(options(execution.scope, 'channel.sync.claim', execution), (context) => this.repository.claim(context, id, execution.scope));
    if (!run) throw new Error('CHANNEL_SYNC_RUN_NOT_RUNNABLE');
    if (run.scope !== execution.scope) throw new Error('CHANNEL_SYNC_SCOPE_MISMATCH');
    this.channelPolicy.requireAnyCapability(run.connectionState, run.capabilities, syncCapabilities(run.kind));
    if (!this.extensions.has(run.provider, run.scope)) throw new Error('PROVIDER_INSTALLATION_NOT_ACTIVE');
    return run;
  }
}

function assertExecution(execution: ChannelSyncExecution): void {
  if (execution.signal.aborted) throw execution.signal.reason ?? new Error('CHANNEL_SYNC_CANCELLED');
  if (Date.now() >= execution.deadline) throw new Error('CHANNEL_SYNC_DEADLINE_EXCEEDED');
}

function options(scope: string, operation: string, execution: ChannelSyncExecution): TransactionOptions {
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

function syncKind(kind: ChannelSyncKind): ChannelSyncRun['kind'] {
  return kind === 'catalogsync' ? 'catalog' : kind === 'pricesync' ? 'price' : kind === 'inventorysync' ? 'stock' : 'statement';
}

function syncCapabilities(kind: ChannelSyncRun['kind']): readonly ProviderCapability[] {
  if (kind === 'catalog') return ['Catalog', 'Brand', 'Store', 'Menu', 'Option', 'Cinema', 'Show'];
  if (kind === 'stock') return ['Inventory', 'GeoStock', 'TimeSlot', 'GeoDelivery'];
  return kind === 'price' ? ['Price'] : ['Statement'];
}
