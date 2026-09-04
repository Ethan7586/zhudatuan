import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { Client } from 'pg';
import { repositoryRoot } from '../../scripts/lib/RepositoryRoot.mjs';
import { emitEvidence, loadYaml, requestId } from './Evidence.mjs';
import { compareMigrationEvidence, contentHash, evidenceSchema } from './MigrationEvidence.mjs';

const root = repositoryRoot;
const argumentsList = process.argv.slice(2);
const option = (name) => {
  const index = argumentsList.indexOf(name);
  return index < 0 ? undefined : argumentsList[index + 1];
};
const phase = option('--phase');
const connectionString = option('--url') ?? process.env.DATABASE_URL;
const archiveArgument = option('--archive');
const beforeArgument = option('--before');
const approvalArgument = option('--approvals');
const secretProofArgument = option('--secret-proof');
const durationMs = integerOption('--duration-ms', phase === 'before' ? 0 : undefined);
const observedLockWaitMs = integerOption('--max-lock-wait-ms', phase === 'before' ? 0 : undefined);
if (!['before', 'after'].includes(phase)) throw new Error('MIGRATION_EVIDENCE_PHASE_REQUIRED');
if (!connectionString || !/^postgres(?:ql)?:\/\//.test(connectionString)) throw new Error('MIGRATION_EVIDENCE_URL_REQUIRED');
if (!archiveArgument) throw new Error('MIGRATION_EVIDENCE_ARCHIVE_REQUIRED');
if (phase === 'after' && !beforeArgument) throw new Error('MIGRATION_EVIDENCE_BEFORE_REQUIRED');

const ideal = await loadYaml(join(root, 'database', 'contracts', 'ideal.yml'));
const archivePath = archiveFile(archiveArgument, ideal.migrationEvidence.archiveRoot);
const before = beforeArgument ? JSON.parse(await readFile(resolveInput(beforeArgument), 'utf8')) : undefined;
const approvals = approvalArgument ? JSON.parse(await readFile(resolveInput(approvalArgument), 'utf8')) : [];
const secretProof = secretProofArgument ? JSON.parse(await readFile(resolveInput(secretProofArgument), 'utf8')) : undefined;
if (process.env.SHOP_RELEASE_MODE === 'production' && ideal.migrationEvidence.productionSecretProofRequired && !secretProof) {
  throw new Error('MIGRATION_EVIDENCE_SECRET_PROOF_REQUIRED');
}

const startedAt = performance.now();
const client = new Client({ connectionString, connectionTimeoutMillis: 5_000, statement_timeout: ideal.migrationPlanning.statementTimeoutMs });
let evidence;
try {
  await client.connect();
  evidence = await capture(client, phase, ideal, secretProof, durationMs, observedLockWaitMs, before?.sampleSeed ?? randomUUID());
} finally {
  await client.end();
}
let comparison;
if (phase === 'after') {
  comparison = compareMigrationEvidence(before, evidence, approvals, {
    schemaHead: ideal.schemaHead.migrationHead,
    maximumLockWaitMs: ideal.migrationEvidence.maximumLockWaitMs,
    maximumDurationMs: ideal.migrationEvidence.maximumDurationMs,
  });
  evidence.comparison = comparison;
}
evidence.captureDurationMs = Math.round(performance.now() - startedAt);
evidence.contentSha256 = contentHash(evidence);
await mkdir(dirname(archivePath), { recursive: true });
await writeFile(archivePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
emitEvidence({
  status: comparison?.passed === false ? 'failed' : phase === 'after' ? 'passed' : 'captured',
  requestId: evidence.requestId,
  phase,
  schemaHead: evidence.schemaHead.migrationHead,
  exact: comparison?.exact ?? null,
  approvedDifferences: comparison?.approvals ?? 0,
  archive: relative(root, archivePath),
  contentSha256: evidence.contentSha256,
  secretValuesEmitted: false,
});

async function capture(database, capturePhase, contract, secretProof, migrationDurationMs, maximumLockWaitMs, sampleSeed) {
  await database.query('begin isolation level repeatable read read only');
  let snapshot;
  try {
    const tables = await ownedTables(database);
    const columns = await ownedColumns(database, tables);
    const schemaHead = (await database.query(`select contract_version "contractVersion",migration_head "migrationHead",checksum,
      migration_count "migrationCount",published_at "publishedAt" from runtime.schemahead where artifact='commerce'`)).rows[0];
    if (!schemaHead) throw new Error('MIGRATION_EVIDENCE_SCHEMA_HEAD_MISSING');
    const [tableCounts, distributions, amountsMinor, inventory, voucher, sampleHashes, invariants, checkpoints, currentLockWait] = await Promise.all([
      collectTableCounts(database, tables),
      collectDistributions(database, tables, columns),
      collectAmounts(database, tables, columns),
      one(database, `select count(*)::integer "stockItems",coalesce(sum(onhand),0)::bigint onhand,
        coalesce(sum(safety),0)::bigint safety,(select coalesce(sum(quantity),0)::bigint from inventory.reservation
          where state='reserved' and expires_at>clock_timestamp()) reserved,
        coalesce(sum(onhand-safety),0)::bigint "grossAvailable" from inventory.stockitem`),
      one(database, `select count(*)::integer vouchers,coalesce(sum(initial_minor),0)::bigint "initialMinor",
        coalesce(sum(remaining_minor),0)::bigint "remainingMinor",(select count(*)::integer from voucher.tenderhold where state='active') "activeHolds",
        (select coalesce(sum(amount_minor),0)::bigint from voucher.tenderhold where state='active') "heldMinor",
        (select coalesce(sum(amount_minor-refunded_minor),0)::bigint from voucher.redemption) "netRedeemedMinor" from voucher.voucher`),
      collectSampleHashes(database, contract.migrationEvidence.sampleTables, contract.migrationEvidence.sampleSize, sampleSeed),
      collectInvariants(database, columns, secretProof),
      collectCheckpoints(database),
      one(database, `select coalesce(max(extract(epoch from(clock_timestamp()-query_start))*1000)
        filter(where wait_event_type='Lock'),0)::bigint "currentLockWaitMs" from pg_stat_activity`),
    ]);
    snapshot = {
      schema: evidenceSchema,
      requestId: requestId(),
      phase: capturePhase,
      sampleSeed,
      capturedAt: new Date().toISOString(),
      schemaHead,
      durationMs: migrationDurationMs,
      maximumLockWaitMs: Math.max(maximumLockWaitMs, Number(currentLockWait.currentLockWaitMs)),
      metrics: { tableCounts, distributions, amountsMinor, inventory, voucher, sampleHashes },
      invariants,
      checkpoints,
      secretProof: secretProof ? { method: 'kms-batch-proof', checkedCount: secretProof.checkedCount, evidenceSha256: secretProof.evidenceSha256 } : { method: 'envelope-shape', checkedCount: invariants.secretEnvelopeCount },
      connectionDetailsEmitted: false,
      secretValuesEmitted: false,
    };
    await database.query('rollback');
  } catch (error) {
    await database.query('rollback');
    throw error;
  }
  snapshot.invariants.rls = await verifyRls(database);
  return snapshot;
}

async function ownedTables(database) {
  return (await database.query(`select namespace.nspname schema_name,relation.relname table_name
    from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname in(select schema_name from runtime.moduleauthority union all select 'invoice')
      and relation.relkind in('r','p') and not relation.relispartition order by 1,2`)).rows;
}

async function ownedColumns(database, tables) {
  const names = tables.map(({ schema_name, table_name }) => `${schema_name}.${table_name}`);
  const result = await database.query(`select table_schema schema_name,table_name,column_name,data_type
    from information_schema.columns where table_schema||'.'||table_name=any($1::text[]) order by 1,2,ordinal_position`, [names]);
  return result.rows;
}

async function collectTableCounts(database, tables) {
  const rows = await unions(database, tables.map(({ schema_name, table_name }) =>
    `select '${schema_name}.${table_name}' key,count(*)::text value from ${quote(schema_name)}.${quote(table_name)}`));
  return Object.fromEntries(rows.map(({ key, value }) => [key, Number(value)]));
}

async function collectDistributions(database, tables, columns) {
  const available = new Map();
  for (const column of columns) available.set(`${column.schema_name}.${column.table_name}.${column.column_name}`, true);
  const queries = [];
  for (const { schema_name, table_name } of tables) {
    const prefix = `${schema_name}.${table_name}`;
    const scope = available.has(`${prefix}.scope_id`) ? 'scope_id::text' : available.has(`${prefix}.tenant_id`) ? 'tenant_id::text' : null;
    const state = available.has(`${prefix}.state`) ? 'state::text' : available.has(`${prefix}.status`) ? 'status::text' : null;
    if (!scope && !state) continue;
    queries.push(`select '${prefix}' table_name,coalesce(${scope ?? "''"},'') scope,coalesce(${state ?? "''"},'') state,count(*)::bigint count
      from ${quote(schema_name)}.${quote(table_name)} group by 1,2,3`);
  }
  return (await unions(database, queries)).map(({ table_name, scope, state, count }) => ({ table: table_name, scope, state, count: Number(count) }));
}

async function collectAmounts(database, tables, columns) {
  const tableSet = new Set(tables.map(({ schema_name, table_name }) => `${schema_name}.${table_name}`));
  const queries = columns.filter(({ schema_name, table_name, column_name, data_type }) => tableSet.has(`${schema_name}.${table_name}`)
    && /^(?:bigint|integer|numeric)$/.test(data_type) && /_minor$/.test(column_name))
    .map(({ schema_name, table_name, column_name }) => `select '${schema_name}.${table_name}.${column_name}' key,
      coalesce(sum(${quote(column_name)}),0)::text value from ${quote(schema_name)}.${quote(table_name)}`);
  return Object.fromEntries((await unions(database, queries)).map(({ key, value }) => [key, value]));
}

async function collectSampleHashes(database, tables, size, seed) {
  const output = {};
  for (const table of tables) {
    if (!/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(table)) throw new Error('MIGRATION_EVIDENCE_SAMPLE_TABLE_INVALID');
    const [schema, name] = table.split('.');
    const value = await one(database, `select count(*)::integer count,encode(public.digest(coalesce(string_agg(row_hash,'' order by selector),''),'sha256'),'hex') hash
      from(select md5(row_to_json(value)::text||$1) selector,encode(public.digest(row_to_json(value)::text,'sha256'),'hex') row_hash
        from ${quote(schema)}.${quote(name)} value order by selector limit $2) sample`, [seed, size]);
    output[table] = value;
  }
  return output;
}

async function collectInvariants(database, columns, secretProof) {
  const ciphertext = columns.filter(({ column_name }) => column_name.endsWith('_ciphertext'));
  const malformed = await unions(database, ciphertext.map(({ schema_name, table_name, column_name }) =>
    `select '${schema_name}.${table_name}.${column_name}' key,count(*)::text value from ${quote(schema_name)}.${quote(table_name)}
      where ${quote(column_name)} is not null and length(${quote(column_name)})<16`));
  const values = await one(database, `select
    ((select count(*) from pg_constraint constraintinfo join pg_class relation on relation.oid=constraintinfo.conrelid
      join pg_namespace namespace on namespace.oid=relation.relnamespace where constraintinfo.contype='f' and not constraintinfo.convalidated
      and namespace.nspname in(select schema_name from runtime.moduleauthority union all select 'invoice'))
      +(select count(*) from payment.intent intent left join ordering.orderrecord orders on orders.id=intent.order_id where orders.id is null)
      +(select count(*) from runtime.businessreference reference where case reference.aggregate_type
        when 'catalog.product' then not exists(select 1 from catalog.product value where value.id=reference.internal_id)
        when 'order.order' then not exists(select 1 from ordering.orderrecord value where value.id=reference.internal_id)
        when 'payment.intent' then not exists(select 1 from payment.intent value where value.id=reference.internal_id)
        when 'voucher.voucher' then not exists(select 1 from voucher.voucher value where value.id=reference.internal_id)
        when 'finance.journal' then not exists(select 1 from finance.journal value where value.id=reference.internal_id)
        when 'approval.instance' then not exists(select 1 from approval.instances value where value.id=reference.internal_id)
        when 'partner.customer' then not exists(select 1 from partner.customer value where value.id=reference.internal_id) else true end))::integer "orphanCount",
    ((select count(*) from(select order_id,purpose from payment.intent where state in('created','preparing','pending') group by 1,2 having count(*)>1) duplicate)
      +(select count(*) from(select voucher_id from voucher.tenderhold where state='active' group by 1 having count(*)>1) duplicate))::integer "duplicateBusinessKeyCount",
    (select count(*)::integer from finance.journal journal where journal.state in('posted','reversed') and
      (select coalesce(sum(case entry.side when 'debit' then entry.amount_minor else -entry.amount_minor end),0) from finance.entry entry where entry.journal_id=journal.id)<>0) "unbalancedJournalCount",
    (select count(*)::integer from inventory.stockitem stock where stock.onhand-stock.safety-
      coalesce((select sum(quantity) from inventory.reservation value where value.stockitem_id=stock.id and value.state='reserved' and value.expires_at>clock_timestamp()),0)<0) "negativeInventoryCount"`);
  const malformedCount = malformed.reduce((sum, { value }) => sum + Number(value), 0);
  const undecryptable = secretProof?.undecryptableCount ?? malformedCount;
  if (!Number.isSafeInteger(undecryptable) || undecryptable < 0 || secretProof && (!Number.isSafeInteger(secretProof.checkedCount)
    || !/^[0-9a-f]{64}$/.test(secretProof.evidenceSha256 ?? ''))) throw new Error('MIGRATION_EVIDENCE_SECRET_PROOF_INVALID');
  return { ...values, secretEnvelopeCount: ciphertext.length, malformedSecretCount: malformedCount, undecryptableSecretCount: undecryptable, rls: null };
}

async function collectCheckpoints(database) {
  const imports = (await database.query(`select owner,state,count(*)::integer count,
    encode(public.digest(coalesce(string_agg(id||':'||version||':'||checkpoint::text,'|' order by id),''),'sha256'),'hex') "checkpointHash"
    from runtime.imports group by owner,state order by owner,state`)).rows;
  const migration = await one(database, `select count(*)::integer "migrationEvidenceCount",
    coalesce(max(migration),'00000000000000') "latestMigrationEvidence" from runtime.migrationevidence`);
  return { imports, ...migration };
}

async function verifyRls(database) {
  const suffix = randomUUID().replaceAll('-', '');
  const own = `evidence:rls:${suffix}:own`;
  const foreign = `evidence:rls:${suffix}:foreign`;
  try {
    await database.query('begin');
    await database.query(`insert into risk.policy(id,scope_id,name,status,next_version,updated_at) values($1,$2,'Evidence own','draft',1,clock_timestamp()),
      ($3,$4,'Evidence foreign','draft',1,clock_timestamp())`, [own, `scope:evidence:${suffix}`, foreign, `scope:foreign:${suffix}`]);
    await database.query('set local role shopapp');
    await database.query(`select set_config('app.workload','api',true),set_config('app.scope_id',$1,true),set_config('app.actor_id','migration:evidence',true)`, [`scope:evidence:${suffix}`]);
    const visible = await database.query(`select id from risk.policy where id=any($1::text[]) order by id`, [[own, foreign]]);
    await database.query('rollback');
    if (visible.rows.length !== 1 || visible.rows[0]?.id !== own) return { passed: false, scopeLeaks: 1, writeRejected: false };
    await database.query('begin');
    await database.query(`insert into risk.policy(id,scope_id,name,status,next_version,updated_at) values($1,$2,'Evidence own','draft',1,clock_timestamp())`, [own, `scope:evidence:${suffix}`]);
    await database.query('set local role shopapp');
    await database.query(`select set_config('app.workload','api',true),set_config('app.scope_id',$1,true),set_config('app.actor_id','migration:evidence',true)`, [`scope:evidence:${suffix}`]);
    let writeRejected = false;
    try {
      await database.query(`insert into risk.policy(id,scope_id,name,status,next_version,updated_at) values($1,$2,'Forbidden','draft',1,clock_timestamp())`, [foreign, `scope:foreign:${suffix}`]);
    } catch (error) {
      writeRejected = /row-level security/i.test(String(error instanceof Error ? error.message : error));
    }
    await database.query('rollback');
    return { passed: writeRejected, scopeLeaks: writeRejected ? 0 : 1, writeRejected };
  } catch (error) {
    await database.query('rollback').catch(() => undefined);
    throw error;
  }
}

async function unions(database, queries) {
  if (queries.length === 0) return [];
  const rows = [];
  for (let index = 0; index < queries.length; index += 80) rows.push(...(await database.query(queries.slice(index, index + 80).join(' union all '))).rows);
  return rows;
}

async function one(database, sql, parameters = []) {
  return (await database.query(sql, parameters)).rows[0];
}

function quote(value) {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error('MIGRATION_EVIDENCE_IDENTIFIER_INVALID');
  return `"${value}"`;
}

function integerOption(name, fallback) {
  const value = option(name);
  if (value === undefined && fallback !== undefined) return fallback;
  if (value === undefined || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`MIGRATION_EVIDENCE_INTEGER_REQUIRED:${name}`);
  return Number(value);
}

function resolveInput(value) {
  const path = isAbsolute(value) ? value : resolve(root, value);
  if (relative(root, path).startsWith('..')) throw new Error('MIGRATION_EVIDENCE_INPUT_PATH_INVALID');
  return path;
}

function archiveFile(value, archiveRoot) {
  const path = resolveInput(value);
  const allowed = resolve(root, archiveRoot);
  if (relative(allowed, path).startsWith('..') || !path.endsWith('.json')) throw new Error('MIGRATION_EVIDENCE_ARCHIVE_PATH_INVALID');
  return path;
}
