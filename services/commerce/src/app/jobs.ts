import type { Job } from '../foundation/application/Job';
import type { JobProcessor } from '../foundation/application/JobRunner';
import { QueueJob } from '../foundation/infrastructure/QueueJob';
import { DATABASE_POOL } from '../foundation/persistence/Pool';
import { IDENTITY_SECURITY_KEYS, SECRET_STORE } from '../foundation/infrastructure/SecretStore';
import { KMS_CLIENT } from '../foundation/infrastructure/KmsClient';
import { OBJECT_STORE } from '../foundation/infrastructure/ObjectStore';
import type { Container } from '../bootstrap/Container';
import type { ModuleRegistry } from '../bootstrap/ModuleRegistry';
import type { ExtensionRegistry } from '../bootstrap/ExtensionRegistry';
import type { JobRegistry } from '../bootstrap/JobRegistry';
import { BenefitJobProcessor } from '../modules/benefit/BenefitJobs';
import { BenefitDeadletter } from '../modules/benefit/BenefitDeadletter';
import { CatalogImportProcessor } from '../modules/catalog/interface/job/CatalogImportJob';
import { PgCatalogSku } from '../modules/catalog/infrastructure/persistence/PgCatalogSku';
import { ReconciliationJobProcessor } from '../modules/finance/interface/job/ReconciliationJob';
import { SettlementJobProcessor } from '../modules/finance/interface/job/SettlementJob';
import { InvoiceJobProcessor } from '../modules/finance/interface/job/InvoiceJob';
import { FinanceDeadletter } from '../modules/finance/interface/job/FinanceDeadletter';
import { ExperienceJobProcessor } from '../modules/experience/ExperienceJobs';
import { CACHE } from '../foundation/cache/Cache';
import { IdentityNotificationJobProcessor, NotificationJobProcessor } from '../modules/notification/interface/job/NotificationJob';
import { MemberImportProcessor } from '../modules/member/interface/job/MemberImportJob';
import { PgIdentityPrincipal } from '../modules/identity/infrastructure/PgIdentityPrincipal';
import { PgIdentityRetention } from '../modules/identity/infrastructure/PgIdentityRetention';
import { InventoryImportProcessor } from '../modules/inventory/interface/job/InventoryImportJob';
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
import { RuntimeJobProcessor } from '../foundation/application/runtime/RuntimeJobs';
import { INVOICE_ISSUER } from '../modules/finance/application/port/InvoiceIssuer';
import { PAYOUT_GATEWAY } from '../modules/finance/application/port/PayoutGateway';
import { VoucherImportProcessor } from '../modules/voucher/interface/job/VoucherImportJob';
import { VoucherJobProcessor } from '../modules/voucher/VoucherJobs';
import { VoucherDeadletter } from '../modules/voucher/VoucherDeadletter';
import { AuditArchiveJobProcessor } from '../modules/audit/interface/job/AuditArchiveJob';
import { PgAuditRepository } from '../modules/audit/infrastructure/persistence/PgAuditRepository';
import { TELEMETRY } from '../foundation/telemetry/Telemetry';
import { JobMetrics } from '../foundation/telemetry/JobMetrics';
import { BenefitPort } from '../modules/benefit/BenefitPort';
import { VoucherPort } from '../modules/voucher/application/port/VoucherPort';
import { FinancePort } from '../modules/finance/FinancePort';
import { InventoryPort } from '../modules/inventory/InventoryPort';
import { MarketingPort } from '../modules/marketing/MarketingPort';
import { FulfillmentPort } from '../modules/fulfillment/FulfillmentPort';
import { ChannelOperationPort } from '../modules/channel/ChannelOperationPort';
import { PricingPort } from '../modules/pricing/PricingPort';
import { OrderPort } from '../modules/order/OrderPort';
import { PaymentHoldReleaser, PaymentSettlement } from '../modules/payment/application/PaymentSettlement';
import { RefundSettlement } from '../modules/payment/application/RefundSettlement';
import { PaymentPort } from '../modules/payment/PaymentPort';
import { PgCheckoutRepository } from '../modules/checkout/infrastructure/persistence/PgCheckoutRepository';
import { IDENTITY_ACCESS_PORT, MEMBER_IMPORT_ACCESS_PORT } from '../modules/access/public';
import { ApplyRiskDecision } from '../modules/catalog/application/command/ApplyRiskDecision';
import { DirectorySyncJob } from '../modules/organization/interface/job/DirectorySyncJob';
import { DirectoryReconcileJob } from '../modules/organization/interface/job/DirectoryReconcileJob';
import { PgDirectoryRepository } from '../modules/organization/infrastructure/persistence/PgDirectoryRepository';
import { WecomDirectoryClient } from '../modules/organization/infrastructure/adapter/wecom/WecomDirectoryClient';
import { WecomDirectoryProvider } from '../modules/organization/infrastructure/adapter/wecom/WecomDirectoryProvider';
import { WecomDirectoryMapper } from '../modules/organization/infrastructure/adapter/wecom/WecomDirectoryMapper';
import { DirectoryProviderRegistry } from '../modules/organization/application/service/DirectoryProviderRegistry';
import { MembershipLifecycle } from '../modules/organization/application/service/MembershipLifecycle';
import { DirectoryReconciler } from '../modules/organization/application/service/DirectoryReconciler';
import { DirectorySyncService } from '../modules/organization/application/service/DirectorySyncService';
import { DirectoryPolicy } from '../modules/organization/domain/policy/DirectoryPolicy';
import { FederationCleanupJob } from '../modules/identity/interface/job/FederationCleanupJob';
import { ProviderHealthJob } from '../modules/identity/interface/job/ProviderHealthJob';
import { InvitationCleanupJob } from '../modules/identity/interface/job/InvitationCleanupJob';
import { ProviderHttpClient } from '../modules/identity/infrastructure/security/ProviderHttpClient';
import { PgProviderRepository } from '../modules/identity/infrastructure/persistence/PgProviderRepository';
import { identityProviderRegistry } from '../modules/identity/infrastructure/registry/IdentityProviderRegistry';
import { ProviderResolver } from '../modules/identity/application/service/ProviderResolver';
import { ReferralEventJob } from '../modules/referral/interface/job/ReferralEventJob';
import { ReferralSettlementJob } from '../modules/referral/interface/job/ReferralSettlementJob';
import { REFERRAL_FINANCE_PORT } from '../modules/finance/public';
import { BENEFIT_MEMBER_PORT } from '../modules/member/public';
import { FINANCE_PAYMENT_PORT } from '../modules/payment/public';
import { FINANCE_CHANNEL_PORT } from '../modules/channel/public';
import { FINANCE_FULFILLMENT_PORT } from '../modules/fulfillment/public';
import { ORGANIZATION_READ_PORT } from '../modules/organization/public';
import { MEMBER_ACCESS_PORT } from '../modules/access/public';
import { NOTIFICATION_IDENTITY_PORT } from '../modules/identity/public';

