import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { Client } from 'pg';
import { repositoryRoot } from '../../scripts/lib/RepositoryRoot.mjs';
import { emitEvidence, loadYaml, requestId } from './Evidence.mjs';

const root = repositoryRoot;
const args = process.argv.slice(2);
const valueAfter = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const connectionString = valueAfter('--url') ?? process.env.DATABASE_URL;
const archiveArgument = valueAfter('--archive');
const summaryOnly = args.includes('--summary');
if (connectionString !== undefined && !/^postgres(?:ql)?:\/\//.test(connectionString)) throw new Error('MIGRATION_PLAN_URL_INVALID');
if (process.env.SHOP_RELEASE_MODE === 'production' && !archiveArgument) throw new Error('MIGRATION_PLAN_ARCHIVE_REQUIRED');

const ideal = await loadYaml(join(root, 'database', 'contracts', 'ideal.yml'));
const migrationsDirectory = join(root, 'database', 'migrations');
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((name) => name.endsWith('.sql') && name.slice(0, 14) > ideal.schemaHead.historyHead)
  .sort();

function tablesIn(sql) {
  const tables = new Set();
  const patterns = [
    /(?:alter|create|drop)\s+table(?:\s+if\s+(?:not\s+)?exists)?\s+([a-z][a-z0-9_]*\.[a-z][a-z0-9_]*)/gi,
    /(?:insert\s+into|update|delete\s+from)\s+([a-z][a-z0-9_]*\.[a-z][a-z0-9_]*)/gi,
    /create(?:\s+unique)?\s+index(?:\s+concurrently)?(?:\s+if\s+not\s+exists)?\s+[a-z][a-z0-9_]*\s+on\s+([a-z][a-z0-9_]*\.[a-z][a-z0-9_]*)/gi,
  ];
  for (const pattern of patterns) for (const match of sql.matchAll(pattern)) tables.add(match[1]);
  return [...tables].sort();
}

function lockLevel(sql) {
  if (/\b(drop\s+table|alter\s+table[\s\S]*?(?:drop\s+column|alter\s+column|set\s+schema|rename\s+to)|create\s+(?:unique\s+)?index(?!\s+concurrently))\b/i.test(sql)) return 'access-exclusive';
  if (/\b(alter\s+table[\s\S]*?validate\s+constraint|create\s+(?:unique\s+)?index\s+concurrently|analyze)\b/i.test(sql)) return 'share-update-exclusive';
  if (/\b(insert\s+into|update|delete\s+from)\b/i.test(sql)) return 'row-exclusive';
  return 'access-share';
}

const migrations = [];
const allTables = new Set();
for (const file of migrationFiles) {
  const source = await readFile(join(migrationsDirectory, file), 'utf8');
  const tables = tablesIn(source);
  tables.forEach((table) => allTables.add(table));
  migrations.push({
    version: file.slice(0, 14),
    file,
    sha256: createHash('sha256').update(source).digest('hex'),
    lock: lockLevel(source),
    tables,
    transactional: /^\s*begin;[\s\S]*commit;\s*$/i.test(source),
  });
}

let statistics = new Map();
if (connectionString) {
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000, statement_timeout: ideal.migrationPlanning.statementTimeoutMs });
  try {
    await client.connect();
    await client.query('begin read only');
    const result = await client.query(
      `select namespace.nspname||'.'||relation.relname table_name,
        greatest(relation.reltuples,0)::bigint estimated_rows,
        pg_total_relation_size(relation.oid)::bigint total_bytes,
        pg_indexes_size(relation.oid)::bigint index_bytes
      from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname||'.'||relation.relname=any($1::text[])`,
      [[...allTables]]
    );
    statistics = new Map(result.rows.map((row) => [row.table_name, row]));
    await client.query('rollback');
  } finally {
    await client.end();
  }
}

let totalRows = 0;
let totalIndexBytes = 0;
let knownTables = 0;
const tablePlans = [...allTables].sort().map((table) => {
  const statistic = statistics.get(table);
  const estimatedRows = statistic ? Number(statistic.estimated_rows) : null;
  const totalBytes = statistic ? Number(statistic.total_bytes) : null;
  const indexBytes = statistic ? Number(statistic.index_bytes) : null;
  const averageRowBytes = estimatedRows && totalBytes ? Math.max(1, Math.ceil((totalBytes - indexBytes) / estimatedRows)) : ideal.migrationPlanning.assumedRowBytes;
  const batchRows = Math.max(
    ideal.migrationPlanning.minimumBatchRows,
    Math.min(ideal.migrationPlanning.maximumBatchRows, Math.floor(ideal.migrationPlanning.targetBatchBytes / averageRowBytes))
  );
  if (estimatedRows !== null) {
    totalRows += estimatedRows;
    totalIndexBytes += indexBytes;
    knownTables += 1;
  }
  return { table, estimatedRows, totalBytes, indexBytes, averageRowBytes, batchRows };
});

const plan = {
  status: 'planned',
  requestId: requestId(),
  generatedAt: new Date().toISOString(),
  source: connectionString ? 'database-statistics' : 'static-contract',
  schemaHead: ideal.schemaHead.migrationHead,
  migrationCount: migrations.length,
  migrations,
  tables: tablePlans,
  estimates: {
    knownTables,
    totalTables: tablePlans.length,
    rowCount: knownTables ? totalRows : null,
    indexSpaceBytes: knownTables ? totalIndexBytes : null,
    durationSeconds: knownTables ? Math.ceil(totalRows / ideal.migrationPlanning.assumedRowsPerSecond) : null,
  },
  readOnly: true,
  connectionDetailsEmitted: false,
};

if (archiveArgument) {
  const archivePath = isAbsolute(archiveArgument) ? archiveArgument : resolve(root, archiveArgument);
  const archiveRelative = relative(root, archivePath);
  if (archiveRelative.startsWith('..') || archiveRelative === '' || !archivePath.endsWith('.json')) throw new Error('MIGRATION_PLAN_ARCHIVE_PATH_INVALID');
  await mkdir(dirname(archivePath), { recursive: true });
  await writeFile(archivePath, `${JSON.stringify(plan, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  plan.archive = archiveRelative;
}

emitEvidence(
  summaryOnly
    ? {
        status: plan.status,
        requestId: plan.requestId,
        generatedAt: plan.generatedAt,
        source: plan.source,
        schemaHead: plan.schemaHead,
        migrationCount: plan.migrationCount,
        tableCount: plan.tables.length,
        locks: Object.fromEntries(
          [...new Set(plan.migrations.map((migration) => migration.lock))]
            .sort()
            .map((lock) => [lock, plan.migrations.filter((migration) => migration.lock === lock).length])
        ),
        estimates: plan.estimates,
        readOnly: plan.readOnly,
        connectionDetailsEmitted: plan.connectionDetailsEmitted,
        ...(plan.archive ? { archive: plan.archive } : {}),
      }
    : plan
);
