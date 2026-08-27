import { SystemClock } from '@shop/kernel';
import type { Telemetry } from '@shop/telemetry';
import type { OperationId } from '@shop/contract';
import { apiReturnTargets, WechatApplicationCatalog, type ApiEnvironment, type JobsEnvironment } from '@shop/config/server';
import { AccessPipeline } from '../foundation/security/AccessPipeline';
import { PgAccessVersionResolver, PgCapabilityResolver, PgMembershipResolver, PgScopeResolver, PgSessionResolver } from '../foundation/security/PgAccessResolvers';
import { PipelineAuthorizer } from '../foundation/security/PipelineAuthorizer';
import type { OperationHandler } from '../foundation/application/OperationHandler';
import { createPool, type DatabasePool } from '../foundation/persistence/Pool';
import { SECURITY_KEYS, SECRET_STORE, WorkloadSecretStore } from '../foundation/infrastructure/SecretStore';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS } from '../foundation/interface/OperationController';
import { DATABASE_POOL } from '../foundation/persistence/Pool';
import { QUERY_METRICS, QueryMetrics } from '../foundation/persistence/QueryMetrics';
import { KMS_CLIENT, KmsClient } from '../foundation/infrastructure/KmsClient';
import { COMMERCE_MODULES } from '../app/modules';
import { ExtensionRegistry } from './ExtensionRegistry';
import { MANIFEST_VERIFIER, SignatureVerifier } from './SignatureVerifier';
import { loadProviders } from './ProviderLoader';
import type { Container } from './Container';
import { PgDecisionSink } from '../modules/access/infrastructure/persistence/PgDecisionSink';
import { RiskCheckAdapter } from '../modules/risk/infrastructure/persistence/RiskCheckAdapter';
import { RISK_GATE } from '../foundation/security/RiskGate';
import { PAYMENT_GATEWAY } from '../modules/payment/application/port/PaymentGateway';
import { WechatGateway } from '../modules/payment/infrastructure/adapter/WechatGateway';
import { DELIVERY_REGISTRY, DeliveryRegistry } from '../modules/notification/application/DeliveryRegistry';
import { AliyunSmsChannel } from '../modules/notification/infrastructure/adapter/AliyunSmsChannel';
import { InappChannel } from '../modules/notification/infrastructure/adapter/InappChannel';
import { EmailChannel } from '../modules/notification/infrastructure/adapter/EmailChannel';
import { WechatChannel } from '../modules/notification/infrastructure/adapter/WechatChannel';
import { parseDeliveryConfiguration } from '../modules/notification/infrastructure/adapter/DeliveryConfiguration';
import { HttpObjectStore, OBJECT_STORE } from '../foundation/infrastructure/ObjectStore';
import { WECHAT_IDENTITY } from '../modules/identity/application/port/WechatIdentity';
import { WechatIdentityGateway, type WechatIdentityConfiguration } from '../modules/identity/infrastructure/adapter/WechatIdentityGateway';
import { INVOICE_ISSUER } from '../modules/finance/application/port/InvoiceIssuer';
import { InvoiceGateway, type InvoiceConfiguration } from '../modules/finance/infrastructure/adapter/InvoiceGateway';
import { PAYOUT_GATEWAY } from '../modules/finance/application/port/PayoutGateway';
import { PayoutGateway, type PayoutConfiguration } from '../modules/finance/infrastructure/adapter/PayoutGateway';
import { CACHE } from '../foundation/cache/Cache';
import { RedisCache } from '../foundation/cache/RedisCache';
import { RETURN_TARGETS } from '../modules/identity/infrastructure/ReturnTargetCatalog';
import { AUDIT_SINK } from '../foundation/application/AuditSink';
import { RecordAudit } from '../modules/audit/application/command/RecordAudit';
import { PgAuditRepository } from '../modules/audit/infrastructure/persistence/PgAuditRepository';
import { AUDIT_PORT } from '../modules/audit/application/port/AuditPort';
import { EXTENSION_LOADER } from '../modules/extension/application/port/ExtensionLoader';
import { commerceTelemetry, TELEMETRY } from '../foundation/telemetry/Telemetry';
import { DependencyMetrics } from '../foundation/telemetry/DependencyMetrics';
import type { WechatPayConfigSource } from '@shop/wechatpayment';

