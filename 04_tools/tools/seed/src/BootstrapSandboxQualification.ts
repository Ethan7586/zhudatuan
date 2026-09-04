import { Client } from 'pg';
import {
  SANDBOX_QUALIFICATION_SCHEMA_CHECKSUM,
  SANDBOX_QUALIFICATION_SCHEMA_VERSION,
  sandboxQualificationBootstrapEnvironment,
  sandboxQualificationBootstrapSummary,
} from './SandboxQualificationBootstrapPlan';

const environment = sandboxQualificationBootstrapEnvironment(process.env);
const database = new Client({
  connectionString: environment.connectionString,
  application_name: 'zhudatuan-sandbox-member-qualification-bootstrap-v1',
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,
});

await database.connect();
try {
  await database.query('begin isolation level serializable');
  await database.query("select pg_advisory_xact_lock(hashtext('zhudatuan:sandbox-member-qualification:v1'))");
  await database.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`sandbox-qualification:${environment.membership}`]);
  await assertDatabaseBoundary(database);
  const result = await database.query<{ qualification: Readonly<Record<string, unknown>> }>(
    'select deployment.sandbox_member_qualification_bootstrap($1,$2) qualification',
    [environment.sentinel, environment.membership],
  );
  const qualification = result.rows[0]?.qualification;
  if (!qualification || qualification.membership !== environment.membership || qualification.status !== 'active'
    || qualification.scope !== 'mall-zhudatuan' || qualification.benefitAmountGranted !== false) {
    throw new Error('SANDBOX_QUALIFICATION_RESULT_INVALID');
  }
  await database.query('commit');
} catch (cause) {
  await database.query('rollback').catch(() => undefined);
  throw cause;
} finally {
  await database.end();
}

process.stdout.write(`${sandboxQualificationBootstrapSummary(environment.membership)}\n`);

async function assertDatabaseBoundary(database: Client): Promise<void> {
  const result = await database.query<{
    database_name: string; database_role: string; role_safe: boolean; sentinel_valid: boolean;
    schema_version: string | null; schema_checksum: string | null;
  }>(`select current_database() database_name,current_user database_role,
    not exists(select 1 from pg_roles where rolname=current_user
      and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication or rolinherit)) role_safe,
    deployment.sandbox_catalog_bootstrap_boundary($2) sentinel_valid,
    (select version from runtime.schemaversion where version=$1 and checksum=$3) schema_version,
    (select checksum from runtime.schemaversion where version=$1 and checksum=$3) schema_checksum`,
  [SANDBOX_QUALIFICATION_SCHEMA_VERSION, environment.sentinel, SANDBOX_QUALIFICATION_SCHEMA_CHECKSUM]);
  const row = result.rows[0];
  if (!row || row.database_name !== environment.expectedDatabase || row.database_role !== 'zhudatuansandboxbootstrap'
    || row.role_safe !== true || row.sentinel_valid !== true || row.schema_version !== SANDBOX_QUALIFICATION_SCHEMA_VERSION
    || row.schema_checksum !== SANDBOX_QUALIFICATION_SCHEMA_CHECKSUM) {
    throw new Error('SANDBOX_QUALIFICATION_DATABASE_BOUNDARY_INVALID');
  }
}
