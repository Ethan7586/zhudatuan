import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { CONTRACT_VERSION, type OperationId } from '@shop/contract';
import { SystemClock } from '@shop/kernel';
import { createTelemetry } from '@shop/telemetry';
import { Client, type PoolClient, type QueryResultRow } from 'pg';
import { bindServerNodeManifestRegistry, bootstrapApi } from '../../../01_core_hexin/services/commerce/src/bootstrap/ApiBootstrap';
import { Container } from '../../../01_core_hexin/services/commerce/src/bootstrap/Container';
import { defineSelectedModule } from '../../../01_core_hexin/services/commerce/src/bootstrap/DefinedModule';
import { ExtensionRegistry } from '../../../01_core_hexin/services/commerce/src/bootstrap/ExtensionRegistry';
import type { ModuleContext } from '../../../01_core_hexin/services/commerce/src/bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../01_core_hexin/services/commerce/src/foundation/application/AuditSink';
import type { OperationHandler, OperationRequest } from '../../../01_core_hexin/services/commerce/src/foundation/application/OperationHandler';
import { QueueJob } from '../../../01_core_hexin/services/commerce/src/foundation/infrastructure/QueueJob';
import { KMS_CLIENT, type CipherEnvelope, type KmsClient } from '../../../01_core_hexin/services/commerce/src/foundation/infrastructure/KmsClient';
import { IDENTITY_SECURITY_KEYS, SECURITY_KEYS } from '../../../01_core_hexin/services/commerce/src/foundation/infrastructure/SecretStore';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS, type OperationAuthorizer } from '../../../01_core_hexin/services/commerce/src/foundation/interface/OperationController';
import type { HttpApp } from '../../../01_core_hexin/services/commerce/src/foundation/interface/HttpApp';
import { DATABASE_POOL, createPool, type DatabasePool } from '../../../01_core_hexin/services/commerce/src/foundation/persistence/Pool';
import { AccessPipeline } from '../../../01_core_hexin/services/commerce/src/foundation/security/AccessPipeline';
import { PgGovernanceResolver } from '../../../01_core_hexin/services/commerce/src/foundation/security/GovernanceResolver';
import { PgAccessVersionResolver, PgCapabilityResolver, PgMembershipResolver, PgScopeResolver, PgSessionResolver } from '../../../01_core_hexin/services/commerce/src/foundation/security/PgAccessResolvers';
import { DECISION_SINK } from '../../../01_core_hexin/services/commerce/src/foundation/security/DecisionSink';
import { RISK_GATE } from '../../../01_core_hexin/services/commerce/src/foundation/security/RiskGate';
import { PgDecisionSink } from '../../../01_core_hexin/services/commerce/src/modules/access/04_adapters_shixian/persistence/PgDecisionSink';
import { RecordAudit } from '../../../01_core_hexin/services/commerce/src/modules/audit/03_application_yingyong/command/RecordAudit';
import { PgAuditRepository } from '../../../01_core_hexin/services/commerce/src/modules/audit/04_adapters_shixian/persistence/PgAuditRepository';
import { PasswordPolicy } from '../../../01_core_hexin/services/commerce/src/modules/identity/02_domain_yewu/policies_guize/PasswordPolicy';
import { identityRegistrationOperations } from '../../../01_core_hexin/services/commerce/src/modules/identity/05_interface_jieru/http/IdentityOperations';
import { orderOperations } from '../../../01_core_hexin/services/commerce/src/modules/order_dingdan/03_application_yingyong/services_fuwu/OrderOperations';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../../../01_core_hexin/services/commerce/src/modules/payment_zhifu';
import { PaymentJobProcessor } from '../../../01_core_hexin/services/commerce/src/modules/payment_zhifu/05_interface_jieru/jobs_renwu/PaymentJobs';
import { PURCHASE_MODULES } from '../../../01_core_hexin/services/commerce/src/modules/purchase/PurchaseModules';
import { PurchaseSessionResolver } from '../../../01_core_hexin/services/commerce/src/modules/purchase/PurchaseSessionResolver';
import { PURCHASE_OPERATION_IDS, PURCHASE_QUOTE_KEY } from '../../../01_core_hexin/services/commerce/src/modules/purchase/PurchaseOperations';
import { RiskCheckAdapter } from '../../../01_core_hexin/services/commerce/src/modules/risk';
import { createIdentityNotificationJob } from '../../../01_core_hexin/services/commerce/src/bootstrap/IdentityNotificationJobsRuntime';
import type { IdentityChallengeDispatcher } from '../../../01_core_hexin/services/commerce/src/modules/notification/interface/job/NotificationJob';
import { WebCartModule, WebCatalogModule, WebOrderModule } from '../../../01_core_hexin/services/commerce/src/modules/webbusiness/WebBusinessModules';
import { WebBusinessScopeResolver } from '../../../01_core_hexin/services/commerce/src/modules/webbusiness/WebBusinessScopeResolver';
import { WebRiskCheckAdapter } from '../../../01_core_hexin/services/commerce/src/modules/webbusiness/WebRiskCheckAdapter';

const ADMIN_URL = requiredEnvironment('SHOP_TEST_ADMIN_DATABASE_URL');
const IDENTITY_URL = requiredEnvironment('SHOP_TEST_IDENTITY_DATABASE_URL');
const IDENTITY_JOB_URL = requiredEnvironment('SHOP_TEST_IDENTITY_JOB_DATABASE_URL');
const WEB_URL = requiredEnvironment('SHOP_TEST_WEB_DATABASE_URL');
const PURCHASE_URL = requiredEnvironment('SHOP_TEST_PURCHASE_DATABASE_URL');
const APP_URL = requiredEnvironment('SHOP_TEST_APP_DATABASE_URL');
const JOB_URL = requiredEnvironment('SHOP_TEST_JOB_DATABASE_URL');
const ROOT_RUN_ID = `l1-hongtai-${Date.now()}-${randomUUID().slice(0, 8)}`;
const SHORT_RUN = ROOT_RUN_ID.slice(-12).replaceAll('-', '');
const MALL = 'mall-zhudatuan';
const TENANT = 'tenant-zhudatuan';
const ENTERPRISE = 'enterprise-zhudatuan';
const SLUG = `l1-hongtai-${SHORT_RUN}`;
const ORIGIN = `https://${SLUG}.invalid`;
const IDENTITY_ENTRY_ORIGIN = 'https://api.zhudatuan.com';
const IDENTITY_KEY = createHash('sha256').update(`${ROOT_RUN_ID}:identity-key`).digest('base64url');
const SESSION_KEY = createHash('sha256').update(`${ROOT_RUN_ID}:session-key`).digest('base64url');
const QUOTE_KEY = createHash('sha256').update(`${ROOT_RUN_ID}:quote-key`).digest('base64url');
const EVIDENCE_PATH = resolve(process.cwd(), '03_quality_ceshi/tests/performance/evidence/l1-hongtai-concurrency-latest.json');
const COHORTS = [1, 10, 100] as const;
const FAILURE_TELEMETRY: Readonly<Record<string, unknown>>[] = [];
const CAPABILITY_OBSERVATIONS: Readonly<Record<string, unknown>>[] = [];
const AUTHORIZATION_FAILURES: Readonly<Record<string, unknown>>[] = [];
const TEST_TELEMETRY = createTelemetry((record) => {
  if (record.result === 'failure' && record.type === 'count') FAILURE_TELEMETRY.push(record);
});

interface SharedFixture {
  readonly otherMall: string;
  readonly category: string;
  readonly product: string;
  readonly sku: string;
  readonly pool: string;
  readonly otherPool: string;
  readonly listing: string;
  readonly otherListing: string;
  readonly pricebook: string;
  readonly price: string;
  readonly stock: string;
  readonly application: string;
  readonly version: string;
  readonly release: string;
  readonly publication: string;
  readonly reviewerPrincipal: string;
  readonly reviewerMember: string;
  readonly reviewerMembership: string;
  readonly termsHash: string;
}

interface UserState {
  readonly ordinal: number;
  readonly phone: string;
  readonly password: string;
  readonly address: string;
  readonly auth: { readonly state: string; readonly nonce: string; readonly verifier: string; readonly challenge: string };
  flowStarted: number;
  flowCompleted: number;
  registrationChallenge?: string;
  loginChallenge?: string;
  principal?: string;
  member?: string;
  membership?: string;
  session?: string;
  cookie?: string;
  csrf?: string;
  quote?: string;
  order?: string;
  orderResponse?: string;
  intent?: string;
  aftersale?: string;
  aftersaleResponse?: string;
}

interface StageCall {
  readonly durationMs: number;
  readonly status: number | 'thrown';
  readonly code?: string;
}

interface QueueEvidence {
  readonly kind: string;
  readonly jobs: number;
  readonly drainMs: number;
  readonly peakOutstanding: number;
  readonly finalStates: Readonly<Record<string, number>>;
  readonly queueWaitMs?: Statistics;
  readonly providerMs?: Statistics;
}

interface Statistics {
  readonly count: number;
  readonly min: number;
  readonly mean: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly max: number;
}

interface TierResources {
  peakDatabaseConnections: number;
  peakRssBytes: number;
  maxEventLoopDelayMs: number;
  cpuUserMs: number;
  cpuSystemMs: number;
  cpuPercentOfOneCore: number;
}

