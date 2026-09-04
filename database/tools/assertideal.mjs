import { join } from 'node:path';
import { repositoryRoot } from '../../scripts/lib/RepositoryRoot.mjs';
import { businessNumber, digestFile, emitEvidence, loadYaml, redact, requestId, runNode } from './Evidence.mjs';

const root = repositoryRoot;
const startedAt = performance.now();
const request = requestId();
const idealPath = join(root, 'database', 'contracts', 'ideal.yml');
const ideal = await loadYaml(idealPath);
const objects = await loadYaml(join(root, ideal.tableResolution.source));
const tables = objects.objects.filter((object) => object.kind === ideal.tableResolution.selector.kind);

function fail(constraint, detail, table = 'database.contract', sample = detail) {
  emitEvidence(
    {
      status: 'failed',
      requestId: request,
      schemaHead: ideal.schemaHead.migrationHead,
      failure: {
        table,
        constraint,
        sampleBusinessNumber: businessNumber(sample),
        detail: redact(detail),
      },
      secretValuesEmitted: false,
      durationMs: Math.round(performance.now() - startedAt),
    },
    1
  );
  process.exit();
}

if (tables.length === 0 || new Set(tables.map((table) => table.id)).size !== tables.length) {
  fail('IDEAL_TABLE_CATALOG_INVALID', 'table catalog is empty or duplicated');
}
for (const table of tables) {
  if (!table.id || !new RegExp(ideal.ownership.ownerPattern).test(table.owner ?? '') || table.rls !== true) {
    fail('IDEAL_TABLE_DECLARATION_INVALID', 'table declaration does not resolve', table.id ?? 'database.unknown');
  }
}

const contractEvidence = [];
for (const relative of ideal.invariants.contracts) {
  const path = join(root, relative);
  const source = await (await import('node:fs/promises')).readFile(path, 'utf8');
  if (!/^begin;\s/i.test(source) || !/rollback;\s*$/i.test(source)) {
    fail('IDEAL_ASSERT_TRANSACTION_INVALID', 'contract must be transactionally rolled back', relative);
  }
  contractEvidence.push({ contract: relative, sha256: await digestFile(path) });
}

const replay = await runNode(root, join(root, 'scripts', 'audit', 'database-contracts.mjs'), ['--schema-fresh']);
if (replay.code !== 0) {
  const message = replay.stderr || replay.stdout || 'database assertion failed';
  const parsed = message.match(/hard-cut contract ([a-z0-9_]+\.sql): ([A-Z][A-Z0-9_]+)(?::([^\n]+))?/i);
  const relation = parsed?.[3]?.match(/([a-z][a-z0-9_]*\.[a-z][a-z0-9_]*)/i)?.[1];
  fail(parsed?.[2] ?? 'IDEAL_DATABASE_ASSERT_FAILED', parsed?.[2] ?? 'database assertion failed', relation ?? parsed?.[1] ?? 'database.contract', parsed?.[3] ?? parsed?.[2]);
}

emitEvidence({
  status: 'passed',
  requestId: request,
  artifact: ideal.artifact,
  schemaHead: ideal.schemaHead,
  tables: {
    resolved: tables.length,
    owners: new Set(tables.map((table) => table.owner)).size,
    rlsRequired: tables.length,
  },
  contracts: contractEvidence,
  secretValuesEmitted: false,
  durationMs: Math.round(performance.now() - startedAt),
});
