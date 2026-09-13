import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { platform, release, tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { Client } from 'pg';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';
import {
  buildHorizontalArtifact,
  collectHorizontalSourceInventory,
  createHorizontalFixture,
  executeHorizontalNodes,
} from './e01-horizontal-nodes.evidence.mjs';
import { finalizeE01Evidence } from './e01-horizontal-nodes.formal.mjs';

const identifier = randomUUID().replaceAll('-', '').slice(0, 16);
const runToken = identifier.slice(0, 8);
const container = `zhudatuan-e01-${identifier}`;
const databaseName = 'zhudatuan_registration';
const password = `HorizontalEvidence${identifier}A`;
const criteriaPath = join(repositoryRoot, '05_docs_ziliao', 'docs_wendang', 'architecture', 'evidence', 'e2.0',
  'E2.0-E01-正式重测判据-2026-09-14.json');
const evidenceArgument = option('--evidence-directory');
const formalExecution = evidenceArgument !== undefined;
const sourceControl = await sourceControlState();
const criteria = await readJson(criteriaPath);
const startedAt = new Date().toISOString();

if (Date.parse(criteria.locked_at) >= Date.parse(startedAt)) throw new Error('E01_CRITERIA_NOT_LOCKED_BEFORE_EXECUTION');
await verifyCriteriaSources(criteria);
if (formalExecution && sourceControl.tree_state !== 'CLEAN') throw new Error('E01_EVIDENCE_REQUIRES_CLEAN_TREE');

const evidenceDirectory = formalExecution
  ? resolve(repositoryRoot, evidenceArgument)
  : await mkdtemp(join(tmpdir(), 'zhudatuan-e01-evidence-'));
const workingDirectory = await mkdtemp(join(tmpdir(), 'zhudatuan-e01-work-'));
if (formalExecution) {
  assertRepositoryEvidencePath(evidenceDirectory);
  await createEvidenceDirectory(evidenceDirectory);
}

let environment;
let executionSummary;
try {
  const fixture = createHorizontalFixture(criteria, runToken);
  const sourceInventory = await collectHorizontalSourceInventory(criteria, fixture, new Date().toISOString());
  const build = await buildHorizontalArtifact(
    criteria,
    sourceControl.sha,
    join(workingDirectory, 'shared-commerce-api-artifact'),
    fixture.peers
  );
  try {
    await run('docker', ['info', '--format', '{{.ServerVersion}}'], { quiet: true });
    await run('docker', [
      'run', '-d', '--rm', '--name', container,
      '-e', `POSTGRES_PASSWORD=${password}`,
      '-e', `POSTGRES_DB=${databaseName}`,
      '-p', '127.0.0.1::5432',
      'postgres:17-alpine',
    ], { quiet: true });
    await waitForPostgres();
    const port = await postgresPort();
    const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/${databaseName}`;
    const migrationOutput = await capture('node', [
      '04_tools/scripts/audit/database-contracts.mjs', '--identity-realm-isolation', databaseUrl,
      'local-disposable-fixture',
    ]);
    await writeFile(join(evidenceDirectory, 'migration-replay.txt'), migrationOutput, { flag: 'wx' });

    const database = new Client({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 120_000,
    });
    await database.connect();
    try {
      executionSummary = await executeHorizontalNodes(database, criteria, fixture, sourceInventory, evidenceDirectory);
      const capturedAt = new Date().toISOString();
      const [postgresVersion, dockerVersion, imageId, migrationCount] = await Promise.all([
        scalar(database, 'select version()'),
        capture('docker', ['version', '--format', '{{.Server.Version}}']).then((value) => value.trim()),
        capture('docker', ['inspect', '--format', '{{.Image}}', container]).then((value) => value.trim()),
        scalar(database, 'select count(*)::integer from supabase_migrations.schema_migrations'),
      ]);
      environment = await environmentEvidence({
        capturedAt,
        postgresVersion,
        dockerVersion,
        imageId,
        migrationCount,
        port,
        sourceInventoryDigest: sourceInventory.inventory_digest,
        artifactIdentity: build.artifacts[0].artifact_identity,
      });
      const artifactIdentity = Object.freeze({
        schema_version: 'e01-horizontal-artifact-identity-v1',
        captured_at: capturedAt,
        source_sha: sourceControl.sha,
        source_inventory_digest: sourceInventory.inventory_digest,
        model_source_inventory_digest: sourceInventory.inventory_digest,
        source_inventory: sourceInventory,
        ...build,
      });
      await Promise.all([
        writeJson(join(evidenceDirectory, 'horizontal-artifact-identity.json'), artifactIdentity),
        writeJson(join(evidenceDirectory, 'environment.json'), environment),
      ]);
    } finally {
      await database.end();
    }

    await run('node', [
      '04_tools/scripts/audit/e01-horizontal-nodes.oracle.mjs',
      '--run-directory', evidenceDirectory,
      '--criteria', criteriaPath,
      '--output', join(evidenceDirectory, 'horizontal-independent-recount.json'),
    ]);
  } finally {
    await run('docker', ['rm', '-f', container], { allowFailure: true, quiet: true });
  }

  const completedAt = new Date().toISOString();
  if (formalExecution) {
    const result = await finalizeE01Evidence({
      evidenceDirectory,
      criteriaPath,
      environment,
      sourceControl,
      startedAt,
      completedAt,
      container,
      executionSummary,
    });
    console.log(`SFL E01 PostgreSQL 17 formal evidence completed: ${repositoryPath(evidenceDirectory)} outcome=${result.oracle.claim_outcome}`);
  } else {
    const oracle = await readJson(join(evidenceDirectory, 'horizontal-independent-recount.json'));
    if (oracle.claim_outcome !== 'MET') {
      throw new Error(`E01_ACCEPTANCE_${oracle.claim_outcome.replaceAll(' ', '_')}:${JSON.stringify({
        missing: oracle.missing_items,
        violations: oracle.violations.slice(0, 12),
      })}`);
    }
    console.log(`SFL E01 PostgreSQL 17 acceptance passed: peers=${executionSummary.peer_count} positive=${executionSummary.positive_observation_count} cross-node=${executionSummary.cross_node_observation_count} writes=${executionSummary.successful_business_write_count} rollback=${executionSummary.rollback_residual_fact_count}`);
  }
} finally {
  await rm(workingDirectory, { recursive: true, force: true });
  if (!formalExecution) await rm(evidenceDirectory, { recursive: true, force: true });
}

async function environmentEvidence(input) {
  const criteriaBytes = await readFile(criteriaPath);
  return Object.freeze({
    schema_version: 'e01-environment-v1',
    captured_at: input.capturedAt,
    kind: 'DEV',
    environment_id: `local-disposable-postgresql17-e01-${identifier}`,
    description: 'A newly created PostgreSQL 17 Alpine container replayed the complete production migration chain and executed the locked E01 three-peer horizontal context, operation and isolation matrix plus one shared commerce-api runtime build.',
    owner: 'Ethan-controlled local Codex workspace',
    isolation: `Disposable Docker container ${container}; synthetic E01 nodes, identities, scopes, capabilities and resources only; the database transaction was rolled back and the container was removed after execution.`,
    real_customer_data: false,
    production_impact: 'None. No production service, database, DNS provider, payment provider, supplier or customer record was contacted.',
    differences_from_production: [
      'Local disposable Docker PostgreSQL rather than managed Alibaba Cloud PostgreSQL.',
      'Synthetic H-A, H-B and H-C identities and rollback-safe resources rather than customer traffic.',
      'The shared runtime artifact was built locally and not activated on a Hosted or Sovereign runtime.',
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
    source_inventory_digest: input.sourceInventoryDigest,
    artifact_identity: input.artifactIdentity,
    configuration_digest: `sha256:${sha256(Buffer.from([
      sourceControl.sha,
      input.imageId,
      input.postgresVersion,
      input.migrationCount,
      sha256(criteriaBytes),
      input.sourceInventoryDigest,
      input.artifactIdentity,
      criteria.fixture.peer_count,
      criteria.operation_matrix.cross_node_observation_count,
    ].join('\n')))}`,
  });
}

async function verifyCriteriaSources(criteriaValue) {
  for (const source of [
    ...criteriaValue.authoritative_basis,
    ...criteriaValue.implementation_basis,
    ...criteriaValue.regression_basis,
  ]) {
    const repositorySourcePath = source.path.split('#')[0];
    const bytes = source.git_commit
      ? await capture('git', ['show', `${source.git_commit}:${repositorySourcePath}`])
      : await readFile(join(repositoryRoot, repositorySourcePath));
    const actual = `sha256:${sha256(bytes)}`;
    if (actual !== source.sha256) throw new Error(`E01_BASIS_DIGEST_MISMATCH:${source.path}:${actual}`);
  }
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const ready = await run('docker', [
      'exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', databaseName,
    ], { allowFailure: true, quiet: true });
    if (ready === 0) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error('E01_POSTGRES_NOT_READY');
}

async function postgresPort() {
  const output = await capture('docker', ['port', container, '5432/tcp']);
  const port = output.split('\n').map((line) => line.trim())
    .find((line) => line.startsWith('127.0.0.1:'))?.split(':').at(-1);
  if (!port || !/^\d+$/.test(port)) throw new Error(`E01_POSTGRES_PORT_INVALID:${output.trim()}`);
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
    const child = spawn(command, arguments_, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code, signal) => (code === 0
      ? resolveCapture(stdout)
      : reject(new Error(`COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}:${stderr.trim()}`))));
  });
}

async function sourceControlState() {
  const [sha, branch, status] = await Promise.all([
    capture('git', ['rev-parse', 'HEAD']),
    capture('git', ['branch', '--show-current']),
    capture('git', ['status', '--porcelain=v1']),
  ]);
  return Object.freeze({
    sha: sha.trim(),
    branch: branch.trim(),
    tree_state: status.trim() === '' ? 'CLEAN' : 'DIRTY',
    status: status.trim(),
  });
}

function assertRepositoryEvidencePath(path) {
  const local = relative(repositoryRoot, path);
  const evidenceRoot = join('05_docs_ziliao', 'docs_wendang', 'architecture', 'evidence', 'e2.0', 'runs');
  if (local.startsWith('..') || local === evidenceRoot || !local.startsWith(`${evidenceRoot}/`)) {
    throw new Error(`E01_EVIDENCE_DIRECTORY_INVALID:${local}`);
  }
}

async function createEvidenceDirectory(path) {
  const exists = await stat(path).then(() => true, () => false);
  if (exists) throw new Error(`E01_EVIDENCE_DIRECTORY_EXISTS:${repositoryPath(path)}`);
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
  if (!value || value.startsWith('--')) throw new Error(`E01_OPTION_VALUE_REQUIRED:${name}`);
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
