import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir, platform, release } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { Client } from 'pg';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';
import { buildSharedArtifact, collectSourceSnapshot, createScaleInputManifest, executeScaleScenario } from './e11-scale.evidence.mjs';
import { finalizeE11Evidence } from './e11-scale.formal.mjs';

const identifier = randomUUID().replaceAll('-', '').slice(0, 16);
const runToken = identifier.slice(0, 8);
const container = `zhudatuan-e11-${identifier}`;
const databaseName = 'zhudatuan_e11';
const password = `ScaleEvidence${identifier}A`;
const criteriaPath = join(repositoryRoot, '05_docs_ziliao', 'docs_wendang', 'architecture', 'evidence', 'e2.0', 'E2.0-E11-正式重测判据-2026-09-14.json');
const evidenceArgument = option('--evidence-directory');
const formalExecution = evidenceArgument !== undefined;
const sourceControl = await sourceControlState();
const criteria = await readJson(criteriaPath);
const startedAt = new Date().toISOString();
if (Date.parse(criteria.locked_at) >= Date.parse(startedAt)) throw new Error('E11_CRITERIA_NOT_LOCKED_BEFORE_EXECUTION');
await verifyCriteriaSources(criteria);
if (formalExecution && sourceControl.tree_state !== 'CLEAN') throw new Error('E11_EVIDENCE_REQUIRES_CLEAN_TREE');

const evidenceDirectory = formalExecution ? resolve(repositoryRoot, evidenceArgument) : await mkdtemp(join(tmpdir(), 'zhudatuan-e11-evidence-'));
const workingDirectory = await mkdtemp(join(tmpdir(), 'zhudatuan-e11-work-'));
if (formalExecution) {
  assertRepositoryEvidencePath(evidenceDirectory);
  await createEvidenceDirectory(evidenceDirectory);
}

