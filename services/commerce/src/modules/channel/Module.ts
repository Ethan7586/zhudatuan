import { PgFinanceChannelPort } from './infrastructure/persistence/PgFinanceChannelPort';

import { PgTransactionAccess } from '../../platform/database/PgTransactionAccess';
import { defineModule } from '../../composition/DefinedModule';
import { KMS_CLIENT } from '../../pipeline/KmsPort';
import { DATABASE_POOL } from '../../platform/database/Pool';
import { PgTransactionManager } from '../../platform/database/PgTransactionManager';
import { EXTENSION_REGISTRY } from '../../composition/ExtensionRegistry';
import { CHANNEL_CAPABILITY_PORT } from '../capability/public';
import { EXTENSION_REGISTRY_PORT } from '../extension/public';
import { CHANNEL_ORGANIZATION_PORT, ORGANIZATION_READ_PORT } from '../organization/public';
import { BindingsManageHandler } from './application/handler/BindingsManageHandler';
import { ConnectionsCreateHandler } from './application/handler/ConnectionsCreateHandler';
import { ConnectionsDisableHandler } from './application/handler/ConnectionsDisableHandler';
import { ConnectionsEnableHandler } from './application/handler/ConnectionsEnableHandler';
import { ConnectionsReadHandler } from './application/handler/ConnectionsReadHandler';
import { ConnectionsTestHandler } from './application/handler/ConnectionsTestHandler';
import { ConnectionsUpdateHandler } from './application/handler/ConnectionsUpdateHandler';
import { DistributorsCreateHandler } from './application/handler/DistributorsCreateHandler';
import { DistributorsDisableHandler } from './application/handler/DistributorsDisableHandler';
import { DistributorsReadHandler } from './application/handler/DistributorsReadHandler';
import { DistributorsUpdateHandler } from './application/handler/DistributorsUpdateHandler';
import { OperationsReadHandler } from './application/handler/OperationsReadHandler';
import { OperationsReplayHandler } from './application/handler/OperationsReplayHandler';
import { QuotasManageHandler } from './application/handler/QuotasManageHandler';
import { SyncRunsCancelHandler } from './application/handler/SyncRunsCancelHandler';
import { SyncRunsReadHandler } from './application/handler/SyncRunsReadHandler';
import { SyncRunsStartHandler } from './application/handler/SyncRunsStartHandler';
import { WebhooksReceiveHandler } from './application/handler/WebhooksReceiveHandler';
import { SynchronizeChannel, type ChannelSyncDependencies } from './application/process/SynchronizeChannel';
import { PgConnectionRepository } from './infrastructure/persistence/PgConnectionRepository';
import { PgDistributorRepository } from './infrastructure/persistence/PgDistributorRepository';
import { PgExtensionStateSink } from './infrastructure/persistence/PgExtensionStateSink';
import { PgProviderOperationRepository } from './infrastructure/persistence/PgProviderOperationRepository';
import { PgSyncRunRepository } from './infrastructure/persistence/PgSyncRunRepository';
import { PgWebhookRepository } from './infrastructure/persistence/PgWebhookRepository';
import { ChannelOperationPort } from './infrastructure/persistence/ChannelOperationPort';
import { PgChannelJobRepository } from './infrastructure/persistence/PgChannelJobRepository';
import { Manifest } from './Manifest';
import { EXTENSION_STATE_PORT, FINANCE_CHANNEL_PORT, FULFILLMENT_CHANNEL_PORT, PAYMENT_CHANNEL_PORT, PROVIDER_SYNC_PORT, type ProviderSyncPort } from './public';
import { createProviderJobs } from './interface/job/JobFactory';
import { ChannelSyncJob } from './interface/job/ChannelSyncJob';

export const ChannelModule = defineModule(Manifest, {
  providerJobs: createProviderJobs,
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const extension = context.ports.get(EXTENSION_REGISTRY_PORT);
    const install = extension.install();
    const connections = new PgConnectionRepository(transactions, install, extension.enable(), extension.disable(), extension);
    const distributors = new PgDistributorRepository(transactions, context.ports.get(CHANNEL_ORGANIZATION_PORT), context.ports.get(ORGANIZATION_READ_PORT), context.ports.get(CHANNEL_CAPABILITY_PORT));
    const runs = new PgSyncRunRepository(transactions);
    const operations = new PgProviderOperationRepository(transactions);
    const webhooks = new PgWebhookRepository(transactions);
    const kms = context.service(KMS_CLIENT);
    return [
      new ConnectionsCreateHandler(connections),
      new ConnectionsUpdateHandler(connections),
      new ConnectionsReadHandler(connections),
      new ConnectionsTestHandler(connections),
      new ConnectionsEnableHandler(connections),
      new ConnectionsDisableHandler(connections),
      new DistributorsCreateHandler(distributors, kms),
      new DistributorsReadHandler(distributors),
      new DistributorsUpdateHandler(distributors, kms),
      new DistributorsDisableHandler(distributors),
      new BindingsManageHandler(distributors),
      new QuotasManageHandler(distributors),
      new SyncRunsStartHandler(runs),
      new SyncRunsReadHandler(runs),
      new SyncRunsCancelHandler(runs),
      new OperationsReadHandler(operations),
      new OperationsReplayHandler(operations),
      new WebhooksReceiveHandler(webhooks, kms),
    ];
  },
  ports: () => [{ token: FINANCE_CHANNEL_PORT, value: new PgFinanceChannelPort() }],
  jobPorts: [
    { token: FINANCE_CHANNEL_PORT, value: new PgFinanceChannelPort() },
    { token: PAYMENT_CHANNEL_PORT, value: new ChannelOperationPort() },
  ],
  providerPorts: (context) => {
    const pool = context.service(DATABASE_POOL);
    const extensions = context.service(EXTENSION_REGISTRY);
    const transactions = new PgTransactionManager(pool);
    const processor = (kind: 'catalogsync' | 'pricesync' | 'inventorysync' | 'statementsync', dependencies: ChannelSyncDependencies) =>
      new ChannelSyncJob(kind, new SynchronizeChannel(transactions, new PgChannelJobRepository(), extensions, kind, dependencies));
    const sync: ProviderSyncPort = {
      catalog(catalog) {
        return processor('catalogsync', { catalog });
      },
      price(catalog, pricing) {
        return processor('pricesync', { catalog, pricing });
      },
      inventory(catalog, inventory) {
        return processor('inventorysync', { catalog, inventory });
      },
      statement(finance) {
        return processor('statementsync', { finance });
      },
    };
    return [
      { token: PROVIDER_SYNC_PORT, value: Object.freeze(sync) },
      { token: EXTENSION_STATE_PORT, value: new PgExtensionStateSink() },
      { token: FULFILLMENT_CHANNEL_PORT, value: new ChannelOperationPort() },
    ];
  },
});
