import type { Job } from '../foundation/application/Job';
import type { JobProcessor } from '../foundation/application/JobRunner';
import { QueueJob } from '../foundation/infrastructure/QueueJob';
import { DATABASE_POOL } from '../foundation/persistence/Pool';
import { SECRET_STORE } from '../foundation/infrastructure/SecretStore';
import { KMS_CLIENT } from '../foundation/infrastructure/KmsClient';
import { OBJECT_STORE } from '../foundation/infrastructure/ObjectStore';
import type { Container } from '../bootstrap/Container';
import type { ExtensionRegistry } from '../bootstrap/ExtensionRegistry';
import type { JobRegistry } from '../bootstrap/JobRegistry';
import { BenefitJobProcessor } from '../modules/benefit/BenefitJobs';
import { BenefitDeadletter } from '../modules/benefit/BenefitDeadletter';
import { CatalogImportProcessor } from '../modules/catalog/interface/job/CatalogImportJob';
import { catalogSku } from '../modules/catalog/CatalogModule';
import { ChannelJobProcessor } from '../modules/channel/interface/job/ChannelSyncJob';
import { ChannelWebhookJobProcessor } from '../modules/channel/interface/job/ChannelWebhookJob';
import { ReconciliationJobProcessor } from '../modules/finance/interface/job/ReconciliationJob';
import { SettlementJobProcessor } from '../modules/finance/interface/job/SettlementJob';
import { InvoiceJobProcessor } from '../modules/finance/interface/job/InvoiceJob';
import { FinanceDeadletter } from '../modules/finance/interface/job/FinanceDeadletter';
import { FulfillmentJobProcessor } from '../modules/fulfillment/FulfillmentJobs';
import { ExperienceJobProcessor } from '../modules/experience/ExperienceJobs';
import { CACHE } from '../foundation/cache/Cache';
import { NotificationJobProcessor } from '../modules/notification/interface/job/NotificationJob';
import { MemberImportProcessor } from '../modules/member/interface/job/MemberImportJob';
import { identityPrincipal } from '../modules/identity/IdentityModule';
import { InventoryImportProcessor } from '../modules/inventory/interface/job/InventoryImportJob';
import { InventorySyncJobProcessor } from '../modules/inventory/interface/job/InventorySyncJob';
import { DELIVERY_REGISTRY } from '../modules/notification/application/DeliveryRegistry';
import { DispatchNotification } from '../modules/notification/application/command/DispatchNotification';
import { PgNotificationRepository } from '../modules/notification/infrastructure/persistence/PgNotificationRepository';
import { OrderExpiryJobProcessor } from '../modules/order/OrderJobs';
import { PaymentJobProcessor } from '../modules/payment/PaymentJobs';
import { PaymentDeadletter } from '../modules/payment/PaymentDeadletter';
import { PAYMENT_GATEWAY } from '../modules/payment/application/port/PaymentGateway';
import { ExportJobRunner } from '../modules/reporting/interface/job/ExportJobRunner';
import { ProjectionJobProcessor } from '../modules/reporting/interface/job/ProjectionJob';
import { RiskReplayJobProcessor } from '../modules/risk/interface/job/RiskReplayJob';
import { SupportJobProcessor } from '../modules/support/interface/job/SlaJob';
import { RuntimeJobProcessor } from '../modules/runtime/RuntimeJobs';
import { INVOICE_ISSUER } from '../modules/finance/application/port/InvoiceIssuer';
import { PAYOUT_GATEWAY } from '../modules/finance/application/port/PayoutGateway';
import { VoucherImportProcessor } from '../modules/voucher/interface/job/VoucherImportJob';
import { VoucherJobProcessor } from '../modules/voucher/VoucherJobs';
import { VoucherDeadletter } from '../modules/voucher/VoucherDeadletter';
import { AuditArchiveJobProcessor } from '../modules/audit/interface/job/AuditArchiveJob';
import { PgAuditRepository } from '../modules/audit/infrastructure/persistence/PgAuditRepository';
import { ExtensionHealthJobProcessor } from '../modules/extension/interface/job/ExtensionHealthJob';
import { EXTENSION_LOADER } from '../modules/extension/application/port/ExtensionLoader';
import { extensionRepository } from '../modules/extension/ExtensionModule';
import { channelExtensionSink } from '../modules/channel/ChannelModule';
import { TELEMETRY } from '../foundation/telemetry/Telemetry';
import { JobMetrics } from '../foundation/telemetry/JobMetrics';
import { ProviderMetrics } from '../foundation/telemetry/ProviderMetrics';

export interface JobCatalogEntry {
  readonly id: string;
  readonly owner: string;
  readonly queue: string;
  readonly concurrency: number;
  readonly timeout: number;
  readonly retry: Readonly<{ attempts: number; minimum: number; maximum: number; jitter: true }>;
  readonly lease: number;
  readonly idempotency: 'jobid';
  readonly deadLetter: 'runtime.deadletter';
  readonly runbook: string;
  readonly worker: string;
}

