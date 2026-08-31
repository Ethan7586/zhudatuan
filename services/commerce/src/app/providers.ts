import type { Job } from '../foundation/application/Job';
import type { JobProcessor } from '../foundation/application/JobRunner';
import { QueueJob } from '../foundation/infrastructure/QueueJob';
import { KMS_CLIENT } from '../foundation/infrastructure/KmsClient';
import { SECRET_STORE } from '../foundation/infrastructure/SecretStore';
import { DATABASE_POOL } from '../foundation/persistence/Pool';
import { TELEMETRY } from '../foundation/telemetry/Telemetry';
import { JobMetrics } from '../foundation/telemetry/JobMetrics';
import { ProviderMetrics } from '../foundation/telemetry/ProviderMetrics';
import type { Container } from '../bootstrap/Container';
import type { ExtensionRegistry } from '../bootstrap/ExtensionRegistry';
import type { JobRegistry } from '../bootstrap/JobRegistry';
import { CatalogSourcePort } from '../modules/catalog/CatalogSourcePort';
import { ChannelOperationPort } from '../modules/channel/ChannelOperationPort';
import { channelExtensionSink } from '../modules/channel/ChannelModule';
import { ChannelJobProcessor } from '../modules/channel/interface/job/ChannelSyncJob';
import { ChannelWebhookJobProcessor } from '../modules/channel/interface/job/ChannelWebhookJob';
import { extensionRepository } from '../modules/extension/ExtensionModule';
import { EXTENSION_LOADER } from '../modules/extension/application/port/ExtensionLoader';
import { ExtensionHealthJobProcessor } from '../modules/extension/interface/job/ExtensionHealthJob';
import { FinancePort } from '../modules/finance/FinancePort';
import { FulfillmentJobProcessor } from '../modules/fulfillment/FulfillmentJobs';
import { PgInventoryReturnPort } from '../modules/fulfillment/public';
import { InventoryPort } from '../modules/inventory/InventoryPort';
import { InventorySyncJobProcessor } from '../modules/inventory/interface/job/InventorySyncJob';
import { OrderPort } from '../modules/order/OrderPort';
import { PgOrganizationReadPort } from '../modules/organization/public';
import { PricingPort } from '../modules/pricing/PricingPort';
import { PROVIDER_JOB_CATALOG, type ProviderJobKind } from './JobCatalog';

export { PROVIDER_JOB_CATALOG } from './JobCatalog';

export function registerProviders(registry: JobRegistry, container: Container, extensions: ExtensionRegistry, worker: string, batch = 100, poll = 1_000): void {
  const pool = container.get(DATABASE_POOL);
  const secrets = container.get(SECRET_STORE);
  const kms = container.get(KMS_CLIENT);
  const loader = container.get(EXTENSION_LOADER);
  const telemetry = container.get(TELEMETRY);
  const operations = new ChannelOperationPort();
  const orders = new OrderPort();
  const organizations = new PgOrganizationReadPort();
  const channel = Object.freeze({ catalog: new CatalogSourcePort(), pricing: new PricingPort(), inventory: new InventoryPort(), finance: new FinancePort() });
  const fulfillment = Object.freeze({ operations, orders, organizations });
  const processors: Readonly<Record<ProviderJobKind, JobProcessor>> = Object.freeze({
    catalogsync: new ChannelJobProcessor(pool, extensions, secrets, 'catalogsync', channel),
    pricesync: new ChannelJobProcessor(pool, extensions, secrets, 'pricesync', channel),
    inventorysync: new InventorySyncJobProcessor(pool, new ChannelJobProcessor(pool, extensions, secrets, 'inventorysync', channel), new PgInventoryReturnPort(orders)),
    statementsync: new ChannelJobProcessor(pool, extensions, secrets, 'statementsync', channel),
    channelwebhook: new ChannelWebhookJobProcessor(pool, extensions, kms),
    fulfillment: new FulfillmentJobProcessor(pool, extensions, secrets, 'fulfillment', fulfillment),
    tracking: new FulfillmentJobProcessor(pool, extensions, secrets, 'tracking', fulfillment),
    extensionhealth: new ExtensionHealthJobProcessor(pool, extensionRepository, loader, channelExtensionSink(), new ProviderMetrics(telemetry)),
  });
  const metrics = new JobMetrics(telemetry);
  for (const definition of PROVIDER_JOB_CATALOG) {
    const job: Job<void> = new QueueJob(
      definition.id,
      pool,
      {
        worker,
        workload: 'provider',
        owner: definition.owner,
        batch,
        poll,
        lease: definition.lease,
        concurrency: definition.concurrency,
        attempts: definition.retry.attempts,
        deadline: definition.timeout,
        retryMinimum: definition.retry.minimum,
        retryMaximum: definition.retry.maximum,
      },
      processors[definition.id],
      undefined,
      metrics
    );
    registry.register({ id: definition.id, job, lease: definition.lease, batch, concurrency: definition.concurrency, deadline: definition.timeout });
  }
}
