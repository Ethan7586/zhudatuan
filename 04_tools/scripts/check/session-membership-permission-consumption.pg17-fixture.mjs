import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const identifier = randomUUID().replaceAll('-', '').slice(0, 16);
const container = `zhudatuan-session-permission-${identifier}`;
const database = 'zhudatuan_session_permission';
const password = `SessionPermission${identifier}A`;

try {
  await run('docker', ['info', '--format', '{{.ServerVersion}}'], { quiet: true });
  await run('docker', ['run', '-d', '--rm', '--name', container, '-e', `POSTGRES_PASSWORD=${password}`,
    '-e', `POSTGRES_DB=${database}`, '-p', '127.0.0.1::5432', 'postgres:17-alpine'], { quiet: true });
  await waitForPostgres();
  const files = [
    '02_platform_pingtai/database/supabase/tests/session_membership_permission_consumption_bootstrap.sql',
    '02_platform_pingtai/database/supabase/migrations/20260912240000_bind_permission_reads_to_session_membership.sql',
    '02_platform_pingtai/database/supabase/tests/session_membership_permission_consumption_contract.sql',
  ];
  const sql = await Promise.all(files.map((path) => readFile(join(repositoryRoot, path), 'utf8')));
  await run('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1',
    '-U', 'postgres', '-d', database, '-f', '-'], { input: sql.join('\n') });
  console.log('Session Membership permission consumption PostgreSQL 17 acceptance passed: operator/storefront isolation, cross-Realm and cross-organization denial, inactive Membership denial, own-permission success, read-only behavior');
} finally {
  await run('docker', ['rm', '-f', container], { allowFailure: true, quiet: true });
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const ready = await run('docker', ['exec', container, 'psql', '-X', '-U', 'postgres', '-d', database,
      '-c', 'select 1'], { allowFailure: true, quiet: true });
    if (ready === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('SESSION_MEMBERSHIP_PERMISSION_POSTGRES_NOT_READY');
}

function run(command, arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: [options.input === undefined ? 'ignore' : 'pipe', options.quiet ? 'ignore' : 'inherit',
        options.quiet ? 'ignore' : 'inherit'],
    });
    if (options.input !== undefined) child.stdin.end(options.input);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0 || options.allowFailure) resolve(code ?? 1);
      else reject(new Error(`COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}`));
    });
  });
}