function registerJob<const T extends JobCatalogEntry>(definition: T): Readonly<T> { return Object.freeze(definition); }

const worker = 'services/commerce/src/foundation/application/JobRunner.ts';
const retry = Object.freeze({ attempts: 8, minimum: 250, maximum: 60_000, jitter: true as const });

export const JOB_CATALOG = Object.freeze([
  registerJob({ id: 'catalogsync', owner: 'channel', queue: 'channel', concurrency: 8, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/catalogsync.md', worker }),
  registerJob({ id: 'pricesync', owner: 'pricing', queue: 'channel', concurrency: 8, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/pricesync.md', worker }),
  registerJob({ id: 'inventorysync', owner: 'inventory', queue: 'channel', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/inventorysync.md', worker }),
  registerJob({ id: 'experiencepublish', owner: 'experience', queue: 'experience', concurrency: 8, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/experiencepublish.md', worker }),
  registerJob({ id: 'statementsync', owner: 'channel', queue: 'channel', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/statementsync.md', worker }),
  registerJob({ id: 'channelwebhook', owner: 'channel', queue: 'channel', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/channelwebhook.md', worker }),
  registerJob({ id: 'orderexpiry', owner: 'order', queue: 'transaction', concurrency: 16, timeout: 15_000, retry, lease: 30, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/orderexpiry.md', worker }),
  registerJob({ id: 'paymentquery', owner: 'payment', queue: 'payment', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/paymentquery.md', worker }),
  registerJob({ id: 'paymentrefund', owner: 'payment', queue: 'payment', concurrency: 8, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/paymentrefund.md', worker }),
  registerJob({ id: 'fulfillment', owner: 'fulfillment', queue: 'fulfillment', concurrency: 16, timeout: 45_000, retry, lease: 90, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/fulfillment.md', worker }),
  registerJob({ id: 'tracking', owner: 'fulfillment', queue: 'fulfillment', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/tracking.md', worker }),
  registerJob({ id: 'benefitgrant', owner: 'benefit', queue: 'benefit', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/benefitgrant.md', worker }),
  registerJob({ id: 'benefitexpiry', owner: 'benefit', queue: 'benefit', concurrency: 8, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/benefitexpiry.md', worker }),
  registerJob({ id: 'voucherissue', owner: 'voucher', queue: 'benefit', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/voucherissue.md', worker }),
  registerJob({ id: 'voucherstatus', owner: 'voucher', queue: 'benefit', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/voucherstatus.md', worker }),
  registerJob({ id: 'voucherexpiry', owner: 'voucher', queue: 'benefit', concurrency: 8, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/voucherexpiry.md', worker }),
  registerJob({ id: 'reconciliation', owner: 'finance', queue: 'finance', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/reconciliation.md', worker }),
  registerJob({ id: 'settlement', owner: 'finance', queue: 'finance', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/settlement.md', worker }),
  registerJob({ id: 'invoice', owner: 'finance', queue: 'finance', concurrency: 4, timeout: 60_000, retry, lease: 90, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/invoice.md', worker }),
  registerJob({ id: 'notification', owner: 'notification', queue: 'notification', concurrency: 32, timeout: 15_000, retry, lease: 30, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/notification.md', worker }),
  registerJob({ id: 'projection', owner: 'reporting', queue: 'projection', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/projection.md', worker }),
  registerJob({ id: 'export', owner: 'reporting', queue: 'export', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/export.md', worker }),
  registerJob({ id: 'riskscan', owner: 'risk', queue: 'risk', concurrency: 8, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/riskscan.md', worker }),
  registerJob({ id: 'cleanup', owner: 'runtime', queue: 'maintenance', concurrency: 2, timeout: 60_000, retry, lease: 90, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/cleanup.md', worker }),
  registerJob({ id: 'memberimport', owner: 'member', queue: 'import', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/memberimport.md', worker }),
  registerJob({ id: 'catalogimport', owner: 'catalog', queue: 'import', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/catalogimport.md', worker }),
  registerJob({ id: 'inventoryimport', owner: 'inventory', queue: 'import', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/inventoryimport.md', worker }),
  registerJob({ id: 'voucherimport', owner: 'voucher', queue: 'import', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/voucherimport.md', worker }),
  registerJob({ id: 'supportsla', owner: 'support', queue: 'support', concurrency: 8, timeout: 15_000, retry, lease: 30, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/supportsla.md', worker }),
  registerJob({ id: 'supportscan', owner: 'support', queue: 'support', concurrency: 8, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/supportscan.md', worker }),
  registerJob({ id: 'auditarchive', owner: 'audit', queue: 'maintenance', concurrency: 2, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/auditarchive.md', worker }),
  registerJob({ id: 'extensionhealth', owner: 'extension', queue: 'maintenance', concurrency: 8, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter: 'runtime.deadletter', runbook: 'docs/operations/extensionhealth.md', worker }),
] satisfies readonly JobCatalogEntry[]);

export type JobKind = typeof JOB_CATALOG[number]['id'];

if (new Set(JOB_CATALOG.map(({ id }) => id)).size !== JOB_CATALOG.length) throw new Error('JOB_CATALOG_DUPLICATE');

export function registerJobs(registry: JobRegistry, container: Container, extensions: ExtensionRegistry, workerId: string, batch = 100, poll = 1_000): void {
  const pool = container.get(DATABASE_POOL);
  const secrets = container.get(SECRET_STORE);
  const kms = container.get(KMS_CLIENT);
  const gateway = container.get(PAYMENT_GATEWAY);
  const deliveries = container.get(DELIVERY_REGISTRY);
  const objects = container.get(OBJECT_STORE);
  const cache = container.get(CACHE);
  const invoices = container.get(INVOICE_ISSUER);
  const payouts = container.get(PAYOUT_GATEWAY);
  const extensionLoader=container.get(EXTENSION_LOADER);
  const metrics = new JobMetrics(container.get(TELEMETRY));
  const paymentDeadletter = new PaymentDeadletter();
  const voucherDeadletter = new VoucherDeadletter();
  const benefitDeadletter = new BenefitDeadletter();
  const financeDeadletter = new FinanceDeadletter();
  const processors: Readonly<Record<JobKind, JobProcessor>> = Object.freeze({
    catalogsync: new ChannelJobProcessor(pool, extensions, secrets, 'catalogsync'),
    pricesync: new ChannelJobProcessor(pool, extensions, secrets, 'pricesync'),
    inventorysync: new InventorySyncJobProcessor(pool, new ChannelJobProcessor(pool, extensions, secrets, 'inventorysync')),
    experiencepublish: new ExperienceJobProcessor(pool, objects, cache),
    statementsync: new ChannelJobProcessor(pool, extensions, secrets, 'statementsync'),
    channelwebhook: new ChannelWebhookJobProcessor(pool),
    orderexpiry: new OrderExpiryJobProcessor(pool),
    paymentquery: new PaymentJobProcessor(pool, gateway, 'paymentquery'),
    paymentrefund: new PaymentJobProcessor(pool, gateway, 'paymentrefund'),
    fulfillment: new FulfillmentJobProcessor(pool, extensions, secrets, 'fulfillment'),
    tracking: new FulfillmentJobProcessor(pool, extensions, secrets, 'tracking'),
    benefitgrant: new BenefitJobProcessor(pool),
    benefitexpiry: new BenefitJobProcessor(pool, 'benefitexpiry'),
    voucherissue: new VoucherJobProcessor(pool, kms, 'voucherissue'),
    voucherstatus: new VoucherJobProcessor(pool, kms, 'voucherstatus'),
    voucherexpiry: new VoucherJobProcessor(pool, kms, 'voucherexpiry'),
    reconciliation: new ReconciliationJobProcessor(pool, objects),
    settlement: new SettlementJobProcessor(pool, payouts),
    invoice: new InvoiceJobProcessor(pool, objects, kms, invoices),
    notification: new NotificationJobProcessor(new DispatchNotification(new PgNotificationRepository(pool), kms, deliveries)),
    projection: new ProjectionJobProcessor(pool, cache),
    export: new ExportJobRunner(pool, objects, retry.attempts),
    riskscan: new RiskReplayJobProcessor(pool),
    cleanup: new RuntimeJobProcessor(pool),
    memberimport: new MemberImportProcessor(pool, objects, identityPrincipal),
    catalogimport: new CatalogImportProcessor(pool, objects),
    inventoryimport: new InventoryImportProcessor(pool, objects, catalogSku),
    voucherimport: new VoucherImportProcessor(pool, objects, kms),
    supportsla: new SupportJobProcessor(pool, objects, 'supportsla'),
    supportscan: new SupportJobProcessor(pool, objects, 'supportscan'),
    auditarchive: new AuditArchiveJobProcessor(pool, objects, kms, new PgAuditRepository()),
    extensionhealth:new ExtensionHealthJobProcessor(pool,extensionRepository,extensionLoader,channelExtensionSink(),
      new ProviderMetrics(container.get(TELEMETRY))),
  });
  for (const definition of JOB_CATALOG) {
    const job: Job<void> = new QueueJob(definition.id, pool,
      { worker: workerId, owner: definition.owner, batch, poll, lease: definition.lease, concurrency: definition.concurrency, attempts: definition.retry.attempts,
        deadline: definition.timeout, retryMinimum: definition.retry.minimum, retryMaximum: definition.retry.maximum }, processors[definition.id],
      definition.owner === 'payment' ? paymentDeadletter : definition.owner === 'voucher' ? voucherDeadletter
        : definition.owner === 'benefit' ? benefitDeadletter : definition.owner === 'finance' ? financeDeadletter : undefined, metrics);
    registry.register({ id: definition.id, job, lease: definition.lease, batch, concurrency: definition.concurrency, deadline: definition.timeout });
  }
}
