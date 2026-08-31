import { Client } from 'pg';
import { SANDBOX_WELFARE_SCHEMA_CHECKSUM, SANDBOX_WELFARE_SCHEMA_VERSION, sandboxWelfareBootstrapEnvironment, sandboxWelfareBootstrapSummary } from './SandboxWelfareBootstrapPlan';

const environment = sandboxWelfareBootstrapEnvironment(process.env);
const database = new Client({
  connectionString: environment.connectionString,
  application_name: 'zhudatuan-sandbox-member-welfare-bootstrap-v1',
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,
});

await database.connect();
try {
  await database.query('begin isolation level serializable');
  await database.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`sandbox-welfare:${environment.membership}`]);
  await assertDatabaseBoundary(database);
  const result = await database.query<{ welfare: Readonly<Record<string, unknown>> }>('select deployment.sandbox_member_welfare_bootstrap($1,$2,$3,$4,$5) welfare', [
    environment.sentinel,
    environment.membership,
    environment.amountMinor,
    environment.currency,
    environment.confirmation,
  ]);
  const welfare = result.rows[0]?.welfare;
  if (
    !welfare ||
    welfare.membership !== environment.membership ||
    welfare.scope !== 'mall-zhudatuan' ||
    welfare.amountMinor !== environment.amountMinor ||
    welfare.currency !== 'CNY' ||
    welfare.sandboxOnly !== true ||
    typeof welfare.account !== 'string' ||
    typeof welfare.batch !== 'string'
  ) {
    throw new Error('SANDBOX_WELFARE_RESULT_INVALID');
  }
  await database.query('commit');
} catch (cause) {
  await database.query('rollback').catch(() => undefined);
  throw cause;
} finally {
  await database.end();
}

process.stdout.write(`${sandboxWelfareBootstrapSummary(environment.membership, environment.amountMinor)}\n`);

async function assertDatabaseBoundary(database: Client): Promise<void> {
  const result = await database.query<{
    database_name: string;
    database_role: string;
    role_safe: boolean;
    sentinel_valid: boolean;
    schema_version: string | null;
    schema_checksum: string | null;
    function_allowed: boolean;
    benefit_usage: boolean;
    finance_usage: boolean;
  }>(
    `select current_database() database_name,current_user database_role,
    not exists(select 1 from pg_roles where rolname=current_user
      and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication or rolinherit)) role_safe,
    deployment.sandbox_catalog_bootstrap_boundary($2) sentinel_valid,
    (select version from runtime.schemaversion where version=$1 and checksum=$3) schema_version,
    (select checksum from runtime.schemaversion where version=$1 and checksum=$3) schema_checksum,
    has_function_privilege(current_user,'deployment.sandbox_member_welfare_bootstrap(text,text,bigint,text,text)','EXECUTE') function_allowed,
    has_schema_privilege(current_user,'benefit','USAGE') benefit_usage,
    has_schema_privilege(current_user,'finance','USAGE') finance_usage`,
    [SANDBOX_WELFARE_SCHEMA_VERSION, environment.sentinel, SANDBOX_WELFARE_SCHEMA_CHECKSUM]
  );
  const row = result.rows[0];
  if (
    !row ||
    row.database_name !== environment.expectedDatabase ||
    row.database_role !== 'zhudatuansandboxbootstrap' ||
    row.role_safe !== true ||
    row.sentinel_valid !== true ||
    row.schema_version !== SANDBOX_WELFARE_SCHEMA_VERSION ||
    row.schema_checksum !== SANDBOX_WELFARE_SCHEMA_CHECKSUM ||
    row.function_allowed !== true ||
    row.benefit_usage !== false ||
    row.finance_usage !== false
  ) {
    throw new Error('SANDBOX_WELFARE_DATABASE_BOUNDARY_INVALID');
  }
}
