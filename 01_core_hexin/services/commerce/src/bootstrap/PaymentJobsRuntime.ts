import {
  CONTRACT_SCHEMA_HEAD,
  RUNTIME_CONTRACT_CHECKSUM,
  TARGET_SCHEMA_HEAD,
  WechatApplicationCatalog,
  loadNodeManifest,
  nodeManifestHasFeature,
  requiredValue,
  type JobsEnvironment,
  type NodeManifest,
} from '@shop/config/server';
import { loadWechatPayConfig, type WechatPayConfig } from '@shop/wechatpayment';
import type { Job } from '../foundation/application/Job';
import type { JobRunnerConfig } from '../foundation/application/JobRunner';
import { QueueJob } from '../foundation/infrastructure/QueueJob';
import { WorkloadSecretStore } from '../foundation/infrastructure/SecretStore';
import { createPool, type DatabasePool } from '../foundation/persistence/Pool';
import { JobMetrics } from '../foundation/telemetry/JobMetrics';
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import { PaymentDeadletter } from '../modules/payment_zhifu/04_adapters_shixian/persistence_cunchu/PaymentDeadletter';
import { PaymentJobProcessor } from '../modules/payment_zhifu/05_interface_jieru/jobs_renwu/PaymentJobs';
import { WechatGateway } from '../modules/payment_zhifu/04_adapters_shixian/providers_waibu/WechatGateway';

export const PAYMENT_JOB_KINDS = Object.freeze(['paymentquery', 'paymentrefund'] as const);

interface CompatibilityRow {
  readonly current_user: string;
  readonly role_safe: boolean;
  readonly writable: boolean;
  readonly schema: boolean;
  readonly contract: boolean;
  readonly relations: boolean;
  readonly functions: boolean;
  readonly privileges: boolean;
}

export interface PaymentJobsRuntime {
  readonly jobs: readonly Job<void>[];
  readonly manifest: NodeManifest;
  close(): Promise<void>;
}

