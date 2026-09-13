import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { platform, release, tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { Client } from 'pg';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';
import { executeE05ZeroFanout } from './e05-zero-fanout.evidence.mjs';
import { finalizeE05Evidence } from './e05-zero-fanout.formal.mjs';

const identifier = randomUUID().replaceAll('-', '').slice(0, 16);
const runToken = identifier.slice(0, 8);
const container = `zhudatuan-e05-${identifier}`;
const databaseName = 'zhudatuan_e05';
const password = `ZeroFanoutEvidence${identifier}A`;
const criteriaPath = join(repositoryRoot, '05_docs_ziliao', 'docs_wendang', 'architecture', 'evidence', 'e2.0',
  'E2.0-E05-正式重测判据-2026-09-14.json');
const frozenReleasePath = join(repositoryRoot, '05_docs_ziliao', 'docs_wendang', 'architecture', 'evidence',
  'e05-hosted-zero-fanout', 'hosted-shared-release-receipt.json');
const evidenceArgument = option('--evidence-directory');
const formalExecution = evidenceArgument !== undefined;
const sourceControl = await sourceControlState();
const criteria = await readJson(criteriaPath);
const startedAt = new Date().toISOString();

if (Date.parse(criteria.locked_at) >= Date.parse(startedAt)) throw new Error('E05_CRITERIA_NOT_LOCKED_BEFORE_EXECUTION');
await verifyCriteriaSources(criteria);
if (formalExecution && sourceControl.tree_state !== 'CLEAN') throw new Error('E05_EVIDENCE_REQUIRES_CLEAN_TREE');

const evidenceDirectory = formalExecution
  ? resolve(repositoryRoot, evidenceArgument)
  : await mkdtemp(join(tmpdir(), 'zhudatuan-e05-evidence-'));
if (formalExecution) {
  assertRepositoryEvidencePath(evidenceDirectory);
  await createEvidenceDirectory(evidenceDirectory);
}

const frozenReleaseBytes = await readFile(frozenReleasePath);
const sharedRelease = JSON.parse(frozenReleaseBytes.toString('utf8'));
const githubWorkflow = JSON.parse(await captureText('gh', ['run', 'view',
  String(criteria.shared_host_release_threshold.workflow_run_id), '--repo', 'Ethan7586/zhudatuan', '--json',
  'databaseId,url,event,conclusion,startedAt,updatedAt,headSha,workflowName']));
const externalEvidence = Object.freeze({
  sharedRelease,
  sharedReleaseSource: {
    path: repositoryPath(frozenReleasePath),
    git_commit: criteria.regression_basis.find((entry) => entry.path.endsWith('hosted-shared-release-receipt.json'))?.git_commit,
    sha256: `sha256:${sha256(frozenReleaseBytes)}`,
    size_bytes: frozenReleaseBytes.byteLength,
  },
  githubWorkflow,
});

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

    const database = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000, statement_timeout: 120_000 });
    await database.connect();
    try {
      executionSummary = await executeE05ZeroFanout(database, criteria, runToken, evidenceDirectory, externalEvidence);
      const [processOutput, portOutput, postgresVersion, dockerVersion, imageId, migrationCount, ghVersion] = await Promise.all([
        captureText('docker', ['top', container, '-eo', 'pid,comm,args']),
        captureText('docker', ['port', container]),
        scalar(database, 'select version()'),
        captureText('docker', ['version', '--format', '{{.Server.Version}}']).then((value) => value.trim()),
        captureText('docker', ['inspect', '--format', '{{.Image}}', container]).then((value) => value.trim()),
        scalar(database, 'select count(*)::integer from supabase_migrations.schema_migrations'),
        captureText('gh', ['--version']).then((value) => value.trim().split('\n')[0]),
      ]);
      const runtimeInventory = runtimeEvidence(processOutput, portOutput, executionSummary);
      await writeJson(join(evidenceDirectory, 'hosted-runtime-inventory.json'), runtimeInventory);
      environment = await environmentEvidence({
        capturedAt: new Date().toISOString(), postgresVersion, dockerVersion, imageId, migrationCount, port, ghVersion,
      });
      await writeJson(join(evidenceDirectory, 'environment.json'), environment);
    } finally {
      await database.end();
    }

    await run('node', ['04_tools/scripts/audit/e05-zero-fanout.oracle.mjs', '--run-directory', evidenceDirectory,
      '--criteria', criteriaPath, '--output', join(evidenceDirectory, 'zero-fanout-independent-recount.json')]);
  } finally {
    await run('docker', ['rm', '-f', container], { allowFailure: true, quiet: true });
  }

  const completedAt = new Date().toISOString();
  if (formalExecution) {
    const result = await finalizeE05Evidence({ evidenceDirectory, criteriaPath, environment, sourceControl, startedAt,
      completedAt, container, executionSummary });
    console.log(`SFL E05 PostgreSQL 17 formal evidence completed: ${repositoryPath(evidenceDirectory)} outcome=${result.oracle.claim_outcome}`);
  } else {
    const oracle = await readJson(join(evidenceDirectory, 'zero-fanout-independent-recount.json'));
    if (oracle.claim_outcome !== 'MET') {
      throw new Error(`E05_ACCEPTANCE_${oracle.claim_outcome.replaceAll(' ', '_')}:${JSON.stringify({
        missing: oracle.missing_items,
        violations: oracle.violations?.slice(0, 12),
        thresholds: oracle.thresholds?.filter((entry) => !entry.met),
      })}`);
    }
    console.log(`SFL E05 PostgreSQL 17 acceptance passed: nodes=${executionSummary.sample_count} operations=5 lifecycle-infrastructure=0 shared-build/deploy/restart=1/1/1 per-node-actions=0`);
  }
} finally {
  if (!formalExecution) await rm(evidenceDirectory, { recursive: true, force: true });
}

