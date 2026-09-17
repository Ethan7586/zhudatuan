import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const id = randomUUID().replaceAll('-', '').slice(0, 12);
const container = `zhudatuan-op-offboard-${id}`;
const password = `Offboard${id}A`;
const database = 'zhudatuan_registration';

try {
  await run('docker', ['info', '--format', '{{.ServerVersion}}']);
  await run('docker', ['run', '-d', '--rm', '--name', container,
    '-e', `POSTGRES_PASSWORD=${password}`, '-e', `POSTGRES_DB=${database}`,
    '-p', '127.0.0.1::5432', 'postgres:17-alpine']);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = await run('docker', ['exec', container, 'pg_isready', '-U', 'postgres', '-d', database], true);
    if (ready.ok) break;
    if (attempt === 59) throw new Error('OP_OFFBOARD_POSTGRES_NOT_READY');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const port = (await run('docker', ['port', container, '5432/tcp'])).output.trim().match(/127\.0\.0\.1:(\d+)/)?.[1];
  if (port === undefined) throw new Error('OP_OFFBOARD_POSTGRES_PORT_MISSING');
  await run(process.execPath, ['04_tools/scripts/audit/database-contracts.mjs', '--identity-realm-isolation',
    `postgresql://postgres:${password}@127.0.0.1:${port}/${database}`, 'local-disposable-fixture']);
  const fixture = await readFile(join(repositoryRoot,
    '02_platform_pingtai/database/supabase/tests/offboard_operator_identity_contract.sql'), 'utf8');
  await run('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1',
    '-U', 'postgres', '-d', database, '-f', '-'], false, fixture);
  console.log('L1 OP lifecycle PostgreSQL 17 passed: senior demotion, offboard, fresh reinvitation, import, MB untouched');
} finally {
  await run('docker', ['rm', '-f', container], true);
}

function run(command, arguments_, allowFailure = false, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, { cwd: repositoryRoot, env: process.env,
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    if (input !== undefined) child.stdin.end(input);
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0 || allowFailure) resolve({ ok: code === 0, output });
      else reject(new Error(`OP_OFFBOARD_FIXTURE_COMMAND_FAILED:${command}:${output.slice(-1200)}`));
    });
  });
}