export interface CommerceRuntime {
  readonly pool: DatabasePool;
  readonly cache: RedisCache;
  readonly extensions: ExtensionRegistry;
  readonly telemetry: Telemetry;
  readonly configure: (container: Container) => void;
  close(): Promise<void>;
}

export async function createRuntime(environment: ApiEnvironment | JobsEnvironment, workload: 'api' | 'jobs'): Promise<CommerceRuntime> {
  const endpoint = required(environment.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING');
  const secrets = new WorkloadSecretStore(endpoint);
  const telemetry = commerceTelemetry();
  const dependencies = new DependencyMetrics(telemetry);
  const bootstrapContext = { requestId: `bootstrap:${workload}`, traceId: `bootstrap:${workload}`, module: 'runtime', operation: 'bootstrap' };
  const connectionRef = workload === 'api'
    ? required((environment as ApiEnvironment).DATABASE_API_CONNECTION_REF, 'DATABASE_API_CONNECTION_REF_MISSING')
    : required((environment as JobsEnvironment).DATABASE_JOB_CONNECTION_REF, 'DATABASE_JOB_CONNECTION_REF_MISSING');
  const connection = await dependencies.measure('secretstore', bootstrapContext, () => secrets.read(connectionRef));
  const manifestKey = await dependencies.measure('secretstore', bootstrapContext,
    () => secrets.read(required(environment.EXTENSION_MANIFEST_KEY_REF, 'EXTENSION_MANIFEST_KEY_REF_MISSING')));
  const queryMetrics = new QueryMetrics();
  const pool = createPool(connection, workload === 'api' ? 'api' : 'jobs', queryMetrics);
  const cache = new RedisCache(() => secrets.read(required(environment.REDIS_CONNECTION_REF, 'REDIS_CONNECTION_REF_MISSING')));
  await cache.start();
  const role = await pool.query<{ current_user: string }>('select current_user');
  const expectedRole = workload === 'api' ? 'shopapp' : 'shopjob';
  if (role.rows[0]?.current_user !== expectedRole) {
    await pool.end();
    throw new Error(`DATABASE_ROLE_INVALID:${expectedRole}`);
  }
  const security = 'SESSION_KEY_REF' in environment && environment.SESSION_KEY_REF && environment.IDENTITY_KEY_REF && environment.QUOTE_KEY_REF
    ? { session: await secrets.read(environment.SESSION_KEY_REF), identity: await secrets.read(environment.IDENTITY_KEY_REF),
      quote: await secrets.read(environment.QUOTE_KEY_REF) }
    : null;
  const returnTargets = workload === 'api' ? apiReturnTargets(environment as ApiEnvironment) : null;
  const kms = environment.KMS_ENDPOINT ? new KmsClient(environment.KMS_ENDPOINT) : null;
  const [applicationSource, paymentSource] = await Promise.all([
    secrets.read(required(environment.WECHAT_APPLICATION_CONFIG_REF, 'WECHAT_APPLICATION_CONFIG_REF_MISSING')),
    secrets.read(required(environment.WECHAT_PAYMENT_CONFIG_REF, 'WECHAT_PAYMENT_CONFIG_REF_MISSING')),
  ]);
  const applications = WechatApplicationCatalog.parse(parseSecret(applicationSource, 'WECHAT_APPLICATION_CONFIG_INVALID'));
  const payment = new WechatGateway(applications,
    parseSecret(paymentSource, 'WECHAT_PAYMENT_CONFIG_INVALID') as unknown as WechatPayConfigSource);
  const invoices = 'INVOICE_CONFIG_REF' in environment && environment.INVOICE_CONFIG_REF
    ? new InvoiceGateway(JSON.parse(await secrets.read(environment.INVOICE_CONFIG_REF)) as InvoiceConfiguration) : null;
  const payouts = 'PAYOUT_CONFIG_REF' in environment && environment.PAYOUT_CONFIG_REF
    ? new PayoutGateway(JSON.parse(await secrets.read(environment.PAYOUT_CONFIG_REF)) as PayoutConfiguration) : null;
  const wechatIdentity = 'WECHAT_IDENTITY_CONFIG_REF' in environment && environment.WECHAT_IDENTITY_CONFIG_REF
    ? new WechatIdentityGateway(applications,
      parseSecret(await secrets.read(environment.WECHAT_IDENTITY_CONFIG_REF), 'WECHAT_IDENTITY_CONFIG_INVALID') as unknown as WechatIdentityConfiguration) : null;
  const deliveryConfiguration = 'NOTIFICATION_CONFIG_REF' in environment && environment.NOTIFICATION_CONFIG_REF
    ? parseDeliveryConfiguration(await secrets.read(environment.NOTIFICATION_CONFIG_REF)) : null;
  const deliveries = deliveryConfiguration ? new DeliveryRegistry([new InappChannel(), new AliyunSmsChannel(deliveryConfiguration.sms),
    new EmailChannel(deliveryConfiguration.email), new WechatChannel(deliveryConfiguration.wechat)]) : null;
  const objects = environment.OBJECT_STORE_ENDPOINT && environment.OBJECT_STORE_TOKEN_REF
    ? new HttpObjectStore(environment.OBJECT_STORE_ENDPOINT, await secrets.read(environment.OBJECT_STORE_TOKEN_REF)) : null;
  const verifier = new SignatureVerifier(manifestKey);
  const extensions = new ExtensionRegistry(verifier);
  const extensionLoader = await loadProviders(pool, secrets, extensions);
  const risk = new RiskCheckAdapter(pool);
  const auditRepository = new PgAuditRepository();
  const audit = new RecordAudit(auditRepository);
  const access = new AccessPipeline(
    new PgSessionResolver(pool),
    new PgMembershipResolver(pool),
    new PgAccessVersionResolver(pool),
    new PgScopeResolver(pool),
    new PgCapabilityResolver(pool),
    new SystemClock(),
    risk,
    new PgDecisionSink(pool),
  );
  const handlers = new Map<OperationId, OperationHandler>();
  return {
    pool,
    cache,
    extensions,
    telemetry,
    configure(container) {
      container.bind(OPERATION_HANDLERS, handlers);
      container.bind(OPERATION_AUTHORIZER, new PipelineAuthorizer(access));
      container.bind(DATABASE_POOL, pool);
      container.bind(QUERY_METRICS, queryMetrics);
      container.bind(TELEMETRY, telemetry);
      container.bind(CACHE, cache);
      container.bind(RISK_GATE, risk);
      container.bind(AUDIT_SINK, audit);
      container.bind(AUDIT_PORT, auditRepository);
      container.bind(MANIFEST_VERIFIER, verifier);
      container.bind(EXTENSION_LOADER, extensionLoader);
      container.bind(SECRET_STORE, secrets);
      if (security !== null) container.bind(SECURITY_KEYS, security);
      if (returnTargets !== null) container.bind(RETURN_TARGETS, returnTargets);
      if (kms !== null) container.bind(KMS_CLIENT, kms);
      container.bind(PAYMENT_GATEWAY, payment);
      if (invoices !== null) container.bind(INVOICE_ISSUER, invoices);
      if (payouts !== null) container.bind(PAYOUT_GATEWAY, payouts);
      if (wechatIdentity !== null) container.bind(WECHAT_IDENTITY, wechatIdentity);
      if (deliveries !== null) container.bind(DELIVERY_REGISTRY, deliveries);
      if (objects !== null) container.bind(OBJECT_STORE, objects);
    },
    async close() {
      await extensions.stop();
      await cache.close();
      await pool.end();
    },
  };
}

function required(value: string | undefined, code: string): string {
  if (!value) throw new Error(code);
  return value;
}

function parseSecret(value: string, code: string): Record<string, unknown> {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error(code); }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(code);
  return parsed as Record<string, unknown>;
}