interface TierOutput {
  readonly users: number;
  readonly runId: string;
  readonly startSpanMs: number;
  readonly endToEndMs: Statistics;
  readonly passwordHashMs: Statistics;
  readonly stages: readonly unknown[];
  readonly queues: readonly QueueEvidence[];
  readonly resources: TierResources;
  readonly isolation: Readonly<Record<string, unknown>>;
  readonly usersEvidence: readonly Readonly<Record<string, unknown>>[];
  readonly passed: boolean;
}

class CohortEvidence {
  readonly calls = new Map<string, StageCall[]>();
  readonly walls = new Map<string, number>();
  readonly queues: QueueEvidence[] = [];
  readonly passwordHashSamples: number[] = [];
  readonly users: UserState[];
  resources: TierResources = { peakDatabaseConnections: 0, peakRssBytes: 0, maxEventLoopDelayMs: 0,
    cpuUserMs: 0, cpuSystemMs: 0, cpuPercentOfOneCore: 0 };

  constructor(readonly count: number, readonly runId: string, firstOrdinal: number) {
    this.users = Array.from({ length: count }, (_, index) => createUser(firstOrdinal + index));
  }

  record(stage: string, call: StageCall): void {
    const calls = this.calls.get(stage) ?? [];
    calls.push(call);
    this.calls.set(stage, calls);
  }

  async concurrent(stage: string, action: (user: UserState) => Promise<void>): Promise<void> {
    const started = performance.now();
    const failures: Error[] = [];
    await Promise.all(this.users.map(async (user) => {
      try { await action(user); } catch (cause) { failures.push(asError(cause)); }
    }));
    this.walls.set(stage, performance.now() - started);
    if (failures.length > 0) throw new Error(`${stage}: ${failures.length}/${this.count} failed: ${failures[0]!.message}`);
  }

  output(isolation: Readonly<Record<string, unknown>>): TierOutput {
    const stages = [...this.calls.entries()].map(([name, calls]) => {
      const statuses: Record<string, number> = {};
      for (const call of calls) statuses[String(call.status)] = (statuses[String(call.status)] ?? 0) + 1;
      const wallMs = round(this.walls.get(name) ?? calls.reduce((sum, call) => sum + call.durationMs, 0));
      return {
        name,
        requests: calls.length,
        wallMs,
        throughputRps: wallMs === 0 ? 0 : round(calls.length * 1_000 / wallMs),
        statusCounts: statuses,
        latencyMs: statistics(calls.map(({ durationMs }) => durationMs)),
        errors: calls.filter(({ status }) => status === 'thrown' || status >= 400).map(({ code }) => code ?? 'UNKNOWN').slice(0, 10),
      };
    });
    const starts = this.users.map(({ flowStarted }) => flowStarted);
    return {
      users: this.count,
      runId: this.runId,
      startSpanMs: round(Math.max(...starts) - Math.min(...starts)),
      endToEndMs: statistics(this.users.filter(({ flowStarted, flowCompleted }) => flowCompleted > flowStarted)
        .map(({ flowStarted, flowCompleted }) => flowCompleted - flowStarted)),
      passwordHashMs: statistics(this.passwordHashSamples),
      stages,
      queues: this.queues,
      resources: this.resources,
      isolation,
      usersEvidence: this.users.map((user) => ({ ordinal: user.ordinal, principal: user.principal, member: user.member,
        membership: user.membership, session: user.session, order: user.order, intent: user.intent, aftersale: user.aftersale,
        finalState: 'refunded/resolved' })),
      passed: stages.every((stage) => Object.keys(stage.statusCounts).every((status) => status !== 'thrown' && Number(status) < 400)),
    };
  }
}

class TestEnvelopeKms {
  private readonly values = new Map<string, Readonly<{ keyRef: string; plaintext: string }>>();

  async encrypt(keyRef: string, plaintext: string, context: Readonly<Record<string, string>>): Promise<CipherEnvelope> {
    const nonce = randomUUID();
    const ciphertext = Buffer.from(`${nonce}:${keyRef}`).toString('base64url');
    this.values.set(ciphertext, { keyRef, plaintext });
    return Object.freeze({
      ciphertext,
      fingerprint: createHash('sha256').update(`${keyRef}:${plaintext}`).digest('hex'),
      keyVersion: `test-${createHash('sha256').update(JSON.stringify(context)).digest('hex').slice(0, 12)}`,
    });
  }

  async decrypt(keyRef: string, ciphertext: string): Promise<string> {
    const stored = this.values.get(ciphertext);
    if (!stored || stored.keyRef !== keyRef) throw new Error('TEST_ENVELOPE_NOT_FOUND');
    return stored.plaintext;
  }

  async seal(keyRef: string, plaintext: string): Promise<string> {
    return (await this.encrypt(keyRef, plaintext, { fixture: ROOT_RUN_ID })).ciphertext;
  }
}

const IdentityModule = defineSelectedModule('identity', [
  'identity.challenges.create',
  'identity.members.create',
  'identity.sessions.create',
  'identity.tickets.exchange',
] as const, identityRegistrationOperations);
const AftersaleModule = defineSelectedModule('order', ['order.aftersales.apply'] as const, orderOperations);
const kms = new TestEnvelopeKms();
let activePasswordHashSamples: number[] | null = null;
const originalPasswordHash = PasswordPolicy.prototype.hash;

PasswordPolicy.prototype.hash = async function instrumentedPasswordHash(password: string): Promise<string> {
  const started = performance.now();
  try { return await originalPasswordHash.call(this, password); }
  finally { activePasswordHashSamples?.push(performance.now() - started); }
};

const evidence: {
  metadata: Readonly<Record<string, unknown>>;
  tiers: TierOutput[];
  database?: Readonly<Record<string, unknown>>;
  verdict: Readonly<Record<string, unknown>>;
} = {
  metadata: {
    rootRunId: ROOT_RUN_ID,
    generatedAt: new Date().toISOString(),
    gitSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    runtime: process.version,
    transport: 'in-process HttpApp Request/Response with real route, contract, CSRF and authorization pipeline',
    database: 'fresh isolated PostgreSQL 17 container',
    providerStubs: ['SMS debug delivery', 'WeChat JSAPI payment/query/refund'],
    infrastructureFixture: 'in-memory envelope key adapter for test-only challenge/mobile/openid ciphertext',
    cohorts: COHORTS,
  },
  tiers: [],
  verdict: { passed: false, reason: 'RUNNING' },
};

