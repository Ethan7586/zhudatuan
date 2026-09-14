import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir, platform, release } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { Client } from 'pg';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';
import { finalizeE09Evidence } from './e09-recovery.formal.mjs';

const identifier = randomUUID().replaceAll('-', '').slice(0, 16);
const container = `zhudatuan-e09-${identifier}`;
const databaseName = 'zhudatuan_e09';
const password = `RecoveryEvidence${identifier}A`;
const criteriaPath = join(repositoryRoot, '05_docs_ziliao', 'docs_wendang', 'architecture', 'evidence', 'e2.0',
  'E2.0-E09-正式重测判据-2026-09-14.json');
const evidenceArgument = option('--evidence-directory');
const formalExecution = evidenceArgument !== undefined;
const sourceControl = await sourceControlState();
const criteria = await readJson(criteriaPath);
const startedAt = new Date().toISOString();
if (Date.parse(criteria.locked_at) >= Date.parse(startedAt)) throw new Error('E09_CRITERIA_NOT_LOCKED_BEFORE_EXECUTION');
await verifyCriteriaSources(criteria);
if (formalExecution && sourceControl.tree_state !== 'CLEAN') throw new Error('E09_EVIDENCE_REQUIRES_CLEAN_TREE');

const evidenceDirectory = formalExecution ? resolve(repositoryRoot, evidenceArgument) : await mkdtemp(join(tmpdir(), 'zhudatuan-e09-evidence-'));
if (formalExecution) {
  assertRepositoryEvidencePath(evidenceDirectory);
  await createEvidenceDirectory(evidenceDirectory);
}

