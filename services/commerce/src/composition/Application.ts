import { SystemClock } from '@shop/kernel';
import type { Telemetry } from '@shop/telemetry';
import { apiChallengeCodeRef, apiReturnTargets, apiStorefrontOrigin, type ApiEnvironment, type JobsEnvironment } from '@shop/config/server';
import { AccessPipeline } from '../pipeline/AccessPipeline';
import { CSRF_PROTECTOR, CsrfProtector } from '../platform/security/CsrfProtector';
import { PgAuthorizationResolver } from '../platform/security/PgAuthorizationResolver';
import type { PreauthResolver } from '../platform/security/PreauthResolver';
import { OPERATION_POLICY, SecureOperationPolicy } from '../pipeline/OperationPolicy';
import { createPool, type DatabasePool } from '../platform/database/Pool';
import { IDENTITY_SECURITY_KEYS, INVITATION_KEY_VERSIONS, NAVIGATION_SECURITY_KEY, secretText, SECURITY_KEYS, SECRET_STORE, WorkloadSecretStore } from '../platform/secret/SecretStore';
import { DATABASE_POOL } from '../platform/database/Pool';
import { QUERY_METRICS, QueryMetrics } from '../platform/database/QueryMetrics';
import { KMS_CLIENT } from '../pipeline/KmsPort';
import { HttpKmsClient } from '../platform/crypto/KmsClient';
import { COMMERCE_MODULES } from '../generated/ModuleCatalog';
import { EXTENSION_REGISTRY, ExtensionRegistry } from './ExtensionRegistry';
import { MANIFEST_VERIFIER, SignatureVerifier } from './SignatureVerifier';
import { extensionCatalog } from '../modules/extension/infrastructure/loader/ExtensionBootstrap';
import type { Container } from './Container';
import { PgDecisionSink } from '../modules/access/infrastructure/persistence/PgDecisionSink';
import { PgSessionSecurity } from '../modules/identity/infrastructure/persistence/PgSessionSecurity';
import { RiskCheckAdapter } from '../modules/risk/infrastructure/persistence/RiskCheckAdapter';
import { RISK_GATE } from '../platform/security/RiskGate';
import { PAYMENT_GATEWAY } from '../modules/payment/application/port/PaymentGateway';
import { WechatPaymentFactory } from '@shop/wechatpayment';
import { DELIVERY_REGISTRY, DeliveryRegistry } from '../modules/notification/infrastructure/registry/DeliveryRegistry';
import { SmsFactory } from '@shop/notificationsms';
import { InappFactory } from '@shop/notificationinapp';
import { EmailFactory } from '@shop/notificationemail';
import { WechatFactory } from '@shop/notificationwechat';
import { OBJECT_STORE } from '../modules/runtime/public/ObjectPort';
import { HttpObjectStore } from '../platform/object/ObjectStore';
import { INVOICE_ISSUER } from '../modules/finance/application/port/InvoiceIssuer';
import { InvoiceGateway, type InvoiceConfiguration } from '../modules/finance/infrastructure/adapter/InvoiceGateway';
import { PAYOUT_GATEWAY } from '../modules/finance/application/port/PayoutGateway';
import { PayoutGateway, type PayoutConfiguration } from '../modules/finance/infrastructure/adapter/PayoutGateway';
import { CACHE } from '../platform/cache/Cache';
import { RedisCache } from '../platform/cache/RedisCache';
import { EVENT_STREAM } from '../platform/messaging/EventStream';
import { RedisEventStream } from '../platform/messaging/RedisEventStream';
import { RETURN_TARGETS } from '../modules/identity/infrastructure/security/ReturnTargetCatalog';
import { AUDIT_SINK } from '../pipeline/AuditSink';
import { RecordAudit } from '../modules/audit/application/service/RecordAudit';
import { PgAuditRepository } from '../modules/audit/infrastructure/persistence/PgAuditRepository';
import { AUDIT_REPOSITORY } from '../modules/audit/application/port/AuditRepository';
import { EXTENSION_LOADER } from '../modules/extension/application/port/ExtensionLoader';
import { commerceTelemetry, OBSERVATIONS, TELEMETRY } from '../platform/telemetry/Telemetry';
import { DependencyMetrics } from '../platform/telemetry/DependencyMetrics';
import { Singleflight } from '@shop/kernel';
import { NAVIGATION_CLOCK } from '../modules/navigation/application/port/NavigationClock';
import { PgPreauthResolver } from '../modules/identity/infrastructure/security/PgPreauthResolver';
import { FederationProtector } from '../modules/identity/domain/service/FederationProtector';
import { PublicActorFingerprint } from '../platform/security/PublicActorFingerprint';
import { PUBLIC_ACTOR_FINGERPRINT } from '../platform/security/PublicActorFingerprintToken';
import { InvitationHasher } from '../modules/identity/infrastructure/security/InvitationHasher';
import { PgTransactionManager } from '../platform/database/PgTransactionManager';
import { NETWORK_CATALOG } from '@shop/config/networkcatalog';
import { STOREFRONT_CONFIG } from '../modules/experience/application/port/StorefrontConfig';
import { LOG_SINK } from '../modules/observability/application/port/LogSink';
import { METRIC_SINK } from '../modules/observability/application/port/MetricSink';
import { TRACE_SINK } from '../modules/observability/application/port/TraceSink';
import { TelemetryLogSink, TelemetryMetricSink, TelemetryTraceSink } from '../modules/observability/infrastructure/adapter/TelemetrySinks';
import { IDENTITY_CHALLENGE_CODE } from '../modules/identity/application/port/ChallengeCode';
import { FixedChallengeCode, RandomChallengeCode } from '../modules/identity/infrastructure/security/ChallengeCodes';