let environment;
let executionSummary;
try {
  try {
    await run('docker', ['info', '--format', '{{.ServerVersion}}'], { quiet: true });
    await run('docker', ['run', '-d', '--rm', '--name', container, '-e', `POSTGRES_PASSWORD=${password}`, '-e', `POSTGRES_DB=${databaseName}`, '-p', '127.0.0.1::5432', 'postgres:17-alpine'], { quiet: true });
    await waitForPostgres();
    const port = await postgresPort();
    const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/${databaseName}`;
    const migrationOutput = await capture('node', ['04_tools/scripts/audit/database-contracts.mjs', '--postgres-fresh', databaseUrl]);
    await writeFile(join(evidenceDirectory, 'migration-replay.txt'), migrationOutput, { flag: 'wx' });

    const manifest = createScaleInputManifest(criteria, runToken, new Date().toISOString());
    const build = await buildSharedArtifact(
      criteria,
      sourceControl.sha,
      join(workingDirectory, 'shared-identity-api-artifact'),
      manifest.scenarios.map((scenario) => scenario.scenario_id)
    );
    const sourceSnapshots = [];
    const metrics = [];
    const operations = [];
    const isolation = [];
    const database = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000, statement_timeout: 120_000 });
    await database.connect();
    try {
      for (const scale of criteria.scale_matrix.node_counts) {
        sourceSnapshots.push(await collectSourceSnapshot(criteria, scale, new Date().toISOString()));
        for (const scenario of manifest.scenarios.filter((entry) => entry.node_count === scale)) {
          const result = await executeScaleScenario(database, scenario);
          metrics.push(result.metrics);
          operations.push(result.operations);
          isolation.push(result.isolation);
        }
        process.stdout.write(`E11 scale ${scale} completed across ${criteria.scale_matrix.topologies.length} topologies.\n`);
      }

      const capturedAt = new Date().toISOString();
      const [postgresVersion, dockerVersion, imageId, migrationCount] = await Promise.all([
        scalar(database, 'select version()'),
        capture('docker', ['version', '--format', '{{.Server.Version}}']).then((value) => value.trim()),
        capture('docker', ['inspect', '--format', '{{.Image}}', container]).then((value) => value.trim()),
        scalar(database, 'select count(*)::integer from supabase_migrations.schema_migrations'),
      ]);
      environment = await environmentEvidence({
        postgresVersion,
        dockerVersion,
        imageId,
        migrationCount,
        port,
        capturedAt,
        sourceDigest: sourceSnapshots[0].inventory_digest,
        artifactIdentity: build.artifacts[0].artifact_identity,
      });
      const codeAndBuild = Object.freeze({
        schema_version: 'e11-scale-code-and-build-counts-v1',
        captured_at: capturedAt,
        source_sha: sourceControl.sha,
        source_inventory_scope: criteria.source_inventory_scope,
        source_inventory_snapshots: sourceSnapshots,
        ...build,
      });
      const hostedOperationCounts = Object.freeze({
        schema_version: 'e11-scale-hosted-operation-counts-v1',
        captured_at: capturedAt,
        observer_boundary: {
          observed_categories: ['cloud resource creation', 'runtime deployment', 'DNS mutation', 'external payment/provider provisioning'],
          interpretation:
            'Hosted node creation in every scenario invoked only organization.provision_hosted_node(jsonb). Docker startup, one migration replay and one shared runtime build are shared test-environment operations, not per-node Hosted infrastructure actions.',
        },
        shared_environment_operations: [
          { kind: 'disposable-postgresql-start', count: 1 },
          { kind: 'complete-migration-replay', count: 1 },
          { kind: 'shared-identity-api-runtime-build', count: 1 },
        ],
        per_node_infrastructure_events: [],
        scenarios: operations,
      });
      const contextMetrics = Object.freeze({
        schema_version: 'e11-scale-context-resolution-metrics-v1',
        captured_at: capturedAt,
        workload: criteria.fixed_per_node_workload,
        latency_policy: 'Recorded as raw elapsed milliseconds without an acceptance magnitude threshold.',
        scenarios: metrics,
      });
      const isolationOutput = Object.freeze({
        schema_version: 'e11-scale-isolation-results-v1',
        captured_at: capturedAt,
        scenarios: isolation,
      });
      await Promise.all([
        writeJson(join(evidenceDirectory, 'scale-input-manifest.json'), manifest),
        writeJson(join(evidenceDirectory, 'scale-code-and-build-counts.json'), codeAndBuild),
        writeJson(join(evidenceDirectory, 'scale-hosted-operation-counts.json'), hostedOperationCounts),
        writeJson(join(evidenceDirectory, 'scale-context-resolution-metrics.json'), contextMetrics),
        writeJson(join(evidenceDirectory, 'scale-isolation-results.json'), isolationOutput),
        writeJson(join(evidenceDirectory, 'environment.json'), environment),
      ]);
      executionSummary = Object.freeze({
        scenario_count: manifest.scenarios.length,
        generated_node_observation_count: manifest.scenarios.reduce((total, scenario) => total + scenario.generated_nodes.length, 0),
        sovereign_control_observation_count: manifest.scenarios.reduce((total, scenario) => total + scenario.sovereign_controls.length, 0),
        build_count: build.build_invocations.length,
        artifact_identity_count: new Set(build.artifacts.map((entry) => entry.artifact_identity)).size,
      });
    } finally {
      await database.end();
    }

    await run('node', ['04_tools/scripts/audit/e11-scale.oracle.mjs', '--run-directory', evidenceDirectory, '--criteria', criteriaPath, '--output', join(evidenceDirectory, 'scale-independent-recount.json')]);
  } finally {
    await run('docker', ['rm', '-f', container], { allowFailure: true, quiet: true });
  }

  const completedAt = new Date().toISOString();
  if (formalExecution) {
    const result = await finalizeE11Evidence({ evidenceDirectory, criteriaPath, environment, sourceControl, startedAt, completedAt, container, executionSummary });
    console.log(`SFL E11 PostgreSQL 17 formal evidence completed: ${repositoryPath(evidenceDirectory)} outcome=${result.oracle.claim_outcome}`);
  } else {
    const oracle = await readJson(join(evidenceDirectory, 'scale-independent-recount.json'));
    if (oracle.claim_outcome !== 'MET') throw new Error(`E11_ACCEPTANCE_${oracle.claim_outcome.replaceAll(' ', '_')}:${JSON.stringify({ missing: oracle.missing_items, violations: oracle.violations.slice(0, 10) })}`);
    console.log(`SFL E11 PostgreSQL 17 acceptance passed: scenarios=${executionSummary.scenario_count} node-observations=${executionSummary.generated_node_observation_count} builds=1 infrastructure-actions=0`);
  }
} finally {
  await rm(workingDirectory, { recursive: true, force: true });
  if (!formalExecution) await rm(evidenceDirectory, { recursive: true, force: true });
}

async function environmentEvidence(input) {
  const criteriaBytes = await readFile(criteriaPath);
  return Object.freeze({
    schema_version: 'e11-environment-v1',
    captured_at: input.capturedAt,
    kind: 'DEV',
    environment_id: `local-disposable-postgresql17-e11-${identifier}`,
    description: 'A newly created PostgreSQL 17 Alpine container replayed the complete migration chain and executed twelve locked E11 scale/topology scenarios; one local shared identity-api runtime artifact was built for all scenarios.',
    owner: 'Ethan-controlled local Codex workspace',
    isolation: `Disposable Docker container ${container}; synthetic E11 nodes only; each scenario rolled back and the container was removed after execution.`,
    real_customer_data: false,
    production_impact: 'None. No production service, database, DNS provider, payment provider, supplier or customer record was contacted.',
    differences_from_production: [
      'Local disposable Docker PostgreSQL rather than managed Alibaba Cloud PostgreSQL.',
      'Synthetic Hosted and sovereign-control nodes rather than customer traffic.',
      'Local build provenance and operation observation rather than production deployment or cloud audit logs.',
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
    configuration_digest: `sha256:${sha256(Buffer.from([sourceControl.sha, input.imageId, input.postgresVersion, input.migrationCount, sha256(criteriaBytes), input.sourceDigest, input.artifactIdentity].join('\n')))}`,
  });
}

async function verifyCriteriaSources(criteriaValue) {
  for (const source of [...criteriaValue.authoritative_basis, ...criteriaValue.implementation_basis]) {
    const repositorySourcePath = source.path.split('#')[0];
    const bytes = source.git_commit ? await capture('git', ['show', `${source.git_commit}:${repositorySourcePath}`]) : await readFile(join(repositoryRoot, repositorySourcePath));
    const actual = `sha256:${sha256(bytes)}`;
    if (actual !== source.sha256) throw new Error(`E11_BASIS_DIGEST_MISMATCH:${source.path}`);
  }
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const ready = await run('docker', ['exec', container, 'pg_isready', '-U', 'postgres', '-d', databaseName], { allowFailure: true, quiet: true });
    if (ready === 0) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error('E11_POSTGRES_NOT_READY');
}

async function postgresPort() {
  const output = await capture('docker', ['port', container, '5432/tcp']);
  const port = output
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('127.0.0.1:'))
    ?.split(':')
    .at(-1);
  if (!port || !/^\d+$/.test(port)) throw new Error(`E11_POSTGRES_PORT_INVALID:${output.trim()}`);
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
  if (local.startsWith('..') || local === evidenceRoot || !local.startsWith(`${evidenceRoot}/`)) throw new Error(`E11_EVIDENCE_DIRECTORY_INVALID:${local}`);
}

async function createEvidenceDirectory(path) {
  const exists = await stat(path).then(
    () => true,
    () => false
  );
  if (exists) throw new Error(`E11_EVIDENCE_DIRECTORY_EXISTS:${repositoryPath(path)}`);
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
  if (!value || value.startsWith('--')) throw new Error(`E11_OPTION_VALUE_REQUIRED:${name}`);
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