import { ORDINARY_JOB_CATALOG, jobDefinition, type JobKind } from './JobCatalog';

export { JOB_CATALOG, ORDINARY_JOB_CATALOG } from './JobCatalog';

export function registerJobs(registry: JobRegistry, container: Container, _extensions: ExtensionRegistry, workerId: string, modules: ModuleRegistry, batch = 100, poll = 1_000): void {
  const pool = container.get(DATABASE_POOL);
  const secrets = container.get(SECRET_STORE);
  const kms = container.get(KMS_CLIENT);
  const gateway = container.get(PAYMENT_GATEWAY);
  const deliveries = container.get(DELIVERY_REGISTRY);
  const objects = container.get(OBJECT_STORE);
  const cache = container.get(CACHE);
  const invoices = container.get(INVOICE_ISSUER);
  const payouts = container.get(PAYOUT_GATEWAY);
  const metrics = new JobMetrics(container.get(TELEMETRY));
  const voucherDeadletter = new VoucherDeadletter();
  const benefitDeadletter = new BenefitDeadletter();
  const financeDeadletter = new FinanceDeadletter();
  const notificationDispatch = new DispatchNotification(new PgNotificationRepository(pool, modules.port(NOTIFICATION_IDENTITY_PORT), modules.port(MEMBER_ACCESS_PORT), modules.port(ORGANIZATION_READ_PORT)), kms, deliveries);
  const financePort = new FinancePort();
  const paymentBenefit = new BenefitPort(financePort);
  const paymentVoucher = new VoucherPort(financePort);
  const marketingPort = new MarketingPort();
  const orderPort = new OrderPort();
  const paymentDeadletter = new PaymentDeadletter(orderPort);
  const checkoutSessionPort = new PgCheckoutRepository();
  const paymentPort = new PaymentPort();
  const identityRetentionPort = new PgIdentityRetention();
  const identityAccess = modules.port(IDENTITY_ACCESS_PORT);
  const memberImportAccess = modules.port(MEMBER_IMPORT_ACCESS_PORT);
  const referralFinance = modules.port(REFERRAL_FINANCE_PORT);
  const benefitMembers = modules.port(BENEFIT_MEMBER_PORT);
  const reconciliationDependencies = Object.freeze({
    channel: modules.port(FINANCE_CHANNEL_PORT),
    fulfillments: modules.port(FINANCE_FULFILLMENT_PORT),
    payments: modules.port(FINANCE_PAYMENT_PORT),
  });
  const identityKeys = container.get(IDENTITY_SECURITY_KEYS);
  const providerClient = new ProviderHttpClient(secrets);
  const providerRepository = new PgProviderRepository(providerClient, identityKeys.identity);
  const providerResolver = new ProviderResolver(providerRepository, identityProviderRegistry(providerClient, identityKeys.identity));
  const directoryRepository = new PgDirectoryRepository();
  const directoryClient = new WecomDirectoryClient(secrets);
  const directoryProviders = new DirectoryProviderRegistry([new WecomDirectoryProvider('wecomcorp', directoryClient), new WecomDirectoryProvider('wecomsuite', directoryClient)]);
  const membershipLifecycle = new MembershipLifecycle(identityAccess);
  const directoryReconciler = new DirectoryReconciler(directoryRepository, membershipLifecycle);
  const directoryService = new DirectorySyncService(pool, directoryRepository, directoryProviders, new WecomDirectoryMapper(identityKeys.identity), directoryReconciler, new DirectoryPolicy(), membershipLifecycle, kms);
  const directorySyncDefinition = jobDefinition('directorysync');
  const directoryReconcileDefinition = jobDefinition('directoryreconcile');
  const providerHealthDefinition = jobDefinition('providerhealth');
  const inventoryPort = new InventoryPort();
  const pricingPort = new PricingPort();
  const channelOperationPort = new ChannelOperationPort();
  const holdReleaser = new PaymentHoldReleaser(paymentBenefit, paymentVoucher, inventoryPort, marketingPort);
  const orderExpiryDependencies = Object.freeze({ payments: paymentPort, checkouts: checkoutSessionPort, inventory: inventoryPort, orders: orderPort, holds: holdReleaser });
  const runtimeDependencies = Object.freeze({ identity: identityRetentionPort, checkout: checkoutSessionPort, pricing: pricingPort });
  const paymentDependencies = Object.freeze({
    settlement: new PaymentSettlement(paymentBenefit, paymentVoucher, inventoryPort, marketingPort, new FulfillmentPort(), orderPort),
    refundSettlement: new RefundSettlement(paymentBenefit, paymentVoucher, orderPort, modules.port(ORGANIZATION_READ_PORT)),
    orders: orderPort,
    operations: channelOperationPort,
    holds: holdReleaser,
  });
  const processors: Readonly<Partial<Record<JobKind, JobProcessor>>> = Object.freeze({
    experiencepublish: new ExperienceJobProcessor(pool, objects, cache),
    orderexpiry: new OrderExpiryJobProcessor(pool, orderExpiryDependencies),
    paymentquery: new PaymentJobProcessor(pool, gateway, 'paymentquery', paymentDependencies),
    paymentrefund: new PaymentJobProcessor(pool, gateway, 'paymentrefund', paymentDependencies),
    benefitgrant: new BenefitJobProcessor(pool, financePort, benefitMembers),
    benefitexpiry: new BenefitJobProcessor(pool, financePort, benefitMembers, 'benefitexpiry'),
    voucherissue: new VoucherJobProcessor(pool, kms, financePort, 'voucherissue'),
    voucherstatus: new VoucherJobProcessor(pool, kms, financePort, 'voucherstatus'),
    voucherexpiry: new VoucherJobProcessor(pool, kms, financePort, 'voucherexpiry'),
    referralevent: new ReferralEventJob(pool, referralFinance),
    referralsettlement: new ReferralSettlementJob(pool, referralFinance),
    reconciliation: new ReconciliationJobProcessor(pool, objects, reconciliationDependencies),
    settlement: new SettlementJobProcessor(pool, payouts),
    invoice: new InvoiceJobProcessor(pool, objects, kms, invoices),
    identitynotification: new IdentityNotificationJobProcessor(notificationDispatch),
    notification: new NotificationJobProcessor(notificationDispatch),
    projection: new ProjectionJobProcessor(pool, cache),
    export: new ExportJobRunner(pool, objects, jobDefinition('export').retry.attempts),
    riskscan: new RiskReplayJobProcessor(pool, new ApplyRiskDecision()),
    cleanup: new RuntimeJobProcessor(pool, runtimeDependencies),
    memberimport: new MemberImportProcessor(pool, objects, new PgIdentityPrincipal(), memberImportAccess),
    catalogimport: new CatalogImportProcessor(pool, objects),
    inventoryimport: new InventoryImportProcessor(pool, objects, new PgCatalogSku()),
    voucherimport: new VoucherImportProcessor(pool, objects, kms),
    supportsla: new SupportJobProcessor(pool, objects, 'supportsla'),
    supportscan: new SupportJobProcessor(pool, objects, 'supportscan'),
    auditarchive: new AuditArchiveJobProcessor(pool, objects, kms, new PgAuditRepository()),
    directorysync: new DirectorySyncJob(pool, directoryService, directorySyncDefinition.lease, directorySyncDefinition.retry.attempts),
    directoryreconcile: new DirectoryReconcileJob(pool, directoryReconcileDefinition.lease),
    federationcleanup: new FederationCleanupJob(pool),
    providerhealth: new ProviderHealthJob(pool, providerResolver, providerHealthDefinition.concurrency),
    invitationcleanup: new InvitationCleanupJob(pool, container.get(TELEMETRY)),
  });
  for (const definition of ORDINARY_JOB_CATALOG) {
    const processor = processors[definition.id];
    if (!processor) throw new Error(`JOB_PROCESSOR_MISSING:${definition.id}`);
    const job: Job<void> = new QueueJob(
      definition.id,
      pool,
      {
        worker: workerId,
        workload: 'jobs',
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
      processor,
      definition.owner === 'payment' ? paymentDeadletter : definition.owner === 'voucher' ? voucherDeadletter : definition.owner === 'benefit' ? benefitDeadletter : definition.owner === 'finance' ? financeDeadletter : undefined,
      metrics
    );
    registry.register({
      id: definition.id,
      job,
      lease: definition.lease,
      batch,
      concurrency: definition.concurrency,
      deadline: definition.timeout,
      ...(['directorysync', 'directoryreconcile'].includes(definition.id) ? { resourceLease: { prefix: 'directory', seconds: definition.lease } } : {}),
    });
  }
}
