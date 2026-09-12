import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const identifier = randomUUID().replaceAll('-', '').slice(0, 16);
const container = `zhudatuan-password-login-${identifier}`;
const database = 'zhudatuan_password_login';
const password = `PasswordLogin${identifier}A`;

try {
  await run('docker', ['info', '--format', '{{.ServerVersion}}'], { quiet: true });
  await run('docker', ['run', '-d', '--rm', '--name', container, '-e', `POSTGRES_PASSWORD=${password}`,
    '-e', `POSTGRES_DB=${database}`, '-p', '127.0.0.1::5432', 'postgres:17-alpine'], { quiet: true });
  await waitForPostgres();
  const portOutput = await capture('docker', ['port', container, '5432/tcp']);
  const port = portOutput.split('\n').map((line) => line.trim())
    .find((line) => line.startsWith('127.0.0.1:'))?.split(':').at(-1);
  if (!port || !/^\d+$/.test(port)) throw new Error(`PASSWORD_LOGIN_POSTGRES_PORT_INVALID:${portOutput.trim()}`);
  const adminUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/${database}`;
  const identityUrl = `postgresql://zhudatuanidentityapi:${password}@127.0.0.1:${port}/${database}`;
  await run('node', ['04_tools/scripts/audit/database-contracts.mjs', '--postgres-fresh', adminUrl]);
  await run('docker', ['exec', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database,
    '-c', `alter role zhudatuanroot superuser; alter role zhudatuanidentityapi login password '${password}';`], { quiet: true });
  await run('npm', ['--workspace', '@shop/commerce', 'run', 'test:integration', '--', 'PasswordLoginStability.test.ts'], {
    environment: { SHOP_TEST_ADMIN_DATABASE_URL: adminUrl, SHOP_TEST_DATABASE_URL: identityUrl,
      SHOP_TEST_STABILITY_ROUNDS: process.env.SHOP_TEST_STABILITY_ROUNDS ?? '1' },
  });
  console.log(`password login PostgreSQL 17 stability passed: rounds=${process.env.SHOP_TEST_STABILITY_ROUNDS ?? '1'}`);
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
  throw new Error('PASSWORD_LOGIN_POSTGRES_NOT_READY');
}

function run(command, arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, { cwd: repositoryRoot,
      env: { ...process.env, ...(options.environment ?? {}) }, stdio: options.quiet ? 'ignore' : 'inherit' });
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
    child.once('exit', (code, signal) => code === 0 ? resolve(stdout)
      : reject(new Error(`COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}:${stderr.trim()}`)));
  });
}