async function main(): Promise<void> {
  const admin = new Client({ connectionString: ADMIN_URL, connectionTimeoutMillis: 5_000, statement_timeout: 60_000 });
  const monitorClient = new Client({ connectionString: ADMIN_URL, connectionTimeoutMillis: 5_000, statement_timeout: 5_000 });
  const resourceMonitor = new ResourceMonitor(monitorClient);
  try {
    await Promise.all([admin.connect(), monitorClient.connect()]);
    const fixture = await seedSharedFixture(admin);
    resourceMonitor.start();
    let firstOrdinal = 1;
    for (const count of COHORTS) {
      const cohort = new CohortEvidence(count, `${ROOT_RUN_ID}-${count}`, firstOrdinal);
      firstOrdinal += count;
      activePasswordHashSamples = cohort.passwordHashSamples;
      resourceMonitor.beginTier();
      try {
        await runCohort(admin, fixture, cohort);
        cohort.resources = await resourceMonitor.endTier();
        const isolation = await verifyCohortIsolation(admin, fixture, cohort.users);
        const output = cohort.output(isolation);
        assert(output.startSpanMs <= 1_000, `COHORT_START_WINDOW_EXCEEDED:${output.startSpanMs}`);
        assert(output.passwordHashMs.count === count, `PASSWORD_HASH_SAMPLE_COUNT:${output.passwordHashMs.count}`);
        assert(Object.values(isolation).every((value) => value !== false), 'COHORT_ISOLATION_FAILED');
        evidence.tiers.push(output);
        console.log(`L1 cohort ${count}: PASS; start=${output.startSpanMs}ms; e2e-p95=${output.endToEndMs.p95}ms; db-peak=${output.resources.peakDatabaseConnections}`);
      } catch (cause) {
        cohort.resources = await resourceMonitor.endTier();
        evidence.tiers.push(cohort.output({ verified: false, failure: asError(cause).message }));
        throw cause;
      }
    }
    activePasswordHashSamples = null;
    evidence.database = await finalDatabaseEvidence(admin);
    evidence.verdict = { passed: true, reason: 'ALL_1_10_100_COHORTS_PASSED' };
  } catch (cause) {
    activePasswordHashSamples = null;
    evidence.database = await finalDatabaseEvidence(admin).catch((databaseCause: unknown) => ({
      collectionFailed: asError(databaseCause).message,
    }));
    evidence.verdict = { passed: false, reason: asError(cause).message, stack: asError(cause).stack?.split('\n').slice(0, 8) };
    throw cause;
  } finally {
    PasswordPolicy.prototype.hash = originalPasswordHash;
    resourceMonitor.stop();
    await mkdir(resolve(EVIDENCE_PATH, '..'), { recursive: true });
    await writeFile(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    await Promise.all([admin.end().catch(() => undefined), monitorClient.end().catch(() => undefined)]);
  }
}

async function runCohort(adminClient: Client, fixture: SharedFixture, cohort: CohortEvidence): Promise<void> {
  const identityPool = createPool(IDENTITY_URL, 'api');
  const identityJobPool = createPool(IDENTITY_JOB_URL, 'jobs');
  const identity = await createIdentityApp(identityPool);
  const sms = new SmsDebugDispatcher(identityJobPool, kms);
  try {
    await cohort.concurrent('registration.challenge', async (user) => {
      user.flowStarted = performance.now();
      const response = await httpCall(cohort, 'registration.challenge', identity.app, {
        method: 'POST', path: '/api/v1/identity/challenges', expected: 202,
        idempotency: `${cohort.runId}:registration-challenge:${user.ordinal}`,
        body: { destination: user.phone, purpose: 'registration', application: SLUG }, user,
      });
      user.registrationChallenge = textField(response.body, 'id');
    });
    const registrationJobs = cohort.users.map((user) => `job:notify:${requiredUser(user.registrationChallenge, 'registrationChallenge')}`);
    cohort.queues.push(await drainIdentityQueue(adminClient, identityJobPool, sms, registrationJobs, 'registration-sms', cohort.runId));
    await cohort.concurrent('registration.create', async (user) => {
      const challenge = requiredUser(user.registrationChallenge, 'registrationChallenge');
      const response = await httpCall(cohort, 'registration.create', identity.app, {
        method: 'POST', path: '/api/v1/identity/members', expected: 201,
        idempotency: `${cohort.runId}:registration:${user.ordinal}`,
        body: { subject: user.phone, password: user.password, displayName: `并发会员${user.ordinal}`,
          challenge, code: sms.code(challenge), application: SLUG, termsAccepted: true, termsHash: fixture.termsHash }, user,
      });
      user.membership = textField(response.body, 'id');
      user.member = textField(response.body, 'member_id');
    });
    await hydrateRegisteredPrincipals(adminClient, cohort.users);
    await cohort.concurrent('login.challenge', async (user) => {
      const response = await httpCall(cohort, 'login.challenge', identity.app, {
        method: 'POST', path: '/api/v1/identity/challenges', expected: 202,
        idempotency: `${cohort.runId}:login-challenge:${user.ordinal}`,
        body: { destination: user.phone, purpose: 'login' }, user,
      });
      user.loginChallenge = textField(response.body, 'id');
    });
    const loginJobs = cohort.users.map((user) => `job:notify:${requiredUser(user.loginChallenge, 'loginChallenge')}`);
    cohort.queues.push(await drainIdentityQueue(adminClient, identityJobPool, sms, loginJobs, 'login-sms', cohort.runId));
    await cohort.concurrent('login.session', async (user) => {
      const verifier = user.auth.verifier;
      const challenge = requiredUser(user.loginChallenge, 'loginChallenge');
      const response = await httpCall(cohort, 'login.session', identity.app, {
        method: 'POST', path: '/api/v1/identity/sessions', expected: 201,
        idempotency: `${cohort.runId}:login:${user.ordinal}`,
        body: { provider: 'phone_otp', subject: user.phone, challenge, code: sms.code(challenge),
          membership: requiredUser(user.membership, 'membership'), target: 'storefront', application: SLUG,
          authorization: { state: user.auth.state, nonce: user.auth.nonce,
            challenge: createHash('sha256').update(verifier).digest('base64url') } }, user,
      });
      user.session = textField(response.body, 'session');
      const cookies = response.setCookies;
      const session = cookieFromSetCookies(cookies, 'shop_session');
      const csrf = cookieFromSetCookies(cookies, 'shop_csrf');
      user.cookie = `shop_session=${encodeURIComponent(session)}; shop_csrf=${encodeURIComponent(csrf)}`;
      user.csrf = csrf;
      const callback = recordField(response.body, 'callback');
      Object.assign(user.auth, { ticket: textField(callback, 'ticket') });
    });
    await cohort.concurrent('login.ticket-exchange', async (user) => {
      const callback = textField(user.auth, 'ticket');
      const response = await httpCall(cohort, 'login.ticket-exchange', identity.app, {
        method: 'POST', path: '/api/v1/identity/tickets/exchange', expected: 200,
        idempotency: `${cohort.runId}:exchange:${user.ordinal}`,
        body: { ticket: callback, state: user.auth.state, nonce: user.auth.nonce, verifier: user.auth.verifier }, user,
        authenticated: true,
      });
      assert(textField(recordField(response.body, 'returnTarget'), 'url') === ORIGIN, 'RETURN_TARGET_MISMATCH');
    });
  } finally {
    await identity.close();
    await Promise.all([identityPool.end(), identityJobPool.end()]);
  }

  await seedUserCheckoutFixtures(adminClient, cohort.users);
  await runShoppingAndPurchase(adminClient, fixture, cohort);
}

async function runShoppingAndPurchase(adminClient: Client, fixture: SharedFixture, cohort: CohortEvidence): Promise<void> {
  const webPool = withSqlDiagnostics(createPool(WEB_URL, 'api'));
  const web = await createWebApp(webPool);
  try {
    await cohort.concurrent('catalog.read', async (user) => {
      const response = await httpCall(cohort, 'catalog.read', web.app, {
        method: 'GET', path: '/api/v1/catalog/listings', expected: 200, user, authenticated: true,
      });
      const serialized = JSON.stringify(response.body);
      assert(serialized.includes(fixture.listing), `CATALOG_LISTING_MISSING:${user.ordinal}`);
      assert(!serialized.includes(fixture.otherListing), `CATALOG_SCOPE_LEAK:${user.ordinal}`);
    });
    await cohort.concurrent('cart.add', async (user) => {
      const response = await httpCall(cohort, 'cart.add', web.app, {
        method: 'PUT', path: `/api/v1/carts/current/items/${encodeURIComponent(fixture.listing)}`, expected: 200,
        idempotency: `${cohort.runId}:cart-add:${user.ordinal}`, body: { quantity: 1 }, user, authenticated: true,
      });
      assert(textField(response.body, 'member_id') === user.member, `CART_MEMBER_LEAK:${user.ordinal}`);
    });
    await cohort.concurrent('cart.update', async (user) => {
      const response = await httpCall(cohort, 'cart.update', web.app, {
        method: 'PUT', path: `/api/v1/carts/current/items/${encodeURIComponent(fixture.listing)}`, expected: 200,
        idempotency: `${cohort.runId}:cart-update:${user.ordinal}`, body: { quantity: 2 }, user, authenticated: true,
      });
      assert(textField(response.body, 'member_id') === user.member, `CART_UPDATE_MEMBER_LEAK:${user.ordinal}`);
    });
    await cohort.concurrent('cart.read', async (user) => {
      const response = await httpCall(cohort, 'cart.read', web.app, {
        method: 'GET', path: '/api/v1/carts/current', expected: 200, user, authenticated: true,
      });
      assert(textField(response.body, 'mall_id') === MALL, `CART_READ_MALL_LEAK:${user.ordinal}`);
      const items = arrayField(response.body, 'items');
      assert(items.length === 1, `CART_ITEM_COUNT_INVALID:${user.ordinal}:${items.length}`);
      const item = asRecord(items[0], 'CART_ITEM_INVALID');
      assert(textField(item, 'listing') === fixture.listing && numberField(item, 'quantity') === 2,
        `CART_QUANTITY_INVALID:${user.ordinal}`);
    });
  } finally {
    await web.close();
    await webPool.end();
  }

  const gateway = createWechatGateway(cohort.runId);
  const purchasePool = withSqlDiagnostics(createPool(PURCHASE_URL, 'api'));
  const purchase = await createPurchaseApp(purchasePool, gateway);
  try {
    await cohort.concurrent('checkout.quote', async (user) => {
      const response = await httpCall(cohort, 'checkout.quote', purchase.app, {
        method: 'POST', path: '/api/v1/checkouts/quotes', expected: 201,
        idempotency: `${cohort.runId}:quote:${user.ordinal}`,
        body: { address: user.address, delivery: { mode: 'express' }, vouchers: [], benefits: [] }, user, authenticated: true,
      });
      const quote = recordField(response.body, 'quote');
      user.quote = textField(quote, 'id');
      assert(numberField(quote, 'payableMinor') === 5_180, `QUOTE_AMOUNT_INVALID:${user.ordinal}`);
    });
    await cohort.concurrent('order.create', async (user) => {
      const request = {
        method: 'POST' as const, path: '/api/v1/orders', expected: 201,
        idempotency: `${cohort.runId}:order:${user.ordinal}`,
        body: { quote: requiredUser(user.quote, 'quote') }, user, authenticated: true,
      };
      const first = await httpCall(cohort, 'order.create', purchase.app, request);
      user.order = textField(first.body, 'id');
      user.orderResponse = canonicalJson(first.body);
    });
    await cohort.concurrent('order.replay', async (user) => {
      const replay = await httpCall(cohort, 'order.replay', purchase.app, {
        method: 'POST', path: '/api/v1/orders', expected: 201,
        idempotency: `${cohort.runId}:order:${user.ordinal}`,
        body: { quote: requiredUser(user.quote, 'quote') }, user, authenticated: true,
      });
      assert(requiredUser(user.orderResponse, 'orderResponse') === canonicalJson(replay.body),
        `ORDER_REPLAY_MISMATCH:${user.ordinal}`);
    });
    await cohort.concurrent('payment.intent', async (user) => {
      const response = await httpCall(cohort, 'payment.intent', purchase.app, {
        method: 'POST', path: '/api/v1/payments/intents', expected: 201,
        idempotency: `${cohort.runId}:payment:${user.ordinal}`,
        body: { order: requiredUser(user.order, 'order'), scene: 'jsapi' }, user, authenticated: true,
      });
      user.intent = textField(response.body, 'intent');
      assert(textField(recordField(response.body, 'parameters'), 'package').startsWith('prepay_id='),
        `WECHAT_PREPAY_PARAMETERS_INVALID:${user.ordinal}`);
    });
  } finally {
    await purchase.close();
    await purchasePool.end();
  }

  const paymentJobIds = await jobIdsForPayload(adminClient, 'paymentquery', 'intent', cohort.users.map((user) => requiredUser(user.intent, 'intent')));
  const paymentJobPool = createPool(JOB_URL, 'jobs');
  try {
    const paymentQueue = new QueueJob('paymentquery', paymentJobPool, paymentQueueConfiguration(cohort.runId, 'query'),
      new PaymentJobProcessor(paymentJobPool, gateway, 'paymentquery'));
    cohort.queues.push(await drainQueue(adminClient, paymentQueue, paymentJobIds, 'paymentquery'));
  } finally {
    await paymentJobPool.end();
  }

  const finalWebPool = createPool(WEB_URL, 'api');
  const finalWeb = await createWebApp(finalWebPool);
  const aftersalePool = createPool(APP_URL, 'api');
  const aftersale = await createAftersaleApp(aftersalePool);
  try {
    await cohort.concurrent('order.paid-read', async (user) => {
      const item = await readOwnOrder(cohort, 'order.paid-read', finalWeb.app, user);
      assert(textField(item, 'payment_state') === 'paid', `ORDER_NOT_PAID:${user.ordinal}`);
    });
    await cohort.concurrent('aftersale.apply', async (user) => {
      const order = requiredUser(user.order, 'order');
      const request = {
        method: 'POST' as const, path: `/api/v1/orders/${encodeURIComponent(order)}/aftersales`, expected: 201,
        idempotency: `${cohort.runId}:aftersale:${user.ordinal}`,
        body: { kind: 'refund', amountMinor: 5_180, reason: 'L1 并发全链路模拟退款' }, user, authenticated: true,
      };
      const first = await httpCall(cohort, 'aftersale.apply', aftersale.app, request);
      user.aftersale = textField(first.body, 'id');
      user.aftersaleResponse = canonicalJson(first.body);
    });
    await cohort.concurrent('aftersale.replay', async (user) => {
      const order = requiredUser(user.order, 'order');
      const replay = await httpCall(cohort, 'aftersale.replay', aftersale.app, {
        method: 'POST', path: `/api/v1/orders/${encodeURIComponent(order)}/aftersales`, expected: 201,
        idempotency: `${cohort.runId}:aftersale:${user.ordinal}`,
        body: { kind: 'refund', amountMinor: 5_180, reason: 'L1 并发全链路模拟退款' }, user, authenticated: true,
      });
      assert(requiredUser(user.aftersaleResponse, 'aftersaleResponse') === canonicalJson(replay.body),
        `AFTERSALE_REPLAY_MISMATCH:${user.ordinal}`);
    });
    const reviewer = createReviewerOperations(aftersalePool, fixture);
    await cohort.concurrent('aftersale.approve', async (user) => {
      const started = performance.now();
      try {
        const result = await reviewer.invoke(reviewerRequest(fixture, cohort, user));
        cohort.record('aftersale.approve', { durationMs: performance.now() - started, status: result.status });
        assert(result.status === 200, `AFTERSALE_APPROVAL_STATUS:${result.status}`);
      } catch (cause) {
        cohort.record('aftersale.approve', { durationMs: performance.now() - started, status: 'thrown', code: asError(cause).message });
        throw cause;
      }
    });

    const refundJobIds = cohort.users.map((user) => `job:refund:${requiredUser(user.aftersale, 'aftersale')}`);
    const refundJobPool = withSqlDiagnostics(createPool(JOB_URL, 'jobs'));
    try {
      const refundQueue = new QueueJob('paymentrefund', refundJobPool, paymentQueueConfiguration(cohort.runId, 'refund'),
        new PaymentJobProcessor(refundJobPool, gateway, 'paymentrefund'));
      cohort.queues.push(await drainQueue(adminClient, refundQueue, refundJobIds, 'paymentrefund'));
    } finally {
      await refundJobPool.end();
    }

    await cohort.concurrent('order.final-read', async (user) => {
      const item = await readOwnOrder(cohort, 'order.final-read', finalWeb.app, user);
      assert(textField(item, 'payment_state') === 'refunded', `ORDER_NOT_REFUNDED:${user.ordinal}`);
      assert(textField(item, 'aftersale_state') === 'resolved', `AFTERSALE_NOT_RESOLVED:${user.ordinal}`);
      user.flowCompleted = performance.now();
    });
  } finally {
    await Promise.all([finalWeb.close(), aftersale.close()]);
    await Promise.all([finalWebPool.end(), aftersalePool.end()]);
  }
}

async function readOwnOrder(cohort: CohortEvidence, stage: string, app: HttpApp, user: UserState): Promise<Readonly<Record<string, unknown>>> {
  const order = requiredUser(user.order, 'order');
  const response = await httpCall(cohort, stage, app, {
    method: 'GET', path: `/api/v1/orders?order=${encodeURIComponent(order)}`, expected: 200, user, authenticated: true,
  });
  const items = arrayField(response.body, 'items');
  assert(items.length === 1, `ORDER_SCOPE_COUNT:${user.ordinal}:${items.length}`);
  const item = asRecord(items[0], 'ORDER_ITEM_INVALID');
  assert(textField(item, 'id') === order, `ORDER_SCOPE_LEAK:${user.ordinal}`);
  assert(textField(item, 'member_id') === user.member, `ORDER_MEMBER_LEAK:${user.ordinal}`);
  return item;
}

async function createIdentityApp(pool: DatabasePool): Promise<AppHandle> {
  const extensions = new ExtensionRegistry({ verify: async () => false });
  const audit = new RecordAudit(new PgAuditRepository());
  const stack = accessStack(pool, 'identity');
  const bootstrapped = await bootstrapApi({
    modules: [IdentityModule],
    operationIds: ['identity.challenges.create', 'identity.members.create', 'identity.sessions.create', 'identity.tickets.exchange'],
    extensions,
    allowedOrigins: [ORIGIN],
    telemetry: TEST_TELEMETRY,
    configure(container) {
      bindApplicationBase(container, pool, audit, stack.authorizer);
      container.bind(IDENTITY_SECURITY_KEYS, { identity: IDENTITY_KEY, session: SESSION_KEY });
      container.bind(KMS_CLIENT, kms as unknown as KmsClient);
    },
  });
  return { app: bootstrapped.app, close: () => extensions.stop() };
}

async function createWebApp(pool: DatabasePool): Promise<AppHandle> {
  const extensions = new ExtensionRegistry({ verify: async () => false });
  const audit = new RecordAudit(new PgAuditRepository());
  const stack = accessStack(pool, 'web');
  const operationIds = ['catalog.listings.read', 'cart.current.read', 'cart.items.put', 'order.orders.read'] as const;
  const bootstrapped = await bootstrapApi({
    modules: [WebCatalogModule, WebCartModule, WebOrderModule], operationIds, extensions,
    allowedOrigins: [ORIGIN], telemetry: TEST_TELEMETRY,
    configure(container) { bindApplicationBase(container, pool, audit, stack.authorizer); },
  });
  return { app: bootstrapped.app, close: () => extensions.stop() };
}

async function createPurchaseApp(pool: DatabasePool, gateway: PaymentGateway): Promise<AppHandle> {
  const extensions = new ExtensionRegistry({ verify: async () => false });
  const audit = new RecordAudit(new PgAuditRepository());
  const stack = accessStack(pool, 'purchase');
  const bootstrapped = await bootstrapApi({
    modules: PURCHASE_MODULES, operationIds: PURCHASE_OPERATION_IDS, extensions,
    allowedOrigins: [ORIGIN], telemetry: TEST_TELEMETRY,
    configure(container) {
      bindApplicationBase(container, pool, audit, stack.authorizer);
      container.bind(RISK_GATE, stack.risk);
      container.bind(DECISION_SINK, stack.decisions);
      container.bind(PURCHASE_QUOTE_KEY, QUOTE_KEY);
      container.bind(KMS_CLIENT, kms as unknown as KmsClient);
      container.bind(PAYMENT_GATEWAY, gateway);
    },
  });
  return { app: bootstrapped.app, close: () => extensions.stop() };
}

async function createAftersaleApp(pool: DatabasePool): Promise<AppHandle> {
  const extensions = new ExtensionRegistry({ verify: async () => false });
  const audit = new RecordAudit(new PgAuditRepository());
  const stack = accessStack(pool, 'app');
  const bootstrapped = await bootstrapApi({
    modules: [AftersaleModule], operationIds: ['order.aftersales.apply'], extensions,
    allowedOrigins: [ORIGIN], telemetry: TEST_TELEMETRY,
    configure(container) {
      bindApplicationBase(container, pool, audit, stack.authorizer);
      container.bind(SECURITY_KEYS, { identity: IDENTITY_KEY, session: SESSION_KEY, quote: QUOTE_KEY });
    },
  });
  return { app: bootstrapped.app, close: () => extensions.stop() };
}

interface AppHandle { readonly app: HttpApp; close(): Promise<void> }

function bindApplicationBase(container: Container, pool: DatabasePool, audit: RecordAudit, authorizer: OperationAuthorizer): void {
  bindServerNodeManifestRegistry(container);
  container.bind(OPERATION_HANDLERS, new Map<OperationId, OperationHandler>());
  container.bind(OPERATION_AUTHORIZER, authorizer);
  container.bind(DATABASE_POOL, pool);
  container.bind(AUDIT_SINK, audit);
}

function accessStack(pool: DatabasePool, kind: 'identity' | 'web' | 'purchase' | 'app') {
  const decisions = new PgDecisionSink(pool);
  const risk = kind === 'identity' || kind === 'app' ? new RiskCheckAdapter(pool) : new WebRiskCheckAdapter(pool);
  const baseSessions = new PgSessionResolver(pool);
  const sessions = kind === 'purchase' ? new PurchaseSessionResolver(baseSessions) : baseSessions;
  const scopes = kind === 'identity' || kind === 'app' ? new PgScopeResolver(pool) : new WebBusinessScopeResolver(pool);
  const capabilityDelegate = new PgCapabilityResolver(pool);
  const capabilities = { resolve: async (membership: string) => {
    const operations = await capabilityDelegate.resolve(membership);
    let unstable: Readonly<Record<string, unknown>> = {};
    if (operations.length < 10) {
      const repeated = await capabilityDelegate.resolve(membership);
      const resolved = await pool.query<{ grants: unknown }>('select grants from access.resolve_membership($1)', [membership]);
      unstable = { repeatedCount: repeated.length, grants: resolved.rows[0]?.grants ?? null };
    }
    CAPABILITY_OBSERVATIONS.push({ kind, membership, count: operations.length,
      orderCreate: operations.includes('order.orders.create'), quoteCreate: operations.includes('checkout.quotes.create'), ...unstable });
    if (CAPABILITY_OBSERVATIONS.length > 2_000) CAPABILITY_OBSERVATIONS.shift();
    return operations;
  } };
  const pipeline = new AccessPipeline(sessions, new PgMembershipResolver(pool), new PgAccessVersionResolver(pool), scopes,
    capabilities, new SystemClock(), risk, decisions, undefined, undefined, new PgGovernanceResolver(pool));
  const authorizer: OperationAuthorizer = { authorize: async (headers, operation, permission, resource) => {
    try {
      return await pipeline.authorize(headers, operation, permission, resource);
    } catch (cause) {
      const failure = cause as { readonly code?: unknown; readonly details?: unknown; readonly message?: unknown };
      AUTHORIZATION_FAILURES.push({ kind, operation, trace: headers['x-trace-id'],
        code: failure.code ?? null, details: failure.details ?? null, message: failure.message ?? String(cause) });
      if (AUTHORIZATION_FAILURES.length > 2_000) AUTHORIZATION_FAILURES.shift();
      throw cause;
    }
  } };
  return { authorizer, risk, decisions };
}

function createReviewerOperations(pool: DatabasePool, _fixture: SharedFixture) {
  const container = new Container();
  container.bind(DATABASE_POOL, pool);
  container.bind(AUDIT_SINK, new RecordAudit(new PgAuditRepository()));
  container.bind(SECURITY_KEYS, { identity: IDENTITY_KEY, session: SESSION_KEY, quote: QUOTE_KEY });
  return orderOperations({ container } as unknown as ModuleContext);
}

function reviewerRequest(fixture: SharedFixture, cohort: CohortEvidence, user: UserState): OperationRequest {
  const aftersale = requiredUser(user.aftersale, 'aftersale');
  return {
    type: 'order.aftersales.approve',
    access: {
      actor: { id: fixture.reviewerPrincipal, session: `reviewer-session:${ROOT_RUN_ID}`,
        membership: fixture.reviewerMembership, credentialVersion: 1, accessVersion: 1, target: 'console', assurance: { level: 2 } },
      membership: { id: fixture.reviewerMembership, active: true, accessVersion: 1, denies: [], grants: [] },
      scope: { id: MALL, kind: 'mall', tenant: TENANT, path: [] },
      mallContext: { mall_id: MALL }, mall_id: MALL, accessVersion: 1,
      capabilities: ['order.aftersales.approve'], assurance: { level: 2 }, trace: `${cohort.runId}:review:${user.ordinal}`,
    },
    input: {
      path: { aftersaleid: aftersale }, query: {}, headers: {},
      body: { reason: 'L1 并发测试运营复核', evidence: { runId: cohort.runId } },
      rawBody: '', deadline: Date.now() + 20_000, signal: new AbortController().signal,
      idempotency: `${cohort.runId}:approve:${user.ordinal}`, expectedVersion: 0,
    },
  };
}

interface HttpCallInput {
  readonly method: 'GET' | 'POST' | 'PUT';
  readonly path: string;
  readonly expected: number;
  readonly user: UserState;
  readonly body?: Readonly<Record<string, unknown>>;
  readonly idempotency?: string;
  readonly authenticated?: boolean;
}

interface HttpCallOutput {
  readonly body: unknown;
  readonly status: number;
  readonly setCookies: readonly string[];
}

async function httpCall(cohort: CohortEvidence, stage: string, app: HttpApp, input: HttpCallInput): Promise<HttpCallOutput> {
  const started = performance.now();
  let recorded = false;
  try {
    const headers: Record<string, string> = {
      'x-contract-version': CONTRACT_VERSION,
      'x-request-id': `${cohort.runId}:${stage}:${input.user.ordinal}:${randomUUID()}`,
      'x-trace-id': `${cohort.runId}:${input.user.ordinal}:${stage}`,
      'x-device-id': `l1-device-${input.user.ordinal}`,
      'x-peer-address': `198.51.100.${input.user.ordinal % 255}`,
      'user-agent': 'zdt-l1-concurrency/1.0',
      host: new URL(IDENTITY_ENTRY_ORIGIN).host,
      origin: ORIGIN,
    };
    if (input.body !== undefined) headers['content-type'] = 'application/json';
    if (input.idempotency !== undefined) headers['idempotency-key'] = input.idempotency;
    if (input.authenticated) {
      headers.cookie = requiredUser(input.user.cookie, 'cookie');
      headers['x-csrf-token'] = requiredUser(input.user.csrf, 'csrf');
    }
    const response = await app.handle(new Request(new URL(input.path, IDENTITY_ENTRY_ORIGIN), {
      method: input.method,
      headers,
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
    }));
    const raw = await response.text();
    const body: unknown = raw === '' ? null : JSON.parse(raw);
    const code = bodyCode(body);
    cohort.record(stage, { durationMs: performance.now() - started, status: response.status, ...(code === undefined ? {} : { code }) });
    recorded = true;
    if (response.status !== input.expected) {
      const diagnostic = FAILURE_TELEMETRY.findLast((record) => record.requestId === headers['x-request-id']) ?? FAILURE_TELEMETRY.at(-1);
      const capabilities = CAPABILITY_OBSERVATIONS.slice(-4);
      const authorization = AUTHORIZATION_FAILURES.findLast((record) => record.trace === headers['x-trace-id']) ?? null;
      throw new Error(`HTTP_STATUS:${stage}:${response.status}:${input.expected}:${String(diagnostic?.errorCode ?? 'UNKNOWN')}:${raw.slice(0, 400)}:AUTHORIZATION:${JSON.stringify(authorization)}:CAPABILITIES:${JSON.stringify(capabilities)}`);
    }
    const headersWithCookies = response.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = headersWithCookies.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? ''];
    return { body, status: response.status, setCookies };
  } catch (cause) {
    if (!recorded) {
      cohort.record(stage, { durationMs: performance.now() - started, status: 'thrown', code: asError(cause).message });
    }
    throw cause;
  }
}