function runtimeEvidence(processOutput, portOutput, summary) {
  const processLines = processOutput.trim().split('\n').filter(Boolean);
  const portMappings = portOutput.trim().split('\n').filter(Boolean);
  const tokens = [summary.run_token, ...summary.node_ids];
  return Object.freeze({
    schema_version: 'e05-hosted-runtime-inventory-v1',
    captured_at: new Date().toISOString(),
    observation_scope: `Disposable shared PostgreSQL container ${container}; raw process and port output is retained for independent token scanning.`,
    shared_test_environment: {
      container,
      process_lines: processLines,
      port_mappings: portMappings,
    },
    hosted_identity_tokens: tokens,
    hosted_specific_process_matches: processLines.filter((line) => tokens.some((token) => line.includes(token))),
    hosted_specific_port_matches: portMappings.filter((line) => tokens.some((token) => line.includes(token))),
    hosted_specific_pointer_references: [],
  });
}

async function environmentEvidence(input) {
  const criteriaBytes = await readFile(criteriaPath);
  return Object.freeze({
    schema_version: 'e05-environment-v1',
    captured_at: input.capturedAt,
    kind: 'DEV',
    environment_id: `local-disposable-postgresql17-e05-${identifier}`,
    description: 'A newly created PostgreSQL 17 Alpine container replayed the complete migration chain and executed the locked three-node, five-operation E05 lifecycle matrix. A read-only GitHub lookup reconciled the frozen historical production shared-host release receipt.',
    owner: 'Ethan-controlled local Codex workspace',
    isolation: `Disposable Docker container ${container}; synthetic E05 identities only; no infrastructure mutation was invoked and the container was removed after execution.`,
    real_customer_data: false,
    production_impact: 'None from this run. GitHub Actions run metadata was read only; no workflow, deployment, process, DNS, tunnel, Caddy, pointer or cloud resource was changed.',
    differences_from_production: [
      'Lifecycle transitions ran in local disposable PostgreSQL rather than managed Alibaba Cloud PostgreSQL.',
      'Synthetic Hosted nodes and database authorization projections were used rather than customer identities or live HTTP sessions.',
      'The shared-host build/deploy/restart observation is a frozen historical production receipt reconciled read-only, not a new deployment.',
      'No stable separately managed staging lifecycle execution and no current production lifecycle observation.',
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
      github_cli: input.ghVersion,
    },
    source_control: sourceControl,
    configuration_digest: `sha256:${sha256(Buffer.from([sourceControl.sha, input.imageId, input.postgresVersion,
      input.migrationCount, sha256(criteriaBytes), executionSummary.source_inventory_digest,
      githubWorkflow.databaseId, githubWorkflow.headSha].join('\n')))}`,
  });
}

async function verifyCriteriaSources(criteriaValue) {
  for (const source of [...criteriaValue.authoritative_basis, ...criteriaValue.implementation_basis,
    ...criteriaValue.regression_basis]) {
    const repositorySourcePath = source.path.split('#')[0];
    const bytes = source.git_commit
      ? await captureBuffer('git', ['show', `${source.git_commit}:${repositorySourcePath}`])
      : await readFile(join(repositoryRoot, repositorySourcePath));
    const actual = `sha256:${sha256(bytes)}`;
    if (actual !== source.sha256) throw new Error(`E05_BASIS_DIGEST_MISMATCH:${source.path}:${actual}`);
  }
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const ready = await run('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', databaseName],
      { allowFailure: true, quiet: true });
    if (ready === 0) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error('E05_POSTGRES_NOT_READY');
}

async function postgresPort() {
  const output = await captureText('docker', ['port', container, '5432/tcp']);
  const port = output.split('\n').map((line) => line.trim()).find((line) => line.startsWith('127.0.0.1:'))?.split(':').at(-1);
  if (!port || !/^\d+$/.test(port)) throw new Error(`E05_POSTGRES_PORT_INVALID:${output.trim()}`);
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

function captureBuffer(command, arguments_) {
  return new Promise((resolveCapture, reject) => {
    const child = spawn(command, arguments_, { cwd: repositoryRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    let stderr = '';
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code, signal) => (code === 0
      ? resolveCapture(Buffer.concat(stdout))
      : reject(new Error(`COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}:${stderr.trim()}`))));
  });
}

function captureText(command, arguments_) {
  return captureBuffer(command, arguments_).then((value) => value.toString('utf8'));
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
    throw new Error(`E05_EVIDENCE_DIRECTORY_INVALID:${local}`);
  }
}

async function createEvidenceDirectory(path) {
  const exists = await stat(path).then(() => true, () => false);
  if (exists) throw new Error(`E05_EVIDENCE_DIRECTORY_EXISTS:${repositoryPath(path)}`);
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
  if (!value || value.startsWith('--')) throw new Error(`E05_OPTION_VALUE_REQUIRED:${name}`);
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
