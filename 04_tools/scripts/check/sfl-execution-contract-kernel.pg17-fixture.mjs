import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const identifier = randomUUID().replaceAll('-', '').slice(0, 16);
const container = `zhudatuan-execution-kernel-${identifier}`;
const database = 'zhudatuan_execution_kernel';
const password = `ExecutionKernel${identifier}A`;
const files = [
  '02_platform_pingtai/database/supabase/tests/sfl_execution_contract_kernel_bootstrap.sql',
  '02_platform_pingtai/database/supabase/migrations/20260912170000_create_sfl_execution_contract_kernel.sql',
  '02_platform_pingtai/database/supabase/tests/sfl_execution_contract_kernel_contract.sql',
];

try {
  await run('docker', ['info', '--format', '{{.ServerVersion}}'], { quiet: true });
  await run('docker', ['run', '-d', '--rm', '--name', container, '-e', `POSTGRES_PASSWORD=${password}`,
    '-e', `POSTGRES_DB=${database}`, '-p', '127.0.0.1::5432', 'postgres:17-alpine'], { quiet: true });
  await waitForPostgres();
  const sql = await Promise.all(files.map((path) => readFile(join(repositoryRoot, path), 'utf8')));
  await execute(sql.join('\n'));
  const concurrent = Array.from({ length: 5 }, () => execute(`insert into runtime.idempotency(
    scope,actor_id,key,request_hash,state,expires_at,business_number,execution_state,operation_hash)
    values('scope:concurrent','actor:concurrent','same-key',repeat('e',64),'started',clock_timestamp()+interval '1 hour',
      'SFL-CONCURRENT-ONE','started',repeat('f',64)) on conflict do nothing;`, true));
  await Promise.all(concurrent);
  await execute(`do $verify$ begin
    if (select count(*) from runtime.idempotency where business_number='SFL-CONCURRENT-ONE')<>1 then
      raise exception 'SFL_EXECUTION_FIVE_WAY_IDEMPOTENCY_INVALID';
    end if;
  end $verify$;`);
  console.log('SFL execution contract kernel PostgreSQL 17 acceptance passed: metadata, constraints, grants, RLS, rollback and five-way idempotency');
} finally {
  await run('docker', ['rm', '-f', container], { allowFailure: true, quiet: true });
}

function execute(input, allowFailure = false) {
  return run('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-f', '-'],
    { input, quiet: true, allowFailure });
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const ready = await run('docker', ['exec', container, 'psql', '-X', '-U', 'postgres', '-d', database, '-c', 'select 1'],
      { allowFailure: true, quiet: true });
    if (ready === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('SFL_EXECUTION_POSTGRES_NOT_READY');
}

function run(command, arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, { cwd: repositoryRoot, env: process.env,
      stdio: [options.input === undefined ? 'ignore' : 'pipe', options.quiet ? 'ignore' : 'inherit', options.quiet ? 'ignore' : 'inherit'] });
    if (options.input !== undefined) child.stdin.end(options.input);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0 || options.allowFailure) resolve(code ?? 1);
      else reject(new Error(`COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}`));
    });
  });
}