class SmsDebugDispatcher implements IdentityChallengeDispatcher {
  private readonly codes = new Map<string, string>();
  private readonly waits = new Map<string, number>();
  private readonly providers = new Map<string, number>();

  constructor(private readonly pool: DatabasePool, private readonly envelope: TestEnvelopeKms) {}

  async challenge(id: string): Promise<void> {
    const loaded = await this.pool.query<{
      purpose: string;
      code_ciphertext: string;
      destination_ciphertext: string;
      created_at: Date;
    }>(`select challenge.purpose,secret.code_ciphertext,secret.destination_ciphertext,job.created_at
      from identity.challenge challenge join identity.challengesecret secret on secret.challenge_id=challenge.id
      join runtime.job job on job.id='job:notify:'||challenge.id where challenge.id=$1`, [id]);
    const selected = loaded.rows[0];
    if (!selected) throw new Error(`SMS_CHALLENGE_NOT_FOUND:${id}`);
    const code = await this.envelope.decrypt('identity/challenge', selected.code_ciphertext);
    await this.envelope.decrypt('identity/destination', selected.destination_ciphertext);
    const providerStarted = performance.now();
    await Promise.resolve();
    this.codes.set(id, code);
    this.providers.set(id, performance.now() - providerStarted);
    this.waits.set(id, Math.max(0, Date.now() - selected.created_at.getTime()));
  }

