import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const identifier = randomUUID().replaceAll('-', '').slice(0, 16);
const container = `zhudatuan-hosted-node-${identifier}`;
const database = 'zhudatuan_hosted_node';
const password = `HostedNode${identifier}A`;

try {
  await run('docker', ['info', '--format', '{{.ServerVersion}}'], { quiet: true });
  await run('docker', [
    'run', '-d', '--rm', '--name', container,
    '-e', `POSTGRES_PASSWORD=${password}`,
    '-e', `POSTGRES_DB=${database}`,
    '-p', '127.0.0.1::5432',
    'postgres:17-alpine',
  ], { quiet: true });
  await waitForPostgres();
  const portOutput = await capture('docker', ['port', container, '5432/tcp']);
  const port = portOutput.split('\n').map((line) => line.trim())
    .find((line) => line.startsWith('127.0.0.1:'))?.split(':').at(-1);
  if (!port || !/^\d+$/.test(port)) throw new Error(`HOSTED_NODE_POSTGRES_PORT_INVALID:${portOutput.trim()}`);

  const adminUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/${database}`;
  const runtimeUrl = `postgresql://zhudatuanprovisioningapi:${password}@127.0.0.1:${port}/${database}`;
  const sql = await Promise.all([
    '02_platform_pingtai/database/supabase/tests/sfl_hosted_node_provisioning_bootstrap.sql',
    '02_platform_pingtai/database/supabase/migrations/20260911200000_create_sfl_node_sovereignty.sql',
    '02_platform_pingtai/database/supabase/migrations/20260911210000_create_sfl_hosted_node_provisioning.sql',
    '02_platform_pingtai/database/supabase/tests/sfl_node_sovereignty_contract.sql',
    '02_platform_pingtai/database/supabase/tests/sfl_hosted_node_provisioning_contract.sql',
  ].map((path) => readFile(join(repositoryRoot, path), 'utf8')));
  await run('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-f', '-'], {
    input: sql.join('\n'),
  });
  await run('docker', ['exec', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database,
    '-c', `alter role zhudatuanprovisioningapi login password '${password}';`], { quiet: true });
  await run('npm', ['--workspace', '@shop/commerce', 'run', 'test:integration', '--', 'HostedNodeProvisioningEngine.test.ts'], {
    environment: { SHOP_TEST_ADMIN_DATABASE_URL: adminUrl, SHOP_TEST_DATABASE_URL: runtimeUrl },
  });
  console.log('SFL hosted node PostgreSQL 17 acceptance passed: samples=L1/L5/L6/L11 concurrency=5 rollback=atomic infrastructure=0');
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
  throw new Error('HOSTED_NODE_POSTGRES_NOT_READY');
}

function run(command, arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: repositoryRoot,
      env: { ...process.env, ...(options.environment ?? {}) },
      stdio: [options.input === undefined ? 'ignore' : 'pipe', options.quiet ? 'ignore' : 'inherit', options.quiet ? 'ignore' : 'inherit'],
    });
    if (options.input !== undefined) child.stdin.end(options.input);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0 || options.allowFailure) resolve(code ?? 1);
      else reject(new Error(`COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}`));
    });
  });
}

function capture(command, arguments_) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, { cwd: repositoryRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}:${stderr.trim()}`));
    });
  });
}