export async function createPaymentJobsRuntime(environment: JobsEnvironment): Promise<PaymentJobsRuntime> {
  const manifest = await loadNodeManifest(requiredValue(environment.NODE_MANIFEST_PATH, 'NODE_MANIFEST_PATH_MISSING'), {
    manifestId: requiredValue(environment.NODE_MANIFEST_ID, 'NODE_MANIFEST_ID_MISSING'),
    manifestDigest: requiredValue(environment.NODE_MANIFEST_DIGEST, 'NODE_MANIFEST_DIGEST_MISSING'),
    runtimeInstanceId: requiredValue(environment.NODE_RUNTIME_INSTANCE_ID, 'NODE_RUNTIME_INSTANCE_ID_MISSING'),
    runtimeConfigRef: requiredValue(environment.NODE_RUNTIME_CONFIG_REF, 'NODE_RUNTIME_CONFIG_REF_MISSING'),
    resourceBindingVersion: requiredValue(environment.NODE_RESOURCE_BINDING_VERSION, 'NODE_RESOURCE_BINDING_VERSION_MISSING'),
    releasePointerRef: requiredValue(environment.NODE_RELEASE_POINTER_REF, 'NODE_RELEASE_POINTER_REF_MISSING'),
  });
  assertPaymentJobsNodeManifest(manifest, environment);
  const secrets = new WorkloadSecretStore(
    requiredValue(environment.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING'),
    requiredValue(environment.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_MISSING'),
  );
  const [connection, applicationsSource, paymentSource] = await Promise.all([
    secrets.read(requiredValue(environment.DATABASE_JOB_CONNECTION_REF, 'DATABASE_JOB_CONNECTION_REF_MISSING')),
    secrets.read(requiredValue(environment.WECHAT_APPLICATION_CONFIG_REF, 'WECHAT_APPLICATION_CONFIG_REF_MISSING')),
    secrets.read(requiredValue(environment.WECHAT_PAYMENT_CONFIG_REF, 'WECHAT_PAYMENT_CONFIG_REF_MISSING')),
  ]);
  const paymentConfiguration = loadWechatPayConfig(
    parseSecret(paymentSource, 'WECHAT_PAYMENT_CONFIG_INVALID') as unknown as Parameters<typeof loadWechatPayConfig>[0]);
  assertPaymentJobsConfiguration(manifest, paymentConfiguration);
  const gateway = new WechatGateway(
    WechatApplicationCatalog.parse(parseSecret(applicationsSource, 'WECHAT_APPLICATION_CONFIG_INVALID')),
    paymentConfiguration,
  );
  const pool = createPool(connection, 'jobs');
  try {
    await assertPaymentJobsRuntimeCompatibility(pool, requiredValue(environment.DATABASE_JOB_ROLE, 'DATABASE_JOB_ROLE_MISSING'));
    return Object.freeze({
      jobs: createPaymentJobs(pool, gateway, requiredValue(environment.JOB_WORKER_ID, 'JOB_WORKER_ID_MISSING'), manifest.data_scope_ref.ref),
      manifest,
      close: () => pool.end(),
    });
  } catch (cause) {
    await pool.end().catch(() => undefined);
    throw cause;
  }
}

export function createPaymentJobs(
  pool: DatabasePool,
  gateway: ConstructorParameters<typeof PaymentJobProcessor>[1],
  worker: string,
  scope?: string,
): readonly Job<void>[] {
  const metrics = new JobMetrics(commerceTelemetry());
  const deadletter = new PaymentDeadletter();
  return Object.freeze([
    new QueueJob('paymentquery', pool, paymentJobConfig(worker, 16, scope), new PaymentJobProcessor(pool, gateway, 'paymentquery'), deadletter, metrics),
    new QueueJob('paymentrefund', pool, paymentJobConfig(worker, 8, scope), new PaymentJobProcessor(pool, gateway, 'paymentrefund'), deadletter, metrics),
  ]);
}

export async function paymentJobsRuntimeCompatibility(pool: DatabasePool): Promise<Readonly<CompatibilityRow>> {
  const result = await pool.query<CompatibilityRow>(`select current_user,
    not exists(select 1 from pg_roles where rolname=current_user
      and (rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolreplication or rolbypassrls)) role_safe,
    not pg_is_in_recovery() writable,
    exists(select 1 from runtime.schemaversion where version=$1) schema,
    exists(select 1 from runtime.schemaversion where version=$2 and checksum=$3) contract,
    array_position(array[
      to_regclass('runtime.schemaversion'),to_regclass('runtime.job'),to_regclass('runtime.deadletter'),to_regclass('runtime.outbox'),
      to_regclass('ordering.orderrecord'),to_regclass('payment.intent'),to_regclass('payment.intenttender'),
      to_regclass('payment.attempt'),to_regclass('payment.payment'),to_regclass('payment.prepay'),
      to_regclass('payment.providerattempt'),to_regclass('payment.refund'),to_regclass('payment.refundtender'),
      to_regclass('payment.recoverycase')
    ],null) is null relations,
    to_regprocedure('runtime.claim_job(text,text,integer,integer)') is not null
      and has_function_privilege(current_user,'runtime.claim_job(text,text,integer,integer)','EXECUTE') functions,
    has_table_privilege(current_user,'runtime.schemaversion','SELECT')
      and has_table_privilege(current_user,'runtime.job','SELECT,UPDATE')
      and has_table_privilege(current_user,'runtime.deadletter','SELECT,INSERT,UPDATE')
      and has_table_privilege(current_user,'runtime.outbox','SELECT,INSERT')
      and has_table_privilege(current_user,'ordering.orderrecord','SELECT,UPDATE')
      and has_table_privilege(current_user,'payment.intent','SELECT,UPDATE')
      and has_table_privilege(current_user,'payment.intenttender','SELECT,UPDATE')
      and has_table_privilege(current_user,'payment.attempt','SELECT,INSERT,UPDATE')
      and has_table_privilege(current_user,'payment.payment','SELECT,INSERT')
      and has_table_privilege(current_user,'payment.prepay','SELECT,DELETE')
      and has_table_privilege(current_user,'payment.providerattempt','SELECT,INSERT,UPDATE')
      and has_table_privilege(current_user,'payment.refund','SELECT,INSERT,UPDATE')
      and has_table_privilege(current_user,'payment.refundtender','SELECT,INSERT,UPDATE')
      and has_table_privilege(current_user,'payment.recoverycase','SELECT,INSERT,UPDATE') privileges`,
  [TARGET_SCHEMA_HEAD, CONTRACT_SCHEMA_HEAD, RUNTIME_CONTRACT_CHECKSUM]);
  return Object.freeze(result.rows[0] ?? {
    current_user: '', role_safe: false, writable: false, schema: false, contract: false,
    relations: false, functions: false, privileges: false,
  });
}

export async function assertPaymentJobsRuntimeCompatibility(pool: DatabasePool, expectedRole = 'shopjob'): Promise<void> {
  const state = await paymentJobsRuntimeCompatibility(pool);
  if (state.current_user !== expectedRole || !state.role_safe || !state.writable || !state.schema || !state.contract
    || !state.relations || !state.functions || !state.privileges) {
    throw new Error(`PAYMENT_JOBS_RUNTIME_COMPATIBILITY_FAILED:${JSON.stringify(state)}`);
  }
}

export function paymentJobConfig(worker: string, concurrency: number, scope?: string): JobRunnerConfig {
  return Object.freeze({
    worker,
    owner: 'payment',
    batch: concurrency,
    lease: 60,
    concurrency,
    attempts: 8,
    poll: 1_000,
    deadline: 30_000,
    retryMinimum: 250,
    retryMaximum: 60_000,
    ...(scope === undefined ? {} : { scope }),
  });
}

export function assertPaymentJobsNodeManifest(manifest: NodeManifest, environment: JobsEnvironment): void {
  if (manifest.node_profile !== 'operating_mall' || !nodeManifestHasFeature(manifest, 'checkout')) {
    throw new Error('PAYMENT_JOBS_NODE_MANIFEST_INVALID');
  }
  const secretPrefix = bindingPrefix(manifest.secret_binding_set_ref.ref, 'secrets');
  if (!environment.DATABASE_JOB_CONNECTION_REF?.startsWith(secretPrefix)) {
    throw new Error('PAYMENT_JOBS_NODE_SECRET_BINDING_MISMATCH');
  }
  const paymentPrefix = bindingPrefix(manifest.payment_binding_refs[0]?.ref, 'payment');
  if (![environment.WECHAT_APPLICATION_CONFIG_REF, environment.WECHAT_PAYMENT_CONFIG_REF]
    .every((reference) => reference?.startsWith(paymentPrefix))) {
    throw new Error('PAYMENT_JOBS_NODE_PAYMENT_BINDING_MISMATCH');
  }
  if (environment.APP_ENV === 'production' && manifest.lifecycle_status !== 'active') throw new Error('PAYMENT_JOBS_NODE_NOT_ACTIVE');
}

export function assertPaymentJobsConfiguration(manifest: NodeManifest, configuration: WechatPayConfig): void {
  const apiHosts = new Set(manifest.domain_bindings
    .filter((binding) => binding.surface_ref === 'surface:api')
    .map((binding) => binding.host));
  const urls = [configuration.notifyUrl, ...Object.values(configuration.notifyUrlsByScope)];
  if (urls.some((value) => !apiHosts.has(new URL(value).hostname))) throw new Error('PAYMENT_JOBS_CALLBACK_HOST_MISMATCH');
  if (Object.keys(configuration.notifyUrlsByScope).some((scope) => scope !== manifest.data_scope_ref.ref)) {
    throw new Error('PAYMENT_JOBS_CALLBACK_SCOPE_MISMATCH');
  }
}

function bindingPrefix(reference: string | undefined, suffix: string): string {
  if (!reference) return '__missing__/';
  return reference.endsWith(`/${suffix}`) ? reference.slice(0, -suffix.length) : `${reference}/`;
}

function parseSecret(value: string, code: string): Record<string, unknown> {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error(code); }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(code);
  return parsed as Record<string, unknown>;
}