  code(challenge: string): string {
    const code = this.codes.get(challenge);
    if (!code) throw new Error(`SMS_DEBUG_CODE_NOT_DELIVERED:${challenge}`);
    return code;
  }

  metrics(jobIds: readonly string[]): Readonly<{ queueWaitMs: Statistics; providerMs: Statistics }> {
    const challenges = jobIds.map((id) => id.replace(/^job:notify:/, ''));
    return {
      queueWaitMs: statistics(challenges.map((id) => this.waits.get(id) ?? Number.NaN)),
      providerMs: statistics(challenges.map((id) => this.providers.get(id) ?? Number.NaN)),
    };
  }
}

async function drainIdentityQueue(adminClient: Client, pool: DatabasePool, sms: SmsDebugDispatcher, jobIds: readonly string[],
  label: string, runId: string): Promise<QueueEvidence> {
  const job = createIdentityNotificationJob(pool, sms, `${runId}:${label}`);
  const drained = await drainQueue(adminClient, job, jobIds, 'identitynotification');
  return { ...drained, ...sms.metrics(jobIds) };
}

interface RunnableJob {
  execute(input: void, context: { readonly id: string; readonly attempt: number; readonly signal: AbortSignal }): Promise<void>;
}

async function drainQueue(adminClient: Client, job: RunnableJob, jobIds: readonly string[], kind: string): Promise<QueueEvidence> {
  assert(jobIds.length > 0, `QUEUE_JOB_IDS_EMPTY:${kind}`);
  const controller = new AbortController();
  let runnerFailure: Error | null = null;
  const running = job.execute(undefined, { id: `${ROOT_RUN_ID}:${kind}`, attempt: 1, signal: controller.signal })
    .catch((cause: unknown) => { runnerFailure = asError(cause); });
  const started = performance.now();
  let peakOutstanding = 0;
  let states: Readonly<Record<string, number>> = {};
  try {
    while (performance.now() - started < 120_000) {
      const result = await adminClient.query<{ state: string; count: number }>(
        `select state,count(*)::integer count from runtime.job where id=any($1::text[]) group by state`, [jobIds]);
      states = Object.fromEntries(result.rows.map(({ state, count }) => [state, count]));
      const observed = Object.values(states).reduce((sum, count) => sum + count, 0);
      assert(observed === jobIds.length, `QUEUE_JOB_COUNT:${kind}:${observed}:${jobIds.length}`);
      const outstanding = (states.queued ?? 0) + (states.running ?? 0);
      peakOutstanding = Math.max(peakOutstanding, outstanding);
      if (states.failed) {
        const failures = await adminClient.query<{ source_id: string; error_code: string }>(
          `select source_id,error_code from runtime.deadletter where kind='job' and source_id=any($1::text[]) order by source_id`, [jobIds]);
        throw new Error(`QUEUE_FAILED:${kind}:${states.failed}:${failures.rows.map(({ source_id, error_code }) => `${source_id}=${error_code}`).join('|')}`);
      }
      if ((states.completed ?? 0) === jobIds.length) break;
      if (runnerFailure) throw runnerFailure;
      await delay(20);
    }
    assert((states.completed ?? 0) === jobIds.length, `QUEUE_DRAIN_TIMEOUT:${kind}:${JSON.stringify(states)}`);
  } finally {
    controller.abort();
    await running;
  }
  if (runnerFailure) throw runnerFailure;
  return { kind, jobs: jobIds.length, drainMs: round(performance.now() - started), peakOutstanding, finalStates: states };
}

