import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const identifier = randomUUID().replaceAll('-', '').slice(0, 16);
const container = `zhudatuan-multi-realm-${identifier}`;
const database = 'zhudatuan_multi_realm';
const password = `MultiRealm${identifier}A`;

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
    '02_platform_pingtai/database/supabase/tests/sfl_multi_realm_membership_bootstrap.sql',
    '02_platform_pingtai/database/supabase/migrations/20260912030000_create_sfl_multi_realm_membership.sql',
    '02_platform_pingtai/database/supabase/tests/sfl_multi_realm_membership_contract.sql',
  ];
  const sql = await Promise.all(files.map((path) => readFile(join(repositoryRoot, path), 'utf8')));
  await run('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-f', '-'], {
    input: sql.join('\n'),
  });

  const sharedIdentity = identifier.padEnd(64, 'd');
  const requests = [
    {
      registration_id: `registration:concurrent-a:${identifier}`,
      business_number: `SFLREG-CONCURRENT-A-${identifier}`,
      idempotency_key: `concurrent-a-${identifier}`,
      registration_origin: 'direct', registration_host_node_id: 'node:zhudatuan:l0', invitation_token_hash: null,
      business_identity_hash: sharedIdentity, node_key: `concurrent-a-${identifier}`,
      realm_id: `realm:concurrent-a-${identifier}`, membership_id: `membership:concurrent-a:${identifier}`,
      requested_by: `principal:concurrent-a:${identifier}`, trace_id: `trace:concurrent-a:${identifier}`,
    },
    {
      registration_id: `registration:concurrent-b:${identifier}`,
      business_number: `SFLREG-CONCURRENT-B-${identifier}`,
      idempotency_key: `concurrent-b-${identifier}`,
      registration_origin: 'direct', registration_host_node_id: 'node:mall-b:l0', invitation_token_hash: null,
      business_identity_hash: sharedIdentity, node_key: `concurrent-b-${identifier}`,
      realm_id: `realm:concurrent-b-${identifier}`, membership_id: `membership:concurrent-b:${identifier}`,
      requested_by: `principal:concurrent-b:${identifier}`, trace_id: `trace:concurrent-b:${identifier}`,
    },
  ];
  await Promise.all(requests.flatMap((request) => Array.from({ length: 5 }, () => run('docker', [
    'exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-f', '-'
  ], { input: `set role zhudatuanidentityapi; select outcome,node_id,realm_id,membership_id,replayed from organization.register_hosted_member_node('${JSON.stringify(request)}'::jsonb);`, quiet: true }))));

  const verification = `
do $verify$
begin
  if (select count(*) from organization.membernoderegistration where idempotency_key='${requests[0].idempotency_key}')<>1
    or (select count(*) from organization.membernoderegistration where idempotency_key='${requests[1].idempotency_key}')<>1
    or (select count(*) from organization.membernoderegistration where business_identity_hash='${sharedIdentity}')<>2
    or (select count(*) from identity.realm where id in('${requests[0].realm_id}','${requests[1].realm_id}'))<>2
    or (select count(*) from organization.node where id in('node:${requests[0].node_key}:l6','node:${requests[1].node_key}:l6'))<>2
    or (select count(*) from identity.realmtarget where realm_id in('${requests[0].realm_id}','${requests[1].realm_id}'))<>2 then
    raise exception 'SFL_MULTI_REALM_FIVE_WAY_CONCURRENCY_INVALID';
  end if;
end $verify$;`;
  await run('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-f', '-'], {
    input: verification,
  });
  console.log('SFL multi-Realm membership PostgreSQL 17 acceptance passed: same credential A=L6 B=L8 realm-first login single-active-membership five-way concurrency rollback lifecycle isolation');
} finally {
  await run('docker', ['rm', '-f', container], { allowFailure: true, quiet: true });
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const ready = await run('docker', ['exec', container, 'pg_isready', '-U', 'postgres', '-d', database], { allowFailure: true, quiet: true });
    if (ready === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('SFL_MULTI_REALM_POSTGRES_NOT_READY');
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
