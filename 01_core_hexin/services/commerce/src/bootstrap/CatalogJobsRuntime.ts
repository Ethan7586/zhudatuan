import {
  CONTRACT_SCHEMA_HEAD,
  RUNTIME_CONTRACT_CHECKSUM,
  TARGET_SCHEMA_HEAD,
  loadNodeManifest,
  nodeManifestHasFeature,
  type NodeManifest,
} from '@shop/config/server';
import type { Job } from '../foundation/application/Job';
import type { JobRunnerConfig } from '../foundation/application/JobRunner';
import { HttpObjectStore, type ObjectStore } from '../foundation/infrastructure/ObjectStore';
import { QueueJob } from '../foundation/infrastructure/QueueJob';
import { WorkloadSecretStore } from '../foundation/infrastructure/SecretStore';
import { createPool, type DatabasePool } from '../foundation/persistence/Pool';
import { JobMetrics } from '../foundation/telemetry/JobMetrics';
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import { CatalogImportProcessor } from '../modules/catalog/05_interface_jieru/job/CatalogImportJob';
import { CatalogPublicationProcessor } from '../modules/catalog/05_interface_jieru/job/CatalogPublicationJob';
import { ExportJobRunner } from '../modules/reporting/05_interface_jieru/job/ExportJobRunner';

export interface CatalogJobsEnvironment {
  readonly APP_ENV: string;
  readonly DATABASE_JOB_CONNECTION_REF: string;
  readonly DATABASE_JOB_ROLE: string;
  readonly JOB_WORKER_ID: string;
  readonly OBJECT_STORE_ENDPOINT: string;
  readonly OBJECT_STORE_BEARER_TOKEN: string;
  readonly SECRET_STORE_ENDPOINT: string;
  readonly SECRET_STORE_BEARER_TOKEN: string;
  readonly NODE_MANIFEST_PATH: string;
  readonly NODE_MANIFEST_ID: string;
  readonly NODE_MANIFEST_DIGEST: string;
  readonly NODE_RUNTIME_INSTANCE_ID: string;
  readonly NODE_RUNTIME_CONFIG_REF: string;
  readonly NODE_RESOURCE_BINDING_VERSION: string;
  readonly NODE_RELEASE_POINTER_REF: string;
}

interface CompatibilityRow {
  readonly current_user: string;
  readonly session_user: string;
  readonly writable: boolean;
  readonly schema: boolean;
  readonly contract: boolean;
  readonly relations: boolean;
  readonly writes: boolean;
}

export interface CatalogJobsRuntime {
  readonly jobs: readonly Job<void>[];
  readonly manifest: NodeManifest;
  close(): Promise<void>;
}