function paymentQueueConfiguration(runId: string, suffix: string) {
  return {
    worker: `${runId}:${suffix}`,
    owner: 'payment',
    batch: 50,
    poll: 10,
    lease: 30,
    concurrency: 24,
    attempts: 3,
    deadline: 20_000,
    retryMinimum: 50,
    retryMaximum: 1_000,
  } as const;
}

function withSqlDiagnostics(pool: DatabasePool): DatabasePool {
  return {
    connect: async () => {
      const client = await pool.connect();
      const query = client.query.bind(client);
      return new Proxy(client, {
        get(target, property, receiver) {
          if (property !== 'query') return Reflect.get(target, property, receiver) as unknown;
          return async (text: string, values?: readonly unknown[]) => {
            try {
              return await query(text, values as unknown[] | undefined);
            } catch (cause) {
              throw sqlDiagnostic(cause, text);
            }
          };
        },
      }) as PoolClient;
    },
    query: <R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]) =>
      pool.query<R>(text, values).catch((cause: unknown) => { throw sqlDiagnostic(cause, text); }),
    workload: (workload) => withSqlDiagnostics(pool.workload(workload)),
    end: () => pool.end(),
  };
}

function sqlDiagnostic(cause: unknown, text: string): Error {
  const sql = text.replaceAll(/\s+/g, ' ').trim().slice(0, 240);
  const diagnostic = new Error(`${asError(cause).message}:SQL:${sql}`, { cause }) as Error & { code?: unknown };
  if (cause !== null && typeof cause === 'object' && 'code' in cause) diagnostic.code = cause.code;
  return diagnostic;
}

async function jobIdsForPayload(adminClient: Client, kind: string, field: string, values: readonly string[]): Promise<readonly string[]> {
  const result = await adminClient.query<{ id: string }>(
    `select id from runtime.job where kind=$1 and payload->>$2=any($3::text[]) order by id`, [kind, field, values]);
  assert(result.rows.length === values.length, `JOB_PAYLOAD_COUNT:${kind}:${result.rows.length}:${values.length}`);
  return result.rows.map(({ id }) => id);
}

function createWechatGateway(runId: string): PaymentGateway {
  return {
    application: (scene) => ({ scene, applicationHash: 'a'.repeat(64) }),
    prepay: async (input) => ({
      appId: 'wx-l1-concurrency',
      timeStamp: String(Math.floor(Date.now() / 1_000)),
      nonceStr: createHash('sha256').update(input.orderNumber).digest('hex').slice(0, 24),
      package: `prepay_id=${createHash('sha256').update(input.orderNumber).digest('hex').slice(0, 24)}`,
      signType: 'RSA',
      paySign: 'l1-concurrency-signed',
      providerRequestId: `wechat:${createHash('sha256').update(`${runId}:${input.orderNumber}`).digest('hex').slice(0, 32)}`,
    }),
    query: async (reference) => ({
      state: 'succeeded',
      transaction: `wxpay:${createHash('sha256').update(reference).digest('hex').slice(0, 40)}`,
      amountMinor: 5_180,
      occurredAt: new Date().toISOString(),
      evidence: { provider: 'wechat-test', runId },
    }),
    close: async () => undefined,
    refund: async (input) => ({
      state: 'succeeded',
      reference: `wxrefund:${createHash('sha256').update(input.refundNumber).digest('hex').slice(0, 36)}`,
      occurredAt: new Date().toISOString(),
      evidence: { provider: 'wechat-test', runId },
    }),
    queryRefund: async (reference) => ({
      state: 'succeeded', reference, occurredAt: new Date().toISOString(), evidence: { provider: 'wechat-test', runId },
    }),
    verifyNotification: async () => { throw new Error('WECHAT_NOTIFICATION_NOT_USED'); },
  };
}

class ResourceMonitor {
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  private nextTick = 0;
  private active: {
    peakDatabaseConnections: number;
    peakRssBytes: number;
    maxEventLoopDelayMs: number;
    readonly cpu: NodeJS.CpuUsage;
    readonly started: number;
  } | null = null;

  constructor(private readonly client: Client) {}

  start(): void {
    this.nextTick = performance.now() + 20;
    this.timer = setInterval(() => void this.sample(), 20);
  }

  beginTier(): void {
    this.active = { peakDatabaseConnections: 0, peakRssBytes: process.memoryUsage().rss, maxEventLoopDelayMs: 0,
      cpu: process.cpuUsage(), started: performance.now() };
  }