export interface CommerceApplication {
  readonly pool: DatabasePool;
  readonly cache: RedisCache;
  readonly extensions: ExtensionRegistry;
  readonly telemetry: Telemetry;
  readonly invitationKeyVersions: readonly string[];
  readonly configure: (container: Container) => void;
  close(): Promise<void>;
}

export async function createApplication(environment: ApiEnvironment | JobsEnvironment, workload: 'api' | 'jobs'): Promise<CommerceApplication> {
  const endpoint = required(environment.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING');
  const secrets = new WorkloadSecretStore(endpoint, required(environment.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_MISSING'));
  const secretFlights = new Singleflight();
  const resolveSecret = (reference: string, purpose: Parameters<typeof secretText>[2]) => secretFlights.run(`${purpose}:${reference}`, () => secretText(secrets, reference, purpose));
  const telemetry = commerceTelemetry();
  const dependencies = new DependencyMetrics(telemetry);
  const bootstrapContext = { requestId: `bootstrap:${workload}`, traceId: `bootstrap:${workload}`, module: 'runtime', operation: 'bootstrap' };
  const connectionRef =
    workload === 'api'
      ? required((environment as ApiEnvironment).DATABASE_API_CONNECTION_REF, 'DATABASE_API_CONNECTION_REF_MISSING')
      : required((environment as JobsEnvironment).DATABASE_JOB_CONNECTION_REF, 'DATABASE_JOB_CONNECTION_REF_MISSING');
  const connection = await dependencies.measure('secretstore', bootstrapContext, () => secretText(secrets, connectionRef, 'database'));
  const manifestKey = await dependencies.measure('secretstore', bootstrapContext, () => secretText(secrets, required(environment.EXTENSION_MANIFEST_KEY_REF, 'EXTENSION_MANIFEST_KEY_REF_MISSING'), 'manifest'));
  const queryMetrics = new QueryMetrics();
  const pool = createPool(connection, workload === 'api' ? 'api' : 'jobs', queryMetrics);
  const cache = new RedisCache(() => secretText(secrets, required(environment.REDIS_CONNECTION_REF, 'REDIS_CONNECTION_REF_MISSING'), 'cache'));
  const streams = new RedisEventStream(() => secretText(secrets, required(environment.REDIS_CONNECTION_REF, 'REDIS_CONNECTION_REF_MISSING'), 'cache'));
  await Promise.all([cache.start(), streams.start().catch(() => undefined)]);
  const role = await pool.query<{ current_user: string }>('select current_user');
  const expectedRole = workload === 'api' ? 'shopapp' : 'shopjob';
  if (role.rows[0]?.current_user !== expectedRole) {
    await pool.end();
    throw new Error(`DATABASE_ROLE_INVALID:${expectedRole}`);
  }
  const security =
    'SESSION_KEY_REF' in environment && environment.SESSION_KEY_REF && environment.IDENTITY_KEY_REF && environment.INVITATION_KEY_REF && environment.NAVIGATION_KEY_REF && environment.QUOTE_KEY_REF
      ? {
          session: await secretText(secrets, environment.SESSION_KEY_REF, 'session'),
          identity: await secretText(secrets, environment.IDENTITY_KEY_REF, 'identity'),
          invitation: await secretText(secrets, environment.INVITATION_KEY_REF, 'invitation'),
          navigation: await secretText(secrets, environment.NAVIGATION_KEY_REF, 'navigation'),
          quote: await secretText(secrets, environment.QUOTE_KEY_REF, 'quote'),
        }
      : null;
  const challengeCodeRef = workload === 'api' ? apiChallengeCodeRef(environment as ApiEnvironment) : null;
  const challengeCodes = challengeCodeRef === null ? new RandomChallengeCode() : new FixedChallengeCode(await resolveSecret(challengeCodeRef, 'identity'));
  const returnTargets = workload === 'api' ? apiReturnTargets(environment as ApiEnvironment) : null;
  const storefrontOrigin = workload === 'api' ? apiStorefrontOrigin(environment as ApiEnvironment) : null;
  const kms = environment.KMS_ENDPOINT ? new HttpKmsClient(environment.KMS_ENDPOINT, required(environment.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_MISSING')) : null;
  const [applicationSource, paymentSource] = await Promise.all([
    resolveSecret(required(environment.WECHAT_APPLICATION_CONFIG_REF, 'WECHAT_APPLICATION_CONFIG_REF_MISSING'), 'providerconfig'),
    resolveSecret(required(environment.WECHAT_PAYMENT_CONFIG_REF, 'WECHAT_PAYMENT_CONFIG_REF_MISSING'), 'providerconfig'),
  ]);
  const payment = WechatPaymentFactory.create(parseSecret(applicationSource, 'WECHAT_APPLICATION_CONFIG_INVALID'), parseSecret(paymentSource, 'WECHAT_PAYMENT_CONFIG_INVALID'));
  const invoices = 'INVOICE_CONFIG_REF' in environment && environment.INVOICE_CONFIG_REF ? new InvoiceGateway(JSON.parse(await secretText(secrets, environment.INVOICE_CONFIG_REF, 'finance')) as InvoiceConfiguration) : null;
  const payouts = 'PAYOUT_CONFIG_REF' in environment && environment.PAYOUT_CONFIG_REF ? new PayoutGateway(JSON.parse(await secretText(secrets, environment.PAYOUT_CONFIG_REF, 'finance')) as PayoutConfiguration) : null;
  const deliveryConfiguration = 'NOTIFICATION_CONFIG_REF' in environment && environment.NOTIFICATION_CONFIG_REF ? notificationConfiguration(await secretText(secrets, environment.NOTIFICATION_CONFIG_REF, 'notification')) : null;
  const deliveries = deliveryConfiguration
    ? new DeliveryRegistry([
        InappFactory.create(),
        await SmsFactory.create(deliveryConfiguration.sms, secrets),
        await EmailFactory.create(deliveryConfiguration.email, secrets),
        await WechatFactory.create(deliveryConfiguration.wechat, secrets),
      ])
    : null;
  const objects = environment.OBJECT_STORE_ENDPOINT && environment.OBJECT_STORE_TOKEN_REF ? new HttpObjectStore(environment.OBJECT_STORE_ENDPOINT, await secretText(secrets, environment.OBJECT_STORE_TOKEN_REF, 'objectstore')) : null;
  const verifier = new SignatureVerifier(manifestKey);
  const extensions = new ExtensionRegistry(verifier);
  const extensionLoader = workload === 'api' ? extensionCatalog() : null;
  const queryPool = apiQueryPool(pool, workload);
  const risk = new RiskCheckAdapter(pool, queryPool);
  const transactions = new PgTransactionManager(pool);
  const decisions = workload === 'api' ? new PgDecisionSink(pool, transactions, new PgSessionSecurity()) : null;
  const preauth: PreauthResolver | null =
    workload !== 'api'
      ? null
      : security === null
        ? {
            resolve: async () => {
              throw new Error('PREAUTH_SECURITY_UNAVAILABLE');
            },
          }
        : new PgPreauthResolver(pool, new FederationProtector(security.session));
  const invitationKeyVersions = security === null ? Object.freeze([]) : new InvitationHasher(security.invitation).versions();
  const auditRepository = new PgAuditRepository();
  const audit = new RecordAudit(auditRepository);
  const access =
    queryPool !== null && decisions !== null && preauth !== null
      ? new AccessPipeline(new PgAuthorizationResolver(queryPool, telemetry), new SystemClock(), risk, decisions)
      : null;
  return {
    pool,
    cache,
    extensions,
    telemetry,
    invitationKeyVersions,
    configure(container) {
      if (access !== null && preauth !== null && decisions !== null) container.bind(OPERATION_POLICY, new SecureOperationPolicy(access, preauth, risk, decisions));
      container.bind(DATABASE_POOL, pool);
      container.bind(QUERY_METRICS, queryMetrics);
      container.bind(TELEMETRY, telemetry);
      container.bind(OBSERVATIONS, telemetry.observations);
      container.bind(METRIC_SINK, new TelemetryMetricSink(telemetry));
      container.bind(TRACE_SINK, new TelemetryTraceSink(telemetry));
      container.bind(LOG_SINK, new TelemetryLogSink(telemetry));
      container.bind(CACHE, cache);
      container.bind(EVENT_STREAM, streams);
      container.bind(RISK_GATE, risk);
      container.bind(IDENTITY_CHALLENGE_CODE, challengeCodes);
      container.bind(AUDIT_SINK, audit);
      container.bind(AUDIT_REPOSITORY, auditRepository);
      container.bind(MANIFEST_VERIFIER, verifier);
      if (extensionLoader !== null) container.bind(EXTENSION_LOADER, extensionLoader);
      container.bind(EXTENSION_REGISTRY, extensions);
      container.bind(SECRET_STORE, secrets);
      if (security !== null) {
        container.bind(SECURITY_KEYS, security);
        container.bind(IDENTITY_SECURITY_KEYS, Object.freeze({ identity: security.identity, invitation: security.invitation, session: security.session }));
        container.bind(INVITATION_KEY_VERSIONS, invitationKeyVersions);
        container.bind(NAVIGATION_SECURITY_KEY, Object.freeze({ navigation: security.navigation }));
        container.bind(PUBLIC_ACTOR_FINGERPRINT, new PublicActorFingerprint(security.identity));
        container.bind(NAVIGATION_CLOCK, new SystemClock());
      }
      if (returnTargets !== null) container.bind(RETURN_TARGETS, returnTargets);
      if (storefrontOrigin !== null) container.bind(STOREFRONT_CONFIG, Object.freeze({ origin: storefrontOrigin, entryPath: NETWORK_CATALOG.storefront.entryPath }));
      if (security !== null && returnTargets !== null) container.bind(CSRF_PROTECTOR, new CsrfProtector(security.session, returnTargets));
      if (kms !== null) container.bind(KMS_CLIENT, kms);
      container.bind(PAYMENT_GATEWAY, payment);
      if (invoices !== null) container.bind(INVOICE_ISSUER, invoices);
      if (payouts !== null) container.bind(PAYOUT_GATEWAY, payouts);
      if (deliveries !== null) container.bind(DELIVERY_REGISTRY, deliveries);
      if (objects !== null) container.bind(OBJECT_STORE, objects);
    },
    async close() {
      await extensions.stop();
      await cache.close();
      await streams.close();
      await pool.end();
    },
  };
}

export function apiQueryPool(pool: DatabasePool, workload: 'api' | 'jobs'): DatabasePool | null {
  return workload === 'api' ? pool.workload('query') : null;
}

function required(value: string | undefined, code: string): string {
  if (!value) throw new Error(code);
  return value;
}

function parseSecret(value: string, code: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(code);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(code);
  return parsed as Record<string, unknown>;
}

function notificationConfiguration(value: string): Readonly<{ sms: unknown; email: unknown; wechat: unknown }> {
  const source = parseSecret(value, 'DELIVERY_CONFIGURATION_INVALID');
  if (Object.keys(source).sort().join(',') !== 'email,sms,wechat') throw new Error('DELIVERY_CONFIGURATION_INVALID');
  return Object.freeze({ sms: source.sms, email: source.email, wechat: source.wechat });
}
