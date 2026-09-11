import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const identifier = randomUUID().replaceAll('-', '').slice(0, 16);
const container = `zhudatuan-member-registration-${identifier}`;
const database = 'zhudatuan_member_registration';
const password = `MemberRegistration${identifier}A`;

try {
  await run('docker', ['info', '--format', '{{.ServerVersion}}'], { quiet: true });
  await run('docker', ['run', '-d', '--rm', '--name', container, '-e', `POSTGRES_PASSWORD=${password}`,
    '-e', `POSTGRES_DB=${database}`, '-p', '127.0.0.1::5432', 'postgres:17-alpine'], { quiet: true });
  await waitForPostgres();
  const files = [
    '02_platform_pingtai/database/supabase/tests/sfl_hosted_node_provisioning_bootstrap.sql',
    '02_platform_pingtai/database/supabase/migrations/20260911200000_create_sfl_node_sovereignty.sql',
    '02_platform_pingtai/database/supabase/migrations/20260911210000_create_sfl_hosted_node_provisioning.sql',
    '02_platform_pingtai/database/supabase/migrations/20260912010000_create_sfl_node_context_scope.sql',
    '02_platform_pingtai/database/supabase/tests/sfl_member_registration_progression_bootstrap.sql',
    '02_platform_pingtai/database/supabase/migrations/20260912020000_create_sfl_member_registration_progression.sql',
    '02_platform_pingtai/database/supabase/tests/sfl_member_registration_progression_contract.sql',
  ];
  const sql = await Promise.all(files.map((path) => readFile(join(repositoryRoot, path), 'utf8')));
  await run('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-f', '-'], {
    input: sql.join('\n'),
  });
  const concurrentRequest = {
    registration_id: `registration:concurrent:${identifier}`,
    business_number: `SFLREG-CONCURRENT-${identifier}`,
    idempotency_key: `concurrent-${identifier}`,
    registration_origin: 'direct',
    registration_host_node_id: 'node:zhudatuan:l0',
    invitation_token_hash: null,
    business_identity_hash: identifier.padEnd(64, 'a'),
    node_key: `concurrent-${identifier}`,
    realm_id: `realm:concurrent-${identifier}`,
    membership_id: `membership:concurrent:${identifier}`,
    requested_by: `principal:concurrent:${identifier}`,
    trace_id: `trace:concurrent:${identifier}`,
  };
  const concurrentSql = `set role zhudatuanidentityapi; select outcome,node_id,replayed from organization.register_hosted_member_node('${JSON.stringify(concurrentRequest)}'::jsonb);`;
  await Promise.all(Array.from({ length: 5 }, () => run('docker', [
    'exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-f', '-'
  ], { input: concurrentSql, quiet: true })));
  const retryRequest = {
    ...concurrentRequest,
    registration_id: `registration:retry:${identifier}`,
    business_number: `SFLREG-RETRY-${identifier}`,
    idempotency_key: `retry-${identifier}`,
    business_identity_hash: identifier.padEnd(64, 'b'),
    node_key: `retry-${identifier}`,
    realm_id: `realm:retry-${identifier}`,
    membership_id: `membership:retry:${identifier}`,
  };
  const verificationSql = `
do $verify$
declare changed jsonb:='${JSON.stringify({ ...concurrentRequest, business_identity_hash: identifier.padEnd(64, 'c') })}'::jsonb;
declare conflict jsonb:='${JSON.stringify({ ...concurrentRequest, registration_id: `registration:conflict:${identifier}`, business_number: `SFLREG-CONFLICT-${identifier}`, idempotency_key: `conflict-${identifier}`, node_key: `conflict-${identifier}`, realm_id: `realm:conflict-${identifier}`, membership_id: `membership:conflict:${identifier}` })}'::jsonb;
begin
  if (select count(*) from organization.membernoderegistration where idempotency_key='${concurrentRequest.idempotency_key}')<>1 then
    raise exception 'SFL_MEMBER_REGISTRATION_FIVE_WAY_CONCURRENCY_INVALID';
  end if;
  begin perform organization.register_hosted_member_node(changed); raise exception 'EXPECTED_IDEMPOTENCY_CONFLICT';
  exception when others then if sqlerrm<>'SFL_MEMBER_REGISTRATION_IDEMPOTENCY_KEY_REUSED' then raise; end if; end;
  begin perform organization.register_hosted_member_node(conflict); raise exception 'EXPECTED_IDENTITY_CONFLICT';
  exception when others then if sqlerrm<>'SFL_MEMBER_REGISTRATION_IDENTITY_CONFLICT' then raise; end if; end;
end $verify$;
begin;
select * from organization.register_hosted_member_node('${JSON.stringify(retryRequest)}'::jsonb);
rollback;
select * from organization.register_hosted_member_node('${JSON.stringify(retryRequest)}'::jsonb);
do $retry$
begin
  if (select count(*) from organization.membernoderegistration where idempotency_key='${retryRequest.idempotency_key}')<>1
    or (select count(*) from organization.node where id='node:${retryRequest.node_key}:l6')<>1
    or (select count(*) from organization.noderelation where node_id='node:${retryRequest.node_key}:l6')<>1 then
    raise exception 'SFL_MEMBER_REGISTRATION_ROLLBACK_RETRY_INVALID';
  end if;
end $retry$;`;
  await run('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-f', '-'], {
    input: verificationSql,
  });
  console.log('SFL member registration progression PostgreSQL 17 acceptance passed: direct=L0/L3/L5→L6 invitation=L6-L10→L7-L11 L11=boundary hosted=data-only');
} finally {
  await run('docker', ['rm', '-f', container], { allowFailure: true, quiet: true });
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const ready = await run('docker', ['exec', container, 'pg_isready', '-U', 'postgres', '-d', database], { allowFailure: true, quiet: true });
    const databaseReady = ready === 0
      ? await run('docker', ['exec', container, 'psql', '-X', '-U', 'postgres', '-d', database, '-c', 'select 1'], { allowFailure: true, quiet: true })
      : 1;
    if (databaseReady === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('MEMBER_REGISTRATION_POSTGRES_NOT_READY');
}

function run(command, arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: repositoryRoot,
      env: process.env,
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
