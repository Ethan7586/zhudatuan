import { CONTRACT_SCHEMA_HEAD, RUNTIME_CONTRACT_CHECKSUM, TARGET_SCHEMA_HEAD } from '@shop/config/server';
import type { Job } from '../foundation/application/Job';
import type { JobRunnerConfig } from '../foundation/application/JobRunner';
import { HttpObjectStore, type ObjectStore } from '../foundation/infrastructure/ObjectStore';
import { QueueJob } from '../foundation/infrastructure/QueueJob';
import { WorkloadSecretStore } from '../foundation/infrastructure/SecretStore';
import { createPool, type DatabasePool } from '../foundation/persistence/Pool';
import { JobMetrics } from '../foundation/telemetry/JobMetrics';
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import { CatalogImportProcessor } from '../modules/catalog/05_interface_jieru/job/CatalogImportJob';

export interface CatalogJobsEnvironment {
  readonly DATABASE_JOB_CONNECTION_REF: string;
  readonly JOB_WORKER_ID: string;
  readonly OBJECT_STORE_ENDPOINT: string;
  readonly OBJECT_STORE_BEARER_TOKEN: string;
  readonly SECRET_STORE_ENDPOINT: string;
  readonly SECRET_STORE_BEARER_TOKEN: string;
}

interface CompatibilityRow {
  readonly current_user: string;
  readonly session_user: string;
  readonly writable: boolean;
  readonly schema: boolean;
  readonly contract: boolean;
  readonly relations: boolean;
  readonly functions: boolean;
  readonly writes: boolean;
}

export interface CatalogJobsRuntime {
  readonly jobs: readonly Job<void>[];
  close(): Promise<void>;
}

export function catalogJobsEnvironment(source: NodeJS.ProcessEnv = process.env): CatalogJobsEnvironment {
  return Object.freeze({
    DATABASE_JOB_CONNECTION_REF: required(source.DATABASE_JOB_CONNECTION_REF, 'DATABASE_JOB_CONNECTION_REF_MISSING'),
    JOB_WORKER_ID: required(source.JOB_WORKER_ID, 'JOB_WORKER_ID_MISSING'),
    OBJECT_STORE_ENDPOINT: required(source.OBJECT_STORE_ENDPOINT, 'OBJECT_STORE_ENDPOINT_MISSING'),
    OBJECT_STORE_BEARER_TOKEN: required(source.OBJECT_STORE_BEARER_TOKEN, 'OBJECT_STORE_BEARER_TOKEN_MISSING'),
    SECRET_STORE_ENDPOINT: required(source.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING'),
    SECRET_STORE_BEARER_TOKEN: required(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_MISSING'),
  });
}

export async function createCatalogJobsRuntime(environment: CatalogJobsEnvironment): Promise<CatalogJobsRuntime> {
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
    await catalogJobsDependenciesReady(pool, objects);
    return Object.freeze({
      jobs: createCatalogJobs(pool, objects, required(environment.JOB_WORKER_ID, 'JOB_WORKER_ID_MISSING')),
      close: () => pool.end(),
    });
  } catch (cause) {
    await pool.end().catch(() => undefined);
    throw cause;
  }
}

export function createCatalogJobs(pool: DatabasePool, objects: ObjectStore, worker: string): readonly Job<void>[] {
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
  ]);
}

export async function catalogJobsDependenciesReady(
  pool: DatabasePool,
  objects: ObjectStore,
): Promise<Readonly<CompatibilityRow>> {
  const state = await catalogJobsRuntimeCompatibility(pool);
  await objects.find('catalog/readiness-probe');
  return state;
}

export async function catalogJobsRuntimeCompatibility(pool: DatabasePool): Promise<Readonly<CompatibilityRow>> {
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
    to_regprocedure('runtime.claim_job(text,text,integer,integer)') is not null
      and has_function_privilege(current_user,'runtime.claim_job(text,text,integer,integer)','EXECUTE') functions,
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
      and has_table_privilege(current_user,'catalog.listing','INSERT')
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
  if (!state || state.current_user !== 'shopjob' || state.session_user !== 'shopjob'
    || !state.writable || !state.schema || !state.contract || !state.relations || !state.functions || !state.writes) {
    throw new Error(`CATALOG_JOBS_RUNTIME_COMPATIBILITY_FAILED:${JSON.stringify(state ?? null)}`);
  }
  return Object.freeze(state);
}

function required(value: string | undefined, code: string): string {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}