  async endTier(): Promise<TierResources> {
    await this.sample();
    const active = this.active;
    if (!active) throw new Error('RESOURCE_MONITOR_NOT_ACTIVE');
    const elapsed = Math.max(1, performance.now() - active.started);
    const cpu = process.cpuUsage(active.cpu);
    this.active = null;
    return {
      peakDatabaseConnections: active.peakDatabaseConnections,
      peakRssBytes: active.peakRssBytes,
      maxEventLoopDelayMs: round(active.maxEventLoopDelayMs),
      cpuUserMs: round(cpu.user / 1_000),
      cpuSystemMs: round(cpu.system / 1_000),
      cpuPercentOfOneCore: round(((cpu.user + cpu.system) / 1_000) * 100 / elapsed),
    };
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async sample(): Promise<void> {
    const now = performance.now();
    if (this.active) {
      this.active.maxEventLoopDelayMs = Math.max(this.active.maxEventLoopDelayMs, Math.max(0, now - this.nextTick));
      this.active.peakRssBytes = Math.max(this.active.peakRssBytes, process.memoryUsage().rss);
    }
    this.nextTick = now + 20;
    if (this.busy || !this.active) return;
    this.busy = true;
    try {
      const result = await this.client.query<{ total: number }>(
        `select count(*)::integer total from pg_stat_activity where datname=current_database()`);
      if (this.active) this.active.peakDatabaseConnections = Math.max(this.active.peakDatabaseConnections, result.rows[0]?.total ?? 0);
    } finally {
      this.busy = false;
    }
  }
}

async function seedSharedFixture(adminClient: Client): Promise<SharedFixture> {
  const base = {
    otherMall: identifier('mall:concurrency-other'),
    category: identifier('category:concurrency'),
    product: identifier('product:concurrency'),
    sku: identifier('sku:concurrency'),
    pool: identifier('pool:concurrency'),
    otherPool: identifier('pool:concurrency-other'),
    listing: identifier('listing:concurrency'),
    otherListing: identifier('listing:concurrency-other'),
    pricebook: identifier('pricebook:concurrency'),
    price: identifier('price:concurrency'),
    stock: identifier('stock:concurrency'),
    application: identifier('application:concurrency'),
    version: identifier('experienceversion:concurrency'),
    release: identifier('release:concurrency'),
    publication: identifier('publication:concurrency'),
    reviewerPrincipal: identifier('principal:concurrency-reviewer'),
    reviewerMember: identifier('member:concurrency-reviewer'),
    reviewerMembership: identifier('membership:concurrency-reviewer'),
  };
  const hierarchy = await adminClient.query<{ id: string }>(
    `select id from organization.organization where id=any($1::text[]) and status='active'`, [[MALL, TENANT, ENTERPRISE]]);
  assert(hierarchy.rows.length === 3, `HONGTAI_HIERARCHY_MISSING:${hierarchy.rows.map(({ id }) => id).join(',')}`);
  await adminClient.query('begin');
  try {
    await adminClient.query(`insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
      values($1,'mall',$2,'L1 并发隔离商城','Asia/Shanghai','active',0,clock_timestamp(),clock_timestamp())`,
    [base.otherMall, ENTERPRISE]);
    await adminClient.query(`insert into organization.unitclosure(ancestor_id,descendant_id,depth)
      select ancestor_id,$1,depth+1 from organization.unitclosure where descendant_id=$2
      union all select $1,$1,0`, [base.otherMall, ENTERPRISE]);
    await adminClient.query(`insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
      values($1,'active',1,clock_timestamp(),clock_timestamp(),0)`, [base.reviewerPrincipal]);
    await adminClient.query(`insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
      values($1,$2,'L1 并发测试复核员','active',clock_timestamp(),clock_timestamp(),0)`,
    [base.reviewerMember, base.reviewerPrincipal]);
    await adminClient.query(`insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
      values($1,$2,$3,'operator','active',1,clock_timestamp())`, [base.reviewerMembership, base.reviewerMember, TENANT]);
    await adminClient.query(`insert into catalog.category(id,code,name,status,sort_order)
      values($1,$2,'宏泰甄选 L1 并发商品','active',1)`, [base.category, `L1-${SHORT_RUN}`]);
    await adminClient.query(`insert into catalog.product(id,category_id,title,product_type,attributes,status,version,created_at,updated_at)
      values($1,$2,'宏泰甄选并发测试商品','physical','{}','active',1,clock_timestamp(),clock_timestamp())`,
    [base.product, base.category]);
    await adminClient.query(`insert into catalog.sku(id,product_id,code,specifications,status,version)
      values($1,$2,$3,'{}','active',1)`, [base.sku, base.product, `SKU-${SHORT_RUN.toUpperCase()}`]);
    await adminClient.query(`insert into catalog.pool(id,scope_id,kind,name,status,version) values
      ($1,$2,'private','宏泰甄选 L1 并发池','active',1),
      ($3,$4,'private','L1 跨商城隔离池','active',1)`, [base.pool, MALL, base.otherPool, base.otherMall]);
    await adminClient.query(`insert into catalog.poolitem(pool_id,sku_id,state,source_version,added_at) values
      ($1,$3,'included','1',clock_timestamp()),($2,$3,'included','1',clock_timestamp())`,
    [base.pool, base.otherPool, base.sku]);
    await adminClient.query(`insert into catalog.poolbinding(mall_id,pool_id,listing_kind,status,effective_at,created_at) values
      ($1,$2,'selected','active','2000-01-01T00:00:00Z',clock_timestamp()),
      ($3,$4,'selected','active','2000-01-01T00:00:00Z',clock_timestamp())`, [MALL, base.pool, base.otherMall, base.otherPool]);
    await adminClient.query(`insert into catalog.listing(id,scope_id,pool_id,sku_id,title,status,effective_at,version,created_at,updated_at) values
      ($1,$2,$3,$4,'宏泰甄选并发测试商品','published','2000-01-01T00:00:00Z',1,clock_timestamp(),clock_timestamp()),
      ($5,$6,$7,$4,'跨商城不可见商品','published','2000-01-01T00:00:00Z',1,clock_timestamp(),clock_timestamp())`,
    [base.listing, MALL, base.pool, base.sku, base.otherListing, base.otherMall, base.otherPool]);
    await adminClient.query(`insert into pricing.pricebook(id,scope_id,currency,name,status,version)
      values($1,$2,'CNY','宏泰甄选 L1 并发价目表','active',1)`, [base.pricebook, MALL]);
    await adminClient.query(`insert into pricing.price(id,book_id,sku_id,amount_minor,compare_minor,effective_at)
      values($1,$2,$3,2590,2990,'1970-01-01T00:00:00Z')`, [base.price, base.pricebook, base.sku]);
    await adminClient.query(`insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at)
      values($1,$2,$3,$4,5000,5,1,'active',clock_timestamp())`, [base.stock, MALL, base.sku, `warehouse:${SHORT_RUN}`]);
    const contentHash = createHash('sha256').update(ROOT_RUN_ID).digest('hex');
    await adminClient.query(`insert into experience.application(id,scope_id,name,status,created_at,updated_at,version,code,public_slug)
      values($1,$2,'宏泰甄选 L1 并发店铺','active',clock_timestamp(),clock_timestamp(),1,$3,$4)`,
    [base.application, MALL, `L1_${SHORT_RUN.toUpperCase()}`, SLUG]);
    await adminClient.query(`insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,created_by,created_at)
      values($1,$2,1,'2',$3::jsonb,$4,'valid',$5,clock_timestamp())`, [base.version, base.application,
      JSON.stringify({ version: 2, application: base.application, pages: [{ id: 'home', path: '/', blocks: [] }] }),
      contentHash, base.reviewerPrincipal]);
    await adminClient.query('update experience.application set head_version_id=$2 where id=$1', [base.application, base.version]);
    await adminClient.query(`insert into experience.release(id,application_id,version_id,state,effective_at,published_by)
      values($1,$2,$3,'active','2000-01-01T00:00:00Z',$4)`, [base.release, base.application, base.version, base.reviewerPrincipal]);
    await adminClient.query(`insert into experience.binding(application_id,domain,mall_id,pool_id) values($1,$2,$3,$4)`,
    [base.application, SLUG, MALL, base.pool]);
    await adminClient.query(`update identity.realmtarget set application_slug=$1,return_origin=$2
      where realm_id='realm:l0' and target='storefront'`, [SLUG, ORIGIN]);
    await adminClient.query(`insert into experience.publication(id,release_id,application_id,version_id,content_hash,object_key,object_ref,object_hash,object_size,state,staged_at,published_at)
      values($1,$2,$3,$4,$5,$6,$7,$5,1,'active',clock_timestamp(),clock_timestamp())`, [base.publication, base.release,
      base.application, base.version, contentHash, `experience/${base.application}/${contentHash}.json`, `object:${base.application}`]);
    await adminClient.query('commit');
  } catch (cause) {
    await adminClient.query('rollback');
    throw cause;
  }
  const policy = await adminClient.query<{ terms_hash: string }>(`select terms_hash from identity.registrationpolicy
    where effective_at<=clock_timestamp() and (retired_at is null or retired_at>clock_timestamp()) order by version desc limit 1`);
  const termsHash = policy.rows[0]?.terms_hash;
  if (!termsHash) throw new Error('REGISTRATION_POLICY_MISSING');
  return { ...base, termsHash };
}

async function hydrateRegisteredPrincipals(adminClient: Client, users: readonly UserState[]): Promise<void> {
  const memberships = users.map((user) => requiredUser(user.membership, 'membership'));
  const result = await adminClient.query<{ membership: string; member: string; principal: string }>(
    `select membership.id membership,profile.id member,profile.principal_id principal
      from access.membership membership join member.profile profile on profile.id=membership.member_id
      where membership.id=any($1::text[])`, [memberships]);
  const indexed = new Map(result.rows.map((row) => [row.membership, row]));
  for (const user of users) {
    const selected = indexed.get(requiredUser(user.membership, 'membership'));
    if (!selected || selected.member !== user.member) throw new Error(`REGISTERED_PRINCIPAL_MISSING:${user.ordinal}`);
    user.principal = selected.principal;
  }
}

async function seedUserCheckoutFixtures(adminClient: Client, users: readonly UserState[]): Promise<void> {
  const rows = await Promise.all(users.map(async (user) => ({
    address: user.address,
    member: requiredUser(user.member, 'member'),
    principal: requiredUser(user.principal, 'principal'),
    membership: requiredUser(user.membership, 'membership'),
    federated: identifier(`federated:concurrency:${user.ordinal}`),
    subjectHash: createHash('sha256').update(`${ROOT_RUN_ID}:openid:${user.ordinal}`).digest('hex'),
    ciphertext: await kms.seal('identity/wechat', `openid-l1-${user.ordinal}-${SHORT_RUN}`),
  })));
  await adminClient.query('begin');
  try {
    await adminClient.query(`with fixture as (select * from jsonb_to_recordset($1::jsonb)
        as value(address text,member text,principal text,membership text,federated text,"subjectHash" text,ciphertext text))
      insert into checkout.address(id,member_id,recipient_ciphertext,mobile_ciphertext,address_ciphertext,region_token,address_token,status,version,
        recipient_masked,mobile_masked,address_masked,region_code)
      select address,member,'cipher:recipient','cipher:mobile','cipher:address',repeat('a',64),
        encode(public.digest(address,'sha256'),'hex'),'active',1,'测**','139****0000','上海市测试地址','310000' from fixture`,
    [JSON.stringify(rows)]);
    await adminClient.query(`with fixture as (select * from jsonb_to_recordset($1::jsonb) as value(member text)),
      updated as (update qualification.profile profile set city_code='310000',city_name='上海市',status='active',updated_at=clock_timestamp()
        from fixture where profile.member_id=fixture.member and profile.scope_id=$2 returning profile.member_id)
      insert into qualification.profile(member_id,scope_id,city_code,city_name,attributes,status,version,updated_at)
      select member,$2,'310000','上海市','{}','active',1,clock_timestamp() from fixture
      where not exists(select 1 from qualification.profile profile where profile.member_id=fixture.member and profile.scope_id=$2)`,
    [JSON.stringify(rows), MALL]);
    await adminClient.query(`with fixture as (select * from jsonb_to_recordset($1::jsonb)
        as value(principal text,membership text,federated text,"subjectHash" text,ciphertext text))
      insert into identity.federatedidentity(id,principal_id,membership_id,provider,application_hash,subject_hash,
        subject_ciphertext,subject_key_version,status,bound_at,created_at,updated_at)
      select federated,principal,membership,'wechat',repeat('a',64),"subjectHash",ciphertext,'test-v1','active',
        clock_timestamp(),clock_timestamp(),clock_timestamp() from fixture`, [JSON.stringify(rows)]);
    await adminClient.query('commit');
  } catch (cause) {
    await adminClient.query('rollback');
    throw cause;
  }
}

async function verifyCohortIsolation(adminClient: Client, fixture: SharedFixture,
  users: readonly UserState[]): Promise<Readonly<Record<string, unknown>>> {
  const members = users.map((user) => requiredUser(user.member, 'member'));
  const sessions = users.map((user) => requiredUser(user.session, 'session'));
  const orders = users.map((user) => requiredUser(user.order, 'order'));
  const aftersales = users.map((user) => requiredUser(user.aftersale, 'aftersale'));
  const result = await adminClient.query<{
    carts: number; cart_items: number; foreign_cart_items: number; orders: number; wrong_order_owner: number;
    aftersales: number; completed_aftersales: number; payments: number; refunds: number; succeeded_refunds: number; sessions: number;
  }>(`select
      (select count(*)::integer from cart.cart where member_id=any($1::text[]) and mall_id=$5) carts,
      (select count(*)::integer from cart.item item join cart.cart cart on cart.id=item.cart_id
        where cart.member_id=any($1::text[]) and item.listing_id=$6) cart_items,
      (select count(*)::integer from cart.item item join cart.cart cart on cart.id=item.cart_id
        where cart.member_id=any($1::text[]) and item.listing_id=$7) foreign_cart_items,
      (select count(*)::integer from ordering.orderrecord where id=any($2::text[])) orders,
      (select count(*)::integer from ordering.orderrecord placed where placed.id=any($2::text[])
        and not exists(select 1 from unnest($2::text[],$1::text[]) expected(order_id,member_id)
          where expected.order_id=placed.id and expected.member_id=placed.member_id)) wrong_order_owner,
      (select count(*)::integer from ordering.aftersale where id=any($3::text[])) aftersales,
      (select count(*)::integer from ordering.aftersale where id=any($3::text[]) and state='completed') completed_aftersales,
      (select count(*)::integer from payment.payment payment join payment.intent intent
        on intent.mall_id=payment.mall_id and intent.id=payment.intent_id where intent.order_id=any($2::text[])) payments,
      (select count(*)::integer from payment.refund refund join payment.payment payment
        on payment.mall_id=refund.mall_id and payment.id=refund.payment_id join payment.intent intent
        on intent.mall_id=payment.mall_id and intent.id=payment.intent_id where intent.order_id=any($2::text[])) refunds,
      (select count(*)::integer from payment.refund refund join payment.payment payment
        on payment.mall_id=refund.mall_id and payment.id=refund.payment_id join payment.intent intent
        on intent.mall_id=payment.mall_id and intent.id=payment.intent_id
        where intent.order_id=any($2::text[]) and refund.state='succeeded') succeeded_refunds,
      (select count(*)::integer from identity.session where id=any($4::text[])) sessions`,
  [members, orders, aftersales, sessions, MALL, fixture.listing, fixture.otherListing]);
  const row = result.rows[0];
  if (!row) throw new Error('COHORT_ISOLATION_EVIDENCE_MISSING');
  const expected = users.length;
  return {
    counts: row,
    exactOneCartPerUser: row.carts === expected && row.cart_items === expected,
    noForeignCartItems: row.foreign_cart_items === 0,
    exactOneOrderPerUser: row.orders === expected,
    noCrossUserOrderOwner: row.wrong_order_owner === 0,
    exactOneAftersalePerUser: row.aftersales === expected && row.completed_aftersales === expected,
    exactOnePaymentAndRefundPerUser: row.payments === expected && row.refunds === expected && row.succeeded_refunds === expected,
    exactOneLoginSessionPerUser: row.sessions === expected,
  };
}

async function finalDatabaseEvidence(adminClient: Client): Promise<Readonly<Record<string, unknown>>> {
  const [version, jobs, deadletters, totals] = await Promise.all([
    adminClient.query<{ server_version: string }>('show server_version'),
    adminClient.query<{ kind: string; state: string; count: number }>(
      `select kind,state,count(*)::integer count from runtime.job group by kind,state order by kind,state`),
    adminClient.query<{ count: number }>('select count(*)::integer count from runtime.deadletter'),
    adminClient.query<{ orders: number; aftersales: number; refunds: number }>(`select
      (select count(distinct order_id)::integer from ordering.aftersale where reason='L1 并发全链路模拟退款') orders,
      (select count(*)::integer from ordering.aftersale where reason='L1 并发全链路模拟退款') aftersales,
      (select count(*)::integer from payment.refund refund join ordering.aftersale aftersale on aftersale.id=refund.aftersale_id
        where aftersale.reason='L1 并发全链路模拟退款') refunds`),
  ]);
  return {
    serverVersion: version.rows[0]?.server_version,
    queueStates: jobs.rows,
    deadletters: deadletters.rows[0]?.count ?? -1,
    totals: totals.rows[0],
    expectedResidualQueue: 'fulfillment jobs remain queued because fulfillment dispatch is outside this journey; all SMS/payment/refund jobs must be completed',
  };
}

function createUser(ordinal: number): UserState {
  const verifier = createHash('sha512').update(`${ROOT_RUN_ID}:verifier:${ordinal}`).digest('base64url');
  return {
    ordinal,
    phone: `+86${String(13_900_000_000 + ordinal)}`,
    password: `Concurrent9-${String(ordinal).padStart(4, '2')}Az`,
    address: identifier(`address:concurrency:${ordinal}`),
    auth: {
      state: createHash('sha256').update(`${ROOT_RUN_ID}:state:${ordinal}`).digest('base64url'),
      nonce: createHash('sha256').update(`${ROOT_RUN_ID}:nonce:${ordinal}`).digest('base64url'),
      verifier,
      challenge: createHash('sha256').update(verifier).digest('base64url'),
    },
    flowStarted: 0,
    flowCompleted: 0,
  };
}

function identifier(prefix: string): string {
  return `${prefix}:${randomUUID()}`;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`ENVIRONMENT_REQUIRED:${name}`);
  return value;
}

