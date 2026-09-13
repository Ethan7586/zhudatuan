import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir, platform, release } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { Client } from 'pg';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';
import { collectSupplierFourFlowEvidence, materializeBusinessFixture, verifiedReplayContract } from './supplier-four-flow.evidence.mjs';
import { finalizeE08Evidence } from './supplier-four-flow.formal.mjs';

const identifier = randomUUID().replaceAll('-', '').slice(0, 16);
const container = `zhudatuan-e08-${identifier}`;
const databaseName = 'zhudatuan_e08';
const password = `SupplierFlow${identifier}A`;
const criteriaPath = join(repositoryRoot, '05_docs_ziliao', 'docs_wendang', 'architecture', 'evidence', 'e2.0', 'E2.0-E08-正式重测判据-2026-09-14.json');
const evidenceArgument = option('--evidence-directory');
const formalExecution = evidenceArgument !== undefined;
const sourceControl = await sourceControlState();
const criteria = await readJson(criteriaPath);
const startedAt = new Date().toISOString();
if (Date.parse(criteria.locked_at) >= Date.parse(startedAt)) throw new Error('E08_CRITERIA_NOT_LOCKED_BEFORE_EXECUTION');
await verifyCriteriaSources(criteria);
if (formalExecution && sourceControl.tree_state !== 'CLEAN') throw new Error('E08_EVIDENCE_REQUIRES_CLEAN_TREE');

const evidenceDirectory = formalExecution ? resolve(repositoryRoot, evidenceArgument) : await mkdtemp(join(tmpdir(), 'zhudatuan-e08-evidence-'));
if (formalExecution) {
  assertRepositoryEvidencePath(evidenceDirectory);
  await createEvidenceDirectory(evidenceDirectory);
}

