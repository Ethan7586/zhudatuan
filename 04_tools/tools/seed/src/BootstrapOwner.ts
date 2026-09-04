import { Client } from 'pg';

import { PasswordPolicy } from '../../../../01_core_hexin/services/commerce/src/modules/identity/domain/policy/PasswordPolicy';
import {
  ownerBootstrapDatabaseEnvironment,
  ownerBootstrapSecrets,
  ownerBootstrapSummary,
  ownerPasswordFingerprint,
  ownerSubjectHash,
} from './OwnerBootstrapPlan';

const environment = ownerBootstrapDatabaseEnvironment(process.env);
const database = new Client({
  connectionString: environment.connectionString,
  application_name: 'zhudatuan-owner-bootstrap-v1',
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,
});

await database.connect();
let state: 'created' | 'existing';
let identity: Readonly<{ principal: string; membership: string }>;
try {
  await database.query('begin isolation level serializable');
  await database.query("select pg_advisory_xact_lock(hashtext('zhudatuan:registration-bootstrap:v1'))");
  await database.query("select pg_advisory_xact_lock(hashtext('zhudatuan:platform-owner-transfer:v1'))");
  const boundary = await assertDatabaseBoundary(database, environment.expectedDatabase, environment.sentinel);
  if (boundary.state === 'active') {
    state = 'existing';
    identity = boundary.identity;
  } else {
    const secrets = ownerBootstrapSecrets(process.env);
    const [identityKey, password] = await Promise.all([
      readSecret(secrets.secretStoreEndpoint, secrets.secretStoreBearerToken, secrets.identityKeyRef, 32),
      readSecret(secrets.secretStoreEndpoint, secrets.secretStoreBearerToken, secrets.passwordRef, 12),
    ]);
    const secretHash = await new PasswordPolicy().hash(password);
    const result = await database.query<{ state: string }>(
      'select deployment.bootstrap_zhudatuan_owner($1,$2,$3,$4,$5) state',
      [environment.sentinel, ownerSubjectHash(identityKey), secretHash,
        ownerPasswordFingerprint(identityKey, password), environment.actor]
    );
    const returned = result.rows[0]?.state;
    if (returned !== 'created' && returned !== 'existing') throw new Error('OWNER_BOOTSTRAP_RESULT_INVALID');
    state = returned;
    const activeBoundary = await assertDatabaseBoundary(database, environment.expectedDatabase, environment.sentinel);
    if (activeBoundary.state !== 'active') throw new Error('OWNER_BOOTSTRAP_RESULT_INVALID');
    identity = activeBoundary.identity;
  }
  await database.query('commit');
} catch (cause) {
  await database.query('rollback').catch(() => undefined);
  throw cause;
} finally {
  await database.end();
}

process.stdout.write(`${ownerBootstrapSummary(state, identity)}\n`);

async function assertDatabaseBoundary(database: Client, expectedDatabase: string, sentinel: string): Promise<Readonly<{
  state: 'bootstrap_pending'; identity: null;
} | { state: 'active'; identity: Readonly<{ principal: string; membership: string }> }>> {
  const result = await database.query<{
    database_name: string;
    database_role: string;
    role_safe: boolean;
    state: string;
    active_owner_count: number;
    principal_id: string | null;
    membership_id: string | null;
    current_owner_valid: boolean;
    fixed_identity_collision: boolean;
  }>(`select current_database() database_name,current_user database_role,
    not exists(select 1 from pg_roles where rolname=current_user
      and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication or rolinherit)) role_safe,
    bootstrap.state,bootstrap.active_owner_count,bootstrap.principal_id,bootstrap.membership_id,
    bootstrap.current_owner_valid,bootstrap.fixed_identity_collision
    from deployment.zhudatuan_owner_bootstrap_state($1) bootstrap`, [sentinel]);
  const row = result.rows[0];
  if (result.rowCount !== 1 || !row || row.database_name !== expectedDatabase || row.database_role !== 'zhudatuanbootstrap'
    || row.role_safe !== true || row.fixed_identity_collision !== false
    || !['bootstrap_pending', 'active'].includes(row.state)) {
    throw new Error('OWNER_BOOTSTRAP_DATABASE_BOUNDARY_INVALID');
  }
  if (row.state === 'active') {
    if (row.active_owner_count !== 1 || row.current_owner_valid !== true
      || row.principal_id === null || row.membership_id === null) {
      throw new Error('OWNER_BOOTSTRAP_DATABASE_BOUNDARY_INVALID');
    }
    return { state: 'active', identity: { principal: row.principal_id, membership: row.membership_id } };
  }
  if (row.active_owner_count !== 0 || row.current_owner_valid !== false
    || row.principal_id !== null || row.membership_id !== null) {
    throw new Error('OWNER_BOOTSTRAP_DATABASE_BOUNDARY_INVALID');
  }
  return { state: 'bootstrap_pending', identity: null };
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
