import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const identifier = randomUUID().replaceAll('-', '').slice(0, 16);
const container = `zhudatuan-e05-zero-fanout-${identifier}`;
const database = 'zhudatuan_e05_zero_fanout';
const password = `E05ZeroFanout${identifier}A`;
const evidenceRoot = join(repositoryRoot, '05_docs_ziliao', 'docs_wendang', 'architecture', 'evidence', 'e05-hosted-zero-fanout');

try {
  await run('docker', ['info', '--format', '{{.ServerVersion}}'], { quiet: true });
  await run('docker', ['run', '-d', '--rm', '--name', container,
    '-e', `POSTGRES_PASSWORD=${password}`, '-e', `POSTGRES_DB=${database}`,
    '-p', '127.0.0.1::5432', 'postgres:17-alpine'], { quiet: true });
  await waitForPostgres();
  console.log('SFL E05 phase: PostgreSQL 17 ready');
  const portOutput = await capture('docker', ['port', container, '5432/tcp']);
  const port = portOutput.split('\n').map((line) => line.trim())
    .find((line) => line.startsWith('127.0.0.1:'))?.split(':').at(-1);
  if (!port || !/^\d+$/.test(port)) throw new Error(`SFL_E05_POSTGRES_PORT_INVALID:${portOutput.trim()}`);

  const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/${database}`;
  await run('node', ['04_tools/scripts/audit/database-contracts.mjs', '--postgres-fresh', databaseUrl]);
  console.log('SFL E05 phase: 301 migrations applied');
  const sql = await readFile(join(repositoryRoot,
    '02_platform_pingtai/database/supabase/tests/sfl_hosted_zero_fanout_contract.sql'), 'utf8');
  const output = await captureInput('docker', ['exec', '-i', container, 'psql', '-X', '-q', '-A', '-t',
    '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-f', '-'], sql);
  const observed = JSON.parse(output.trim().split('\n').at(-1));
  console.log('SFL E05 phase: lifecycle SQL completed');

  assert.deepEqual(observed.hosted_nodes, ['node:e05-h1:l2', 'node:e05-h2:l3', 'node:e05-h3:l4']);
  assert.deepEqual(observed.operations, ['create', 'suspend', 'reactivate', 'grant', 'revoke']);
  assert.deepEqual(observed.before, { hosted_nodes: 0, memberships: 0, audit_rows: 0, outbox_rows: 0 });
  assert.equal(observed.after.hosted_nodes, 3);
  assert.equal(observed.after.active_nodes, 3);
  assert.equal(observed.after.memberships, 3);
  assert.equal(observed.after.active_base_scopes, 3);
  assert.equal(observed.after.base_entitlements, 3);
  assert.equal(observed.after.extra_scope_rows, 1);
  assert.equal(observed.after.extra_scope_active, 0);
  assert.equal(observed.after.extra_entitlement_state, 'disabled');
  assert.equal(observed.after.audit_rows, 7);
  assert.equal(observed.after.outbox_rows, 7);
  assert.equal(observed.after.manifest_rows, 0);
  assert.equal(observed.after.resource_binding_rows, 0);
  assert.deepEqual(observed.access_checks, {
    suspended_denied: true,
    reactivated_allowed: true,
    revoked_extra_scope_denied: true,
  });

  const recorded = JSON.parse(await readFile(join(evidenceRoot, 'hosted-before-after.sql.json'), 'utf8'));
  assert.deepEqual(recorded, observed);
  const infrastructure = JSON.parse(await readFile(join(evidenceRoot, 'hosted-infrastructure-call-counts.json'), 'utf8'));
  assert.deepEqual(infrastructure.hosted_lifecycle, {
    dns: 0, tunnel: 0, systemd: 0, caddy: 0, build: 0, deploy: 0, restart: 0,
    manifest: 0, pointer: 0, process: 0, port: 0,
  });
  assert.deepEqual(infrastructure.shared_host_change, {
    build_count: 1, artifact_identity_count: 1, deploy_count: 1, restart_count: 1,
    hosted_per_node_action_count: 0,
  });
  const receipt = JSON.parse(await readFile(join(evidenceRoot, 'hosted-shared-release-receipt.json'), 'utf8'));
  assert.equal(receipt.workflow.run_id, 34731958020);
  assert.equal(receipt.workflow.conclusion, 'success');
  assert.equal(receipt.release.node, 'zhudatuan-l0');
  assert.equal(receipt.release.target, 'identity-api');
  assert.equal(receipt.release.build_count, 1);
  assert.equal(receipt.release.deploy_count, 1);
  assert.equal(receipt.release.restart.command_count, 1);
  const auditRows = (await readFile(join(evidenceRoot, 'hosted-audit-outbox.jsonl'), 'utf8'))
    .trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(auditRows.length, 7);
  assert.deepEqual([...new Set(auditRows.map((row) => row.operation))].sort(),
    ['create', 'grant', 'reactivate', 'revoke', 'suspend']);
  console.log('SFL E05 phase: machine evidence matched');

  console.log('SFL E05 Hosted zero-fanout PostgreSQL 17 acceptance passed: nodes=3 operations=create/suspend/reactivate/grant/revoke database-only=1 infrastructure=0 build=1 deploy=1 restart=1 hosted-per-node-actions=0');
} finally {
  await run('docker', ['rm', '-f', container], { allowFailure: true, quiet: true });
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const ready = await run('docker', ['exec', container, 'pg_isready', '-U', 'postgres', '-d', database],
      { allowFailure: true, quiet: true });
    if (ready === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('SFL_E05_POSTGRES_NOT_READY');
}

function run(command, arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: ['ignore', options.quiet ? 'ignore' : 'inherit', options.quiet ? 'ignore' : 'inherit'],
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0 || options.allowFailure) resolve(code ?? 1);
      else reject(new Error(`COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}`));
    });
  });
}

function capture(command, arguments_) {
  return captureInput(command, arguments_, undefined);
}

function captureInput(command, arguments_, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    if (input !== undefined) child.stdin.end(input);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}:${stderr.trim()}`));
    });
  });
}
