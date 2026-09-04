import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import {
  SANDBOX_CATALOG_SCHEMA_CHECKSUM,
  SANDBOX_CATALOG_SCHEMA_VERSION,
  sandboxCatalogBootstrapEnvironment,
  sandboxCatalogBootstrapSummary,
} from './SandboxCatalogBootstrapPlan';

const environment = sandboxCatalogBootstrapEnvironment(process.env);
const source = await readFile(new URL('./SandboxCatalogDatabase.sql', import.meta.url), 'utf8');
const database = new Client({
  connectionString: environment.connectionString,
  application_name: 'zhudatuan-sandbox-catalog-bootstrap-v1',
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,
});

await database.connect();
try {
  await database.query('begin isolation level serializable');
  await database.query("select pg_advisory_xact_lock(hashtext('zhudatuan:sandbox-catalog:v1'))");
  await database.query("select pg_advisory_xact_lock(hashtextextended('audit:mall-zhudatuan',0))");
  await assertDatabaseBoundary(database, environment.expectedDatabase, environment.sentinel);
  await database.query(source);
  await database.query('commit');
} catch (cause) {
  await database.query('rollback').catch(() => undefined);
  throw cause;
} finally {
  await database.end();
}

process.stdout.write(`${sandboxCatalogBootstrapSummary()}\n`);

async function assertDatabaseBoundary(database: Client, expectedDatabase: string, sentinel: string): Promise<void> {
  const result = await database.query<{
    database_name: string;
    database_role: string;
    role_safe: boolean;
    sentinel_valid: boolean;
    schema_version: string | null;
    schema_checksum: string | null;
    active_malls: number;
  }>(`select current_database() database_name,current_user database_role,
    not exists(select 1 from pg_roles where rolname=current_user
      and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication or rolinherit)) role_safe,
    deployment.sandbox_catalog_bootstrap_boundary($2) sentinel_valid,
    (select version from runtime.schemaversion where version=$1 and checksum=$3) schema_version,
    (select checksum from runtime.schemaversion where version=$1 and checksum=$3) schema_checksum,
    (select count(*)::integer from organization.organization
      where id='mall-zhudatuan' and kind='mall' and status='active') active_malls`,
  [SANDBOX_CATALOG_SCHEMA_VERSION, sentinel, SANDBOX_CATALOG_SCHEMA_CHECKSUM]);
  const row = result.rows[0];
  if (!row || row.database_name !== expectedDatabase || row.database_role !== 'zhudatuansandboxbootstrap'
    || row.role_safe !== true || row.sentinel_valid !== true || row.schema_version !== SANDBOX_CATALOG_SCHEMA_VERSION
    || row.schema_checksum !== SANDBOX_CATALOG_SCHEMA_CHECKSUM
    || row.active_malls !== 1) {
    throw new Error('SANDBOX_CATALOG_DATABASE_BOUNDARY_INVALID');
  }
}