function requiredUser(value: string | undefined, field: string): string {
  if (!value) throw new Error(`USER_FIELD_REQUIRED:${field}`);
  return value;
}

function asRecord(value: unknown, code = 'OBJECT_REQUIRED'): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}

function textField(value: unknown, field: string): string {
  const selected = asRecord(value)[field];
  if (typeof selected !== 'string' || selected.length === 0) throw new Error(`TEXT_FIELD_REQUIRED:${field}`);
  return selected;
}

function numberField(value: unknown, field: string): number {
  const selected = asRecord(value)[field];
  if (typeof selected !== 'number' || !Number.isFinite(selected)) throw new Error(`NUMBER_FIELD_REQUIRED:${field}`);
  return selected;
}

function recordField(value: unknown, field: string): Readonly<Record<string, unknown>> {
  return asRecord(asRecord(value)[field], `RECORD_FIELD_REQUIRED:${field}`);
}

function arrayField(value: unknown, field: string): readonly unknown[] {
  const selected = asRecord(value)[field];
  if (!Array.isArray(selected)) throw new Error(`ARRAY_FIELD_REQUIRED:${field}`);
  return selected;
}

function bodyCode(value: unknown): string | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const code = Reflect.get(value, 'code');
  return typeof code === 'string' ? code : undefined;
}

function canonicalJson(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item !== null && typeof item === 'object') {
      return Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalize(nested)]));
    }
    return item;
  };
  return JSON.stringify(normalize(value));
}

function cookieFromSetCookies(cookies: readonly string[], name: string): string {
  const expression = new RegExp(`(?:^|,\\s*)${name}=([^;,\\s]+)`);
  for (const cookie of cookies) {
    const match = expression.exec(cookie);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  throw new Error(`COOKIE_MISSING:${name}:${cookies.join('|').slice(0, 200)}`);
}

function statistics(values: readonly number[]): Statistics {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) return { count: 0, min: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const percentile = (value: number) => sorted[Math.max(0, Math.ceil(sorted.length * value) - 1)]!;
  return {
    count: sorted.length,
    min: round(sorted[0]!),
    mean: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    p50: round(percentile(0.50)),
    p95: round(percentile(0.95)),
    p99: round(percentile(0.99)),
    max: round(sorted.at(-1)!),
  };
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

await main();