let environment;
let contractExecution;
try {
  try {
    await run('docker', ['info', '--format', '{{.ServerVersion}}'], { quiet: true });
    await run('docker', ['run', '-d', '--rm', '--name', container, '-e', `POSTGRES_PASSWORD=${password}`, '-e', `POSTGRES_DB=${databaseName}`, '-p', '127.0.0.1::5432', 'postgres:17-alpine'], { quiet: true });
    await waitForPostgres();
    const port = await postgresPort();
    const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/${databaseName}`;
    const migrationOutput = await capture('node', ['04_tools/scripts/audit/database-contracts.mjs', '--postgres-fresh', databaseUrl]);
    await writeFile(join(evidenceDirectory, 'migration-replay.log'), migrationOutput, { flag: 'wx' });

    const database = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000, statement_timeout: 120_000 });
    await database.connect();
    try {
      const baselineStartedAt = new Date().toISOString();
      const baseline = await materializeBusinessFixture(database, criteria);
      const baselineCompletedAt = new Date().toISOString();
      const replaySql = await verifiedReplayContract(criteria);
      const replayRuns = await runConcurrentReplay(databaseUrl, replaySql, criteria.expected_fixture.concurrent_replay_attempts);
      const capturedAt = new Date().toISOString();
      const raw = await collectSupplierFourFlowEvidence(database, criteria, criteria.expected_fixture.concurrent_replay_attempts, capturedAt);
      await Promise.all([
        writeJson(join(evidenceDirectory, 'supplier-route-snapshot.json'), raw.route),
        writeJson(join(evidenceDirectory, 'four-flow-forward-facts.json'), raw.forward),
        writeJson(join(evidenceDirectory, 'partial-refund-replay.json'), raw.replay),
      ]);
      contractExecution = Object.freeze({
        schema_version: 'e08-contract-execution-v1',
        business_contract: {
          path: '02_platform_pingtai/database/supabase/tests/supplier_four_flow_business_contract.sql',
          source_sha256: baseline.source_sha256,
          started_at: baselineStartedAt,
          completed_at: baselineCompletedAt,
          execution_transform: baseline.execution_transform,
          sql_assertion_error: null,
        },
        replay_contract: {
          path: '02_platform_pingtai/database/supabase/tests/supplier_four_flow_concurrent_replay.sql',
          source_sha256: criteria.fixture_contracts.find((entry) => entry.path.endsWith('supplier_four_flow_concurrent_replay.sql')).sha256,
          simultaneous_sessions: replayRuns,
          sql_assertion_errors: [],
        },
        replay_attempts: replayRuns.length,
      });
      await writeJson(join(evidenceDirectory, 'contract-execution.json'), contractExecution);

      const [postgresVersion, dockerVersion, imageId, migrationCount] = await Promise.all([
        scalar(database, 'select version()'),
        capture('docker', ['version', '--format', '{{.Server.Version}}']).then((value) => value.trim()),
        capture('docker', ['inspect', '--format', '{{.Image}}', container]).then((value) => value.trim()),
        scalar(database, 'select count(*)::integer from supabase_migrations.schema_migrations'),
      ]);
      environment = await environmentEvidence({ postgresVersion, dockerVersion, imageId, migrationCount, port, capturedAt });
      await writeJson(join(evidenceDirectory, 'environment.json'), environment);
    } finally {
      await database.end();
    }

    await run('node', ['04_tools/scripts/audit/supplier-four-flow.oracle.mjs', '--run-directory', evidenceDirectory, '--criteria', criteriaPath, '--output', join(evidenceDirectory, 'inventory-and-finance-reconciliation.json')]);
  } finally {
    await run('docker', ['rm', '-f', container], { allowFailure: true, quiet: true });
  }

  const completedAt = new Date().toISOString();
  if (formalExecution) {
    const result = await finalizeE08Evidence({ evidenceDirectory, criteriaPath, environment, sourceControl, startedAt, completedAt, container, contractExecution });
    console.log(`SFL E08 PostgreSQL 17 formal evidence completed: ${repositoryPath(evidenceDirectory)} outcome=${result.oracle.claim_outcome}`);
  } else {
    const oracle = await readJson(join(evidenceDirectory, 'inventory-and-finance-reconciliation.json'));
    if (oracle.claim_outcome !== 'MET') throw new Error(`E08_ACCEPTANCE_${oracle.claim_outcome.replaceAll(' ', '_')}:${JSON.stringify({ missing: oracle.missing_items, violations: oracle.violations })}`);
    console.log(`SFL E08 PostgreSQL 17 acceptance passed: supplier-legs=3 replay-attempts=${criteria.expected_fixture.concurrent_replay_attempts} differences=0`);
  }
} finally {
  if (!formalExecution) await rm(evidenceDirectory, { recursive: true, force: true });
}

async function runConcurrentReplay(databaseUrl, sql, count) {
  const clients = Array.from(
    { length: count },
    () =>
      new Client({
        connectionString: databaseUrl,
        connectionTimeoutMillis: 5_000,
        statement_timeout: 120_000,
      })
  );
  try {
    await Promise.all(clients.map((client) => client.connect()));
    const startedAt = new Date().toISOString();
    await Promise.all(clients.map((client) => client.query(sql)));
    const completedAt = new Date().toISOString();
    return Object.freeze(
      clients.map((_, index) =>
        Object.freeze({
          attempt: index + 1,
          started_at: startedAt,
          completed_at: completedAt,
          database_error: null,
        })
      )
    );
  } finally {
    await Promise.allSettled(clients.map((client) => client.end()));
  }
}

async function environmentEvidence(input) {
  const criteriaBytes = await readFile(criteriaPath);
  return Object.freeze({
    schema_version: 'e08-environment-v1',
    captured_at: input.capturedAt,
    kind: 'DEV',
    environment_id: `local-disposable-postgresql17-e08-${identifier}`,
    description: 'A newly created PostgreSQL 17 Alpine container replayed the complete current migration chain, executed the locked E08 business contract and five simultaneous replay sessions, then exported authoritative rows.',
    owner: 'Ethan-controlled local Codex workspace',
    isolation: `Disposable Docker container ${container}; synthetic E08 transaction rows only; container removed after execution.`,
    real_customer_data: false,
    production_impact: 'None. No production service, database, payment provider, supplier or customer record was contacted.',
    differences_from_production: [
      'Local disposable Docker PostgreSQL rather than managed Alibaba Cloud PostgreSQL.',
      'Synthetic transaction, supplier, payment and refund facts rather than customer traffic or provider calls.',
      'No stable staging environment identity and no production observation.',
    ],
    runtime: {
      node: process.version,
      os: `${platform()} ${release()}`,
      docker_server: input.dockerVersion,
      postgres: input.postgresVersion,
      docker_image: 'postgres:17-alpine',
      docker_image_id: input.imageId,
      migration_count: Number(input.migrationCount),
      endpoint: `127.0.0.1:${input.port}/${databaseName}`,
    },
    source_control: sourceControl,
    configuration_digest: `sha256:${sha256(Buffer.from([sourceControl.sha, input.imageId, input.postgresVersion, input.migrationCount, sha256(criteriaBytes), ...criteria.fixture_contracts.map((entry) => entry.sha256)].join('\n')))}`,
  });
}

async function verifyCriteriaSources(criteriaValue) {
  for (const source of criteriaValue.authoritative_basis) {
    const repositoryPath = source.path.split('#')[0];
    const bytes = source.git_commit
      ? await capture('git', ['show', `${source.git_commit}:${repositoryPath}`])
      : await readFile(join(repositoryRoot, repositoryPath));
    const actual = `sha256:${sha256(bytes)}`;
    if (actual !== source.sha256) throw new Error(`E08_AUTHORITY_BASIS_DIGEST_MISMATCH:${source.path}`);
  }
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const ready = await run('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', databaseName], { allowFailure: true, quiet: true });
    if (ready === 0) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error('E08_POSTGRES_NOT_READY');
}

async function postgresPort() {
  const output = await capture('docker', ['port', container, '5432/tcp']);
  const port = output
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('127.0.0.1:'))
    ?.split(':')
    .at(-1);
  if (!port || !/^\d+$/.test(port)) throw new Error(`E08_POSTGRES_PORT_INVALID:${output.trim()}`);
  return port;
}

function run(command, arguments_, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, arguments_, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: options.quiet ? 'ignore' : 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0 || options.allowFailure) resolveRun(code ?? 1);
      else reject(new Error(`COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}`));
    });
  });
}

function capture(command, arguments_) {
  return new Promise((resolveCapture, reject) => {
    const child = spawn(command, arguments_, { cwd: repositoryRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => (code === 0 ? resolveCapture(stdout) : reject(new Error(`COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}:${stderr.trim()}`))));
  });
}

async function sourceControlState() {
  const [sha, branch, status] = await Promise.all([capture('git', ['rev-parse', 'HEAD']), capture('git', ['branch', '--show-current']), capture('git', ['status', '--porcelain=v1'])]);
  return Object.freeze({ sha: sha.trim(), branch: branch.trim(), tree_state: status.trim() === '' ? 'CLEAN' : 'DIRTY', status: status.trim() });
}

function assertRepositoryEvidencePath(path) {
  const local = relative(repositoryRoot, path);
  const evidenceRoot = join('05_docs_ziliao', 'docs_wendang', 'architecture', 'evidence', 'e2.0', 'runs');
  if (local.startsWith('..') || local === evidenceRoot || !local.startsWith(`${evidenceRoot}/`)) {
    throw new Error(`E08_EVIDENCE_DIRECTORY_INVALID:${local}`);
  }
}

async function createEvidenceDirectory(path) {
  const exists = await stat(path).then(
    () => true,
    () => false
  );
  if (exists) throw new Error(`E08_EVIDENCE_DIRECTORY_EXISTS:${repositoryPath(path)}`);
  await mkdir(dirname(path), { recursive: true });
  await mkdir(path);
}

async function scalar(database, sql) {
  const result = await database.query(sql);
  return Object.values(result.rows[0] ?? {})[0];
}

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`E08_OPTION_VALUE_REQUIRED:${name}`);
  return value;
}

function readJson(path) {
  return readFile(path, 'utf8').then(JSON.parse);
}
function writeJson(path, value) {
  return writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}
function repositoryPath(path) {
  return relative(repositoryRoot, path).replaceAll('\\', '/');
}
function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