export function catalogJobsEnvironment(source: NodeJS.ProcessEnv = process.env): CatalogJobsEnvironment {
  return Object.freeze({
    APP_ENV: required(source.APP_ENV, 'APP_ENV_MISSING'),
    DATABASE_JOB_CONNECTION_REF: required(source.DATABASE_JOB_CONNECTION_REF, 'DATABASE_JOB_CONNECTION_REF_MISSING'),
    DATABASE_JOB_ROLE: required(source.DATABASE_JOB_ROLE, 'DATABASE_JOB_ROLE_MISSING'),
    JOB_WORKER_ID: required(source.JOB_WORKER_ID, 'JOB_WORKER_ID_MISSING'),
    OBJECT_STORE_ENDPOINT: required(source.OBJECT_STORE_ENDPOINT, 'OBJECT_STORE_ENDPOINT_MISSING'),
    OBJECT_STORE_BEARER_TOKEN: required(source.OBJECT_STORE_BEARER_TOKEN, 'OBJECT_STORE_BEARER_TOKEN_MISSING'),
    SECRET_STORE_ENDPOINT: required(source.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING'),
    SECRET_STORE_BEARER_TOKEN: required(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_MISSING'),
    NODE_MANIFEST_PATH: required(source.NODE_MANIFEST_PATH, 'NODE_MANIFEST_PATH_MISSING'),
    NODE_MANIFEST_ID: required(source.NODE_MANIFEST_ID, 'NODE_MANIFEST_ID_MISSING'),
    NODE_MANIFEST_DIGEST: required(source.NODE_MANIFEST_DIGEST, 'NODE_MANIFEST_DIGEST_MISSING'),
    NODE_RUNTIME_INSTANCE_ID: required(source.NODE_RUNTIME_INSTANCE_ID, 'NODE_RUNTIME_INSTANCE_ID_MISSING'),
    NODE_RUNTIME_CONFIG_REF: required(source.NODE_RUNTIME_CONFIG_REF, 'NODE_RUNTIME_CONFIG_REF_MISSING'),
    NODE_RESOURCE_BINDING_VERSION: required(source.NODE_RESOURCE_BINDING_VERSION, 'NODE_RESOURCE_BINDING_VERSION_MISSING'),
    NODE_RELEASE_POINTER_REF: required(source.NODE_RELEASE_POINTER_REF, 'NODE_RELEASE_POINTER_REF_MISSING'),
  });
}

export async function createCatalogJobsRuntime(environment: CatalogJobsEnvironment): Promise<CatalogJobsRuntime> {
  const manifest = await loadNodeManifest(environment.NODE_MANIFEST_PATH, {
    manifestId: environment.NODE_MANIFEST_ID,
    manifestDigest: environment.NODE_MANIFEST_DIGEST,
    runtimeInstanceId: environment.NODE_RUNTIME_INSTANCE_ID,
    runtimeConfigRef: environment.NODE_RUNTIME_CONFIG_REF,
    resourceBindingVersion: environment.NODE_RESOURCE_BINDING_VERSION,
    releasePointerRef: environment.NODE_RELEASE_POINTER_REF,
  });
  if (manifest.node_profile !== 'operating_mall' || !nodeManifestHasFeature(manifest, 'catalog')) {
    throw new Error('CATALOG_JOBS_NODE_MANIFEST_INVALID');
  }
  if (environment.APP_ENV === 'production' && manifest.lifecycle_status !== 'active') throw new Error('CATALOG_JOBS_NODE_NOT_ACTIVE');
  const secrets = new WorkloadSecretStore(
    required(environment.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING'),
    required(environment.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_MISSING'),
  );
  const connection = await secrets.read(required(environment.DATABASE_JOB_CONNECTION_REF, 'DATABASE_JOB_CONNECTION_REF_MISSING'));
  const pool = createPool(connection, 'jobs');
  const objects = new HttpObjectStore(
    required(environment.OBJECT_STORE_ENDPOINT, 'OBJECT_STORE_ENDPOINT_MISSING'),
    required(environment.OBJECT_STORE_BEARER_TOKEN, 'OBJECT_STORE_BEARER_TOKEN_MISSING'),
  );
  try {
    await catalogJobsDependenciesReady(pool, objects, environment.DATABASE_JOB_ROLE);
    return Object.freeze({
      jobs: createCatalogJobs(pool, objects, required(environment.JOB_WORKER_ID, 'JOB_WORKER_ID_MISSING'), manifest.data_scope_ref.ref),
      manifest,
      close: () => pool.end(),
    });
  } catch (cause) {
    await pool.end().catch(() => undefined);
    throw cause;
  }
}

export function createCatalogJobs(pool: DatabasePool, objects: ObjectStore, worker: string, scope: string): readonly Job<void>[] {
  const configuration: JobRunnerConfig = Object.freeze({
    worker,
    owner: 'catalog',
    batch: 4,
    lease: 180,
    concurrency: 4,
    attempts: 8,
    poll: 1_000,
    deadline: 120_000,
    retryMinimum: 250,
    retryMaximum: 60_000,
    scope,
  });
  const exportConfiguration: JobRunnerConfig = Object.freeze({
    worker: `${worker}:export`,
    owner: 'reporting',
    batch: 2,
    lease: 180,
    concurrency: 2,
    attempts: 8,
    poll: 1_000,
    deadline: 120_000,
    retryMinimum: 250,
    retryMaximum: 60_000,
  });
  return Object.freeze([
    new QueueJob(
      'catalogimport',
      pool,
      configuration,
      new CatalogImportProcessor(pool, objects),
      undefined,
      new JobMetrics(commerceTelemetry()),
    ),
    new QueueJob(
      'catalogpublication',
      pool,
      configuration,
      new CatalogPublicationProcessor(pool),
      undefined,
      new JobMetrics(commerceTelemetry()),
    ),
    new QueueJob(
      'export',
      pool,
      exportConfiguration,
      new ExportJobRunner(pool, objects, exportConfiguration.attempts),
      undefined,
      new JobMetrics(commerceTelemetry()),
    ),
  ]);
}

export async function catalogJobsDependenciesReady(
  pool: DatabasePool,
  objects: ObjectStore,
  expectedRole = 'shopjob',
): Promise<Readonly<CompatibilityRow>> {
  const state = await catalogJobsRuntimeCompatibility(pool, expectedRole);
  await objects.find('catalog/readiness-probe');
  return state;
}

export async function catalogJobsRuntimeCompatibility(pool: DatabasePool, expectedRole = 'shopjob'): Promise<Readonly<CompatibilityRow>> {
  const result = await pool.query<CompatibilityRow>(`select current_user,session_user,
    not pg_is_in_recovery() writable,
    exists(select 1 from runtime.schemaversion where version=$1) schema,
    exists(select 1 from runtime.schemaversion where version=$2 and checksum=$3) contract,
    array_position(array[
      to_regclass('runtime.schemaversion'),to_regclass('runtime.job'),to_regclass('catalog.importjob'),
      to_regclass('catalog.importrow'),to_regclass('catalog.importerror'),to_regclass('catalog.category'),
      to_regclass('catalog.product'),to_regclass('catalog.sku'),to_regclass('catalog.listing'),
      to_regclass('pricing.pricebook'),to_regclass('pricing.price'),to_regclass('inventory.stockitem'),
      to_regclass('inventory.snapshot')
    ],null) is null relations,
    has_table_privilege(current_user,'runtime.job','SELECT')
      and has_table_privilege(current_user,'runtime.job','UPDATE')
      and has_table_privilege(current_user,'catalog.importjob','SELECT')
      and has_table_privilege(current_user,'catalog.importjob','UPDATE')
      and has_table_privilege(current_user,'catalog.importrow','SELECT')
      and has_table_privilege(current_user,'catalog.importrow','INSERT')
      and has_table_privilege(current_user,'catalog.importrow','DELETE')
      and has_table_privilege(current_user,'catalog.importerror','SELECT')
      and has_table_privilege(current_user,'catalog.importerror','INSERT')
      and has_table_privilege(current_user,'catalog.importerror','DELETE')
      and has_table_privilege(current_user,'catalog.category','SELECT')
      and has_table_privilege(current_user,'catalog.product','INSERT')
      and has_table_privilege(current_user,'catalog.sku','SELECT')
      and has_table_privilege(current_user,'catalog.sku','INSERT')
      and has_table_privilege(current_user,'catalog.listing','SELECT,INSERT,UPDATE')
      and has_table_privilege(current_user,'pricing.pricebook','SELECT')
      and has_table_privilege(current_user,'pricing.pricebook','INSERT')
      and has_table_privilege(current_user,'pricing.price','SELECT')
      and has_table_privilege(current_user,'pricing.price','INSERT')
      and has_table_privilege(current_user,'inventory.stockitem','SELECT')
      and has_table_privilege(current_user,'inventory.stockitem','INSERT')
      and has_table_privilege(current_user,'inventory.stockitem','UPDATE')
      and has_table_privilege(current_user,'inventory.snapshot','SELECT')
      and has_table_privilege(current_user,'inventory.snapshot','INSERT') writes`,
  [TARGET_SCHEMA_HEAD, CONTRACT_SCHEMA_HEAD, RUNTIME_CONTRACT_CHECKSUM]);
  const state = result.rows[0];
  if (!state || state.current_user !== expectedRole || state.session_user !== expectedRole
    || !state.writable || !state.schema || !state.relations || !state.writes) {
    throw new Error(`CATALOG_JOBS_RUNTIME_COMPATIBILITY_FAILED:${JSON.stringify(state ?? null)}`);
  }
  return Object.freeze(state);
}

function required(value: string | undefined, code: string): string {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}
