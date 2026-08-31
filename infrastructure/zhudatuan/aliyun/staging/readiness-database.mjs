import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { FULL_ROOT, canonical, digest, matchEvidence } from './readiness-common.mjs';

const RETIRED_ROLES = Object.freeze([
  'shopapp',
  'shopmigration',
  'shopread',
  'zhudatuanbootstrap',
  'zhudatuanpurchaseapi',
  'zhudatuansandboxbootstrap',
  'zhudatuanwebapi',
]);
const RUNTIME_ROLES = Object.freeze(['shopjob', 'zhudatuanidentityapi', 'zhudatuanidentityjob']);
const BOUNDARY_ROLES = Object.freeze(['anon', 'authenticated', 'service_role', 'zhudatuanregistrationboundary']);
const EXPECTED_ROLES = Object.freeze([...RETIRED_ROLES, ...RUNTIME_ROLES, ...BOUNDARY_ROLES]);

export async function verifyLiveDatabaseRetirement(evidence, observed) {
  const missing = [];
  let client;
  try {
    const catalog = JSON.parse(await readFile(`${FULL_ROOT}/shared/full-secrets.json`, 'utf8'));
    const connectionString = catalog['zhudatuan/staging/full/database/identity-api'];
    assertLoopbackRuntimeDsn(connectionString);
    client = new Client({ connectionString, application_name: 'zhudatuan-staging-readiness',
      connectionTimeoutMillis: 5_000, query_timeout: 5_000, statement_timeout: 5_000 });
    await client.connect();
    const roles = (await client.query(`select rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,
      rolinherit,rolreplication,rolbypassrls from pg_roles where rolname=any($1::text[]) order by rolname`,
    [EXPECTED_ROLES])).rows;
    const roleByName = new Map(roles.map((role) => [role.rolname, role]));
    const unsafeFlags = (role) => role.rolsuper || role.rolcreatedb || role.rolcreaterole
      || role.rolinherit || role.rolreplication || role.rolbypassrls;
    const retiredInvalid = RETIRED_ROLES.some((name) => {
      const role = roleByName.get(name);
      return !role || role.rolcanlogin || unsafeFlags(role);
    });
    const runtimeInvalid = RUNTIME_ROLES.some((name) => {
      const role = roleByName.get(name);
      return !role || !role.rolcanlogin || unsafeFlags(role);
    });
    const boundaryInvalid = BOUNDARY_ROLES.some((name) => {
      const role = roleByName.get(name);
      return !role || role.rolcanlogin || unsafeFlags(role);
    });
    if (roles.length !== EXPECTED_ROLES.length || retiredInvalid || runtimeInvalid || boundaryInvalid) {
      missing.push('live:database:role-matrix-invalid');
    }
    const memberships = (await client.query(`select granted.rolname granted_role,member.rolname member_role
      from pg_auth_members membership join pg_roles granted on granted.oid=membership.roleid
      join pg_roles member on member.oid=membership.member
      where granted.rolname=any($1::text[]) or member.rolname=any($1::text[])
      order by granted.rolname,member.rolname`, [RETIRED_ROLES])).rows;
    if (memberships.length !== 0) missing.push('live:database:retired-membership-active');
    const privileges = (await client.query(`select
      has_schema_privilege('zhudatuanbootstrap','identity','USAGE') bootstrap_identity,
      has_schema_privilege('zhudatuanbootstrap','access','USAGE') bootstrap_access,
      has_schema_privilege('zhudatuanbootstrap','deployment','USAGE') bootstrap_deployment,
      has_function_privilege('zhudatuanbootstrap','deployment.registration_bootstrap_boundary(text)','EXECUTE') bootstrap_function,
      has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') migration_bootstrap_function,
      has_function_privilege('shopmigration','deployment.is_independent_registration_database()','EXECUTE') migration_boundary_function`)).rows[0];
    if (Object.values(privileges).some(Boolean)) missing.push('live:database:one-shot-privilege-active');
    const runtimeAcl = (await client.query(`select
      has_function_privilege('shopjob','deployment.runtime_database_boundary()','EXECUTE') shopjob,
      has_function_privilege('zhudatuanidentityapi','deployment.runtime_database_boundary()','EXECUTE') identity_api,
      has_function_privilege('zhudatuanidentityjob','deployment.runtime_database_boundary()','EXECUTE') identity_jobs,
      has_function_privilege('shopmigration','deployment.runtime_database_boundary()','EXECUTE') retired_migration,
      has_function_privilege('zhudatuanbootstrap','deployment.runtime_database_boundary()','EXECUTE') retired_bootstrap,
      has_function_privilege('anon','deployment.runtime_database_boundary()','EXECUTE') compatibility_anon`)).rows[0];
    if (!runtimeAcl.shopjob || !runtimeAcl.identity_api || !runtimeAcl.identity_jobs
      || runtimeAcl.retired_migration || runtimeAcl.retired_bootstrap || runtimeAcl.compatibility_anon) {
      missing.push('live:database:runtime-boundary-acl');
    }
    const owners = (await client.query(`select
      (select pg_get_userbyid(datdba) from pg_database where datname=current_database()) database_owner,
      (select pg_get_userbyid(proowner) from pg_proc where oid='deployment.registration_bootstrap_boundary(text)'::regprocedure) bootstrap_function_owner,
      (select pg_get_userbyid(proowner) from pg_proc where oid='deployment.is_independent_registration_database()'::regprocedure) migration_function_owner,
      (select pg_get_userbyid(proowner) from pg_proc where oid='deployment.runtime_database_boundary()'::regprocedure) runtime_function_owner`)).rows[0];
    if (owners.database_owner !== 'shopmigration' || owners.bootstrap_function_owner !== 'zhudatuanregistrationboundary'
      || owners.migration_function_owner !== 'zhudatuanregistrationboundary'
      || owners.runtime_function_owner !== 'zhudatuanregistrationboundary') {
      missing.push('live:database:one-shot-owner-boundary');
    }
    matchEvidence(evidence, 'database.roleMatrixSha256', digest(canonical({ roles, memberships, privileges, runtimeAcl, owners })),
      missing, observed);
  } catch {
    missing.push('live:database:one-shot-retirement');
  } finally {
    await client?.end().catch(() => undefined);
  }
  return missing;
}

function assertLoopbackRuntimeDsn(value) {
  const connection = new URL(value);
  if (connection.protocol !== 'postgresql:' || connection.hostname !== '127.0.0.1' || connection.port !== '55442'
    || connection.username !== 'zhudatuanidentityapi' || connection.pathname !== '/zhudatuan_registration'
    || connection.hash || connection.search !== '?sslmode=disable') throw new Error('DATABASE_RUNTIME_BOUNDARY_INVALID');
}
