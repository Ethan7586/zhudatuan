import { Client } from 'pg';

import { PasswordPolicy } from '../../../services/commerce/src/modules/identity/domain/policy/PasswordPolicy';
import {
  OWNER_MEMBERSHIP_ID,
  OWNER_PRINCIPAL_ID,
  ownerBootstrapEnvironment,
  ownerBootstrapSummary,
  ownerPasswordFingerprint,
  ownerSubjectHash,
} from './OwnerBootstrapPlan';

const environment = ownerBootstrapEnvironment(process.env);
const [identityKey, password] = await Promise.all([
  readSecret(environment.secretStoreEndpoint, environment.secretStoreBearerToken, environment.identityKeyRef, 32),
  readSecret(environment.secretStoreEndpoint, environment.secretStoreBearerToken, environment.passwordRef, 12),
]);
const passwordPolicy = new PasswordPolicy();
const secretHash = await passwordPolicy.hash(password);
const subjectHash = ownerSubjectHash(identityKey);
const passwordFingerprint = ownerPasswordFingerprint(identityKey, password);
const database = new Client({
  connectionString: environment.connectionString,
  application_name: 'zhudatuan-owner-bootstrap-v1',
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,
});

await database.connect();
let state: 'created' | 'existing';
try {
  await database.query('begin isolation level serializable');
  await database.query("select pg_advisory_xact_lock(hashtext('zhudatuan:registration-bootstrap:v1'))");
  await assertDatabaseBoundary(database, environment.expectedDatabase, environment.sentinel);
  const result = await database.query<{ state: string }>(
    'select deployment.bootstrap_zhudatuan_owner($1,$2,$3,$4,$5) state',
    [environment.sentinel, subjectHash, secretHash, passwordFingerprint, environment.actor]
  );
  const returned = result.rows[0]?.state;
  if (returned !== 'created' && returned !== 'existing') throw new Error('OWNER_BOOTSTRAP_RESULT_INVALID');
  state = returned;
  await database.query('commit');
} catch (cause) {
  await database.query('rollback').catch(() => undefined);
  throw cause;
} finally {
  await database.end();
}

process.stdout.write(`${ownerBootstrapSummary(state)}\n`);

async function assertDatabaseBoundary(database: Client, expectedDatabase: string, sentinel: string): Promise<void> {
  const result = await database.query<{
    database_name: string;
    database_role: string;
    role_safe: boolean;
    sentinel_valid: boolean;
    baseline_valid: boolean;
    owner_role_valid: boolean;
    self_role_valid: boolean;
    fixed_identity_absent_or_owned: boolean;
  }>(`select current_database() database_name,current_user database_role,
    not exists(select 1 from pg_roles where rolname=current_user
      and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication or rolinherit)) role_safe,
    deployment.registration_bootstrap_boundary($1) sentinel_valid,
    exists(select 1 from runtime.schemaversion where version='20260828170000') baseline_valid,
    exists(select 1 from access.role where id='role-platform-owner-v2' and scope_id='tenant-zhudatuan' and status='active') owner_role_valid,
    exists(select 1 from access.role where id='role:self' and scope_id='self' and status='active') self_role_valid,
    not exists(select 1 from identity.principal where id=$2 and status<>'active')
      and not exists(select 1 from access.membership where id=$3 and (client<>'operator' or status<>'active')) fixed_identity_absent_or_owned`,
  [sentinel, OWNER_PRINCIPAL_ID, OWNER_MEMBERSHIP_ID]);
  const row = result.rows[0];
  if (!row || row.database_name !== expectedDatabase || row.database_role !== 'zhudatuanbootstrap'
    || row.role_safe !== true || row.sentinel_valid !== true || row.baseline_valid !== true
    || row.owner_role_valid !== true || row.self_role_valid !== true || row.fixed_identity_absent_or_owned !== true) {
    throw new Error('OWNER_BOOTSTRAP_DATABASE_BOUNDARY_INVALID');
  }
}

async function readSecret(endpoint: string, bearerToken: string, reference: string, minimumLength: number): Promise<string> {
  const response = await fetch(`${endpoint}/v1/secrets/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: { accept: 'application/json', authorization: `Bearer ${bearerToken}` },
    redirect: 'error',
    signal: AbortSignal.timeout(5_000),
  });
  if (response.status !== 200) throw new Error(`OWNER_BOOTSTRAP_SECRET_READ_FAILED:${response.status}`);
  const body: unknown = await response.json();
  const value = body !== null && typeof body === 'object' && !Array.isArray(body) ? Reflect.get(body, 'value') : undefined;
  if (typeof value !== 'string' || value.length < minimumLength || value.length > 4096) {
    throw new Error('OWNER_BOOTSTRAP_SECRET_VALUE_INVALID');
  }
  return value;
}