let environment;
let executionSummary;
try {
  await run('docker', ['info', '--format', '{{.ServerVersion}}'], { quiet: true });
  await run('docker', ['run', '-d', '--rm', '--name', container, '-e', `POSTGRES_PASSWORD=${password}`, '-e',
    `POSTGRES_DB=${databaseName}`, '-p', '127.0.0.1::5432', 'postgres:17-alpine'], { quiet: true });
  try {
    await waitForPostgres();
    const port = await postgresPort();
    const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/${databaseName}`;
    const migrationOutput = await captureText('node', ['04_tools/scripts/audit/database-contracts.mjs', '--postgres-fresh', databaseUrl]);
    await writeFile(join(evidenceDirectory, 'migration-replay.txt'), migrationOutput, { flag: 'wx' });

    const workloadOutput = await captureText('node', ['--import', 'tsx', '04_tools/scripts/audit/e09-recovery.workload.ts',
      '--database-url', databaseUrl, '--criteria', criteriaPath, '--output-directory', evidenceDirectory]);
    executionSummary = JSON.parse(workloadOutput.trim().split('\n').at(-1));
    await writeJson(join(evidenceDirectory, 'workload-execution.json'), Object.freeze({
      schema_version: 'e09-workload-execution-v1',
      captured_at: new Date().toISOString(),
      executor: 'actual production ExecutionKernel + PgUnitOfWork with disposable business/provider fixtures',
      ...executionSummary,
    }));

    const database = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000, statement_timeout: 120_000 });
    await database.connect();
    try {
      const capturedAt = new Date().toISOString();
      const [postgresVersion, dockerVersion, imageId, migrationCount] = await Promise.all([
        scalar(database, 'select version()'),
        captureText('docker', ['version', '--format', '{{.Server.Version}}']).then((value) => value.trim()),
        captureText('docker', ['inspect', '--format', '{{.Image}}', container]).then((value) => value.trim()),
        scalar(database, 'select count(*)::integer from supabase_migrations.schema_migrations'),
      ]);
      environment = await environmentEvidence({ capturedAt, postgresVersion, dockerVersion, imageId, migrationCount, port });
      await writeJson(join(evidenceDirectory, 'environment.json'), environment);
    } finally {
      await database.end();
    }

    await run('node', ['04_tools/scripts/audit/e09-recovery.oracle.mjs', '--run-directory', evidenceDirectory,
      '--criteria', criteriaPath, '--output', join(evidenceDirectory, 'recovery-independent-recount.json')]);
  } finally {
    await run('docker', ['rm', '-f', container], { allowFailure: true, quiet: true });
  }

  const completedAt = new Date().toISOString();
  if (formalExecution) {
    const result = await finalizeE09Evidence({ evidenceDirectory, criteriaPath, environment, sourceControl, startedAt, completedAt,
      container, executionSummary });
    console.log(`SFL E09 PostgreSQL 17 formal evidence completed: ${repositoryPath(evidenceDirectory)} outcome=${result.oracle.claim_outcome}`);
  } else {
    const oracle = await readJson(join(evidenceDirectory, 'recovery-independent-recount.json'));
    if (oracle.claim_outcome !== 'MET') {
      throw new Error(`E09_ACCEPTANCE_${oracle.claim_outcome.replaceAll(' ', '_')}:${JSON.stringify({
        missing: oracle.missing_items, violations: oracle.violations?.slice(0, 10), thresholds: oracle.thresholds?.filter((entry) => !entry.met),
      })}`);
    }
    console.log(`SFL E09 PostgreSQL 17 acceptance passed: five-way=${executionSummary.five_way_scenarios} interruptions=${executionSummary.interruption_scenarios} non-target-changes=0`);
  }
} finally {
  if (!formalExecution) await rm(evidenceDirectory, { recursive: true, force: true });
}

async function environmentEvidence(input) {
  const criteriaBytes = await readFile(criteriaPath);
  return Object.freeze({
    schema_version: 'e09-environment-v1',
    captured_at: input.capturedAt,
    kind: 'DEV',
    environment_id: `local-disposable-postgresql17-e09-${identifier}`,
    description: 'A newly created PostgreSQL 17 Alpine container replayed the complete migration chain and executed the locked E09 matrix through the production ExecutionKernel, production PostgreSQL unit of work and production audit projection.',
    owner: 'Ethan-controlled local Codex workspace',
    isolation: `Disposable Docker container ${container}; synthetic E09 business rows and deterministic local provider rows only; the container was removed after execution.`,
    real_customer_data: false,
    production_impact: 'None. No production service, database, DNS provider, payment provider, supplier or customer record was contacted.',
    differences_from_production: [
      'Local disposable Docker PostgreSQL rather than managed Alibaba Cloud PostgreSQL.',
      'Synthetic business actions behind five real registered operation IDs rather than live module handlers or customer traffic.',
      'A deterministic local provider persisted in a separately committed fixture transaction rather than an external payment, DNS or cloud provider.',
      'No stable separately managed staging execution and no production observation.',
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
    configuration_digest: `sha256:${sha256(Buffer.from([sourceControl.sha, input.imageId, input.postgresVersion,
      input.migrationCount, sha256(criteriaBytes)].join('\n')))}`,
  });
}

async function verifyCriteriaSources(criteriaValue) {
  for (const source of [...criteriaValue.authoritative_basis, ...criteriaValue.implementation_basis]) {
    const repositorySourcePath = source.path.split('#')[0];
    const bytes = source.git_commit
      ? await captureBuffer('git', ['show', `${source.git_commit}:${repositorySourcePath}`])
      : await readFile(join(repositoryRoot, repositorySourcePath));
    const actual = `sha256:${sha256(bytes)}`;
    if (actual !== source.sha256) throw new Error(`E09_BASIS_DIGEST_MISMATCH:${source.path}:${actual}`);
  }
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const ready = await run('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', databaseName],
      { allowFailure: true, quiet: true });
    if (ready === 0) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error('E09_POSTGRES_NOT_READY');
}

async function postgresPort() {
  const output = await captureText('docker', ['port', container, '5432/tcp']);
  const port = output.split('\n').map((line) => line.trim()).find((line) => line.startsWith('127.0.0.1:'))?.split(':').at(-1);
  if (!port || !/^\d+$/.test(port)) throw new Error(`E09_POSTGRES_PORT_INVALID:${output.trim()}`);
  return port;
}

function run(command, arguments_, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, arguments_, { cwd: repositoryRoot, env: process.env, stdio: options.quiet ? 'ignore' : 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0 || options.allowFailure) resolveRun(code ?? 1);
      else reject(new Error(`COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}`));
    });
  });
}

function captureText(command, arguments_) {
  return captureBuffer(command, arguments_).then((value) => value.toString('utf8'));
}

function captureBuffer(command, arguments_) {
  return new Promise((resolveCapture, reject) => {
    const child = spawn(command, arguments_, { cwd: repositoryRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.once('error', reject);
    child.once('exit', (code, signal) => (code === 0
      ? resolveCapture(Buffer.concat(stdout))
      : reject(new Error(`COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}:${Buffer.concat(stderr).toString('utf8').trim()}`))));
  });
}

async function sourceControlState() {
  const [sha, branch, status] = await Promise.all([
    captureText('git', ['rev-parse', 'HEAD']),
    captureText('git', ['branch', '--show-current']),
    captureText('git', ['status', '--porcelain=v1']),
  ]);
  return Object.freeze({ sha: sha.trim(), branch: branch.trim(), tree_state: status.trim() === '' ? 'CLEAN' : 'DIRTY', status: status.trim() });
}

function assertRepositoryEvidencePath(path) {
  const local = relative(repositoryRoot, path);
  const evidenceRoot = join('05_docs_ziliao', 'docs_wendang', 'architecture', 'evidence', 'e2.0', 'runs');
  if (local.startsWith('..') || local === evidenceRoot || !local.startsWith(`${evidenceRoot}/`)) {
    throw new Error(`E09_EVIDENCE_DIRECTORY_INVALID:${local}`);
  }
}

async function createEvidenceDirectory(path) {
  const exists = await stat(path).then(() => true, () => false);
  if (exists) throw new Error(`E09_EVIDENCE_DIRECTORY_EXISTS:${repositoryPath(path)}`);
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
  if (!value || value.startsWith('--')) throw new Error(`E09_OPTION_VALUE_REQUIRED:${name}`);
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
