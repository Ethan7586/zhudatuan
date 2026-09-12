import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { migrationEnvironment, processEnvironment } from '@shop/config/server';

import { KmsClient } from '../../../../01_core_hexin/services/commerce/src/foundation/infrastructure/KmsClient.ts';
import { MigrationRunner } from '../../../../01_core_hexin/services/commerce/src/foundation/infrastructure/MigrationRunner.ts';
import { WorkloadSecretStore } from '../../../../01_core_hexin/services/commerce/src/foundation/infrastructure/SecretStore.ts';
import { createPool } from '../../../../01_core_hexin/services/commerce/src/foundation/persistence/Pool.ts';

const MIGRATION_FILE = /^\d{14}_[a-z0-9_]+\.sql$/;
const sourceSha = process.env.AI_DELIVERY_SOURCE_SHA;
if (!/^[a-f0-9]{40}$/.test(sourceSha ?? '')) throw new Error('DATABASE_MIGRATION_SOURCE_SHA_INVALID');

const environment = migrationEnvironment(processEnvironment());
if (!/^[a-z0-9][a-z0-9/._:-]{7,511}$/i.test(environment.snapshotRef)) throw new Error('MIGRATION_SOURCE_SNAPSHOT_REF_INVALID');
const secrets = new WorkloadSecretStore(environment.secretStoreEndpoint, environment.secretStoreBearerToken);
const ownerExecution = process.env.DATABASE_MIGRATION_EXECUTION_MODE === 'database-owner';
const connection = ownerExecution ? ownerConnection(process.env) : await secrets.read(environment.databaseConnectionRef);
const pool = createPool(connection, 'migration');
const files = await migrationFiles(environment.directory);
const ledgerBefore = await ledgerEvidence(pool);
const appliedBefore = new Set(ledgerBefore.versions);
const selected = files.filter((file) => !appliedBefore.has(file.version));
const runner = new MigrationRunner(pool, new KmsClient(environment.kmsEndpoint, environment.kmsBearerToken), environment.directory, {
  distributorKeyRef: environment.distributorKeyRef,
  identityKeyRef: environment.identityKeyRef,
  partnerKeyRef: environment.partnerKeyRef,
  voucherKeyRef: environment.voucherKeyRef,
}, ownerExecution ? { kind: 'database-owner', role: required(process.env.POSTGRES_USER, 'MIGRATION_OWNER_ROLE_MISSING') } : undefined);

let result;
try {
  await runner.run();
  const ledgerAfter = await ledgerEvidence(pool);
  const appliedAfter = new Set(ledgerAfter.versions);
  const missing = selected.filter((file) => !appliedAfter.has(file.version));
  if (missing.length > 0) throw evidenceError('DATABASE_MIGRATION_LEDGER_INCOMPLETE', { missing });
  result = migrationResult(selected.length === 0 ? 'noop' : 'applied', ledgerBefore, ledgerAfter, selected);
} catch (error) {
  const ledgerAfter = await ledgerEvidence(pool).catch(() => null);
  result = migrationResult('failed', ledgerBefore, ledgerAfter, selected, error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

process.stdout.write(`${JSON.stringify(result)}\n`);

function ownerConnection(source) {
  const host = required(source.MIGRATION_OWNER_DATABASE_HOST, 'MIGRATION_OWNER_DATABASE_HOST_MISSING');
  if (host !== '127.0.0.1') throw new Error('MIGRATION_OWNER_DATABASE_HOST_INVALID');
  const port = required(source.MIGRATION_OWNER_DATABASE_PORT, 'MIGRATION_OWNER_DATABASE_PORT_MISSING');
  if (!/^\d{2,5}$/.test(port)) throw new Error('MIGRATION_OWNER_DATABASE_PORT_INVALID');
  const user = required(source.POSTGRES_USER, 'MIGRATION_OWNER_ROLE_MISSING');
  const password = required(source.POSTGRES_PASSWORD, 'MIGRATION_OWNER_PASSWORD_MISSING');
  const database = required(source.POSTGRES_DB, 'MIGRATION_OWNER_DATABASE_MISSING');
  if (!/^[a-z][a-z0-9_]{2,62}$/.test(user) || !/^[a-z][a-z0-9_]{2,62}$/.test(database)) {
    throw new Error('MIGRATION_OWNER_IDENTITY_INVALID');
  }
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
}

function required(value, code) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(code);
  return value;
}

async function migrationFiles(directory) {
  const names = (await readdir(directory)).filter((name) => MIGRATION_FILE.test(name)).sort();
  return Promise.all(names.map(async (file) => ({
    file,
    version: file.slice(0, 14),
    sha256: createHash('sha256').update(await readFile(join(directory, file))).digest('hex'),
  })));
}

async function ledgerEvidence(database) {
  const client = await database.connect();
  try {
    const existence = await client.query("select to_regclass('supabase_migrations.schema_migrations') is not null as exists");
    const exists = existence.rows[0]?.exists === true;
    const records = exists
      ? (await client.query('select version,name,statements from supabase_migrations.schema_migrations order by version')).rows
        .map((row) => ({ version: row.version, name: row.name, statements: row.statements ?? [] }))
      : [];
    return {
      exists,
      count: records.length,
      head: records.at(-1)?.version ?? null,
      sha256: createHash('sha256').update(JSON.stringify(records)).digest('hex'),
      versions: records.map((record) => record.version),
    };
  } finally {
    client.release();
  }
}

function migrationResult(status, ledgerBefore, ledgerAfter, selected, error = null) {
  return {
    schema: 'ai.delivery.database-migration-result.v1',
    sourceSha,
    status,
    selected,
    selectionStatus: 'determined',
    ledgerBefore: ledgerSummary(ledgerBefore),
    ledgerAfter: ledgerAfter === null ? null : ledgerSummary(ledgerAfter),
    applied: ledgerAfter === null ? [] : selected.filter((file) => ledgerAfter.versions.includes(file.version)),
    error: error === null ? null : { code: error.code ?? error.message ?? 'DATABASE_MIGRATION_FAILED', message: error.message ?? String(error) },
  };
}

function ledgerSummary({ versions: _versions, ...summary }) {
  return summary;
}

function evidenceError(code, details) {
  const error = new Error(code);
  error.code = code;
  error.details = details;
  return error;
}
