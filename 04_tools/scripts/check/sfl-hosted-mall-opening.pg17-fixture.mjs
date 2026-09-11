import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const identifier = randomUUID().replaceAll('-', '').slice(0, 16);
const container = `zhudatuan-hosted-mall-opening-${identifier}`;
const database = 'zhudatuan_hosted_mall_opening';
const password = `HostedMall${identifier}A`;

try {
  await assertZeroInfrastructureImplementation();
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
    '02_platform_pingtai/database/supabase/tests/sfl_hosted_mall_opening_bootstrap.sql',
    '02_platform_pingtai/database/supabase/migrations/20260912040000_create_sfl_hosted_mall_opening.sql',
    '02_platform_pingtai/database/supabase/tests/sfl_hosted_mall_opening_contract.sql',
  ];
  const sql = await Promise.all(files.map((path) => readFile(join(repositoryRoot, path), 'utf8')));
  await run('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-f', '-'], {
    input: sql.join('\n'),
  });

  const concurrentRequest = {
    idempotency_key: `opening:concurrent:${identifier}`,
    mall_name: '五路并发商城',
    operating_entity_name: '五路并发经营主体',
  };
  await Promise.all(Array.from({ length: 5 }, () => invokeOpening(
    'membership:concurrent-l6', 'node:concurrent-l6:l6', concurrentRequest,
  )));

  const raceRequests = ['a', 'b'].map((suffix) => ({
    idempotency_key: `opening:race:${identifier}:${suffix}`,
    mall_name: `争抢商城 ${suffix}`,
    operating_entity_name: `争抢经营主体 ${suffix}`,
  }));
  const raceCodes = await Promise.all(raceRequests.map((request) => invokeOpening(
    'membership:race-l6', 'node:race-l6:l6', request, true,
  )));
  if (raceCodes.filter((code) => code === 0).length !== 1) {
    throw new Error(`SFL_HOSTED_MALL_OPENING_DIFFERENT_KEY_RACE_INVALID:${raceCodes.join(',')}`);
  }

  const verification = `
do $verify$
begin
  if (select count(*) from organization.hostedmallopening where node_id='node:concurrent-l6:l6')<>1
    or (select count(*) from organization.nodecapabilityversion where node_id='node:concurrent-l6:l6')<>2
    or (select count(*) from organization.malloperatingentitybinding where node_id='node:concurrent-l6:l6')<>1
    or (select count(*) from organization.hostedmallconfiguration where node_id='node:concurrent-l6:l6')<>1
    or (select count(*) from runtime.outbox where aggregate_id='node:concurrent-l6:l6')<>1
    or (select count(*) from organization.noderelation where node_id='node:concurrent-l6:l6')<>1
    or (select count(*) from organization.hostedmallopening where node_id='node:race-l6:l6')<>1
    or (select count(*) from organization.nodecapabilityversion where node_id='node:race-l6:l6')<>2
    or (select count(*) from organization.noderelation where node_id='node:race-l6:l6')<>1 then
    raise exception 'SFL_HOSTED_MALL_OPENING_CONCURRENCY_INVALID';
  end if;
end $verify$;`;
  await run('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-f', '-'], {
    input: verification,
  });
  console.log('SFL Hosted mall opening PostgreSQL 17 acceptance passed: L3/L6/L8/L11 lineage preservation capability history mall entity config Outbox rollback five-way idempotency different-key race multi-Realm isolation zero infrastructure');
} finally {
  await run('docker', ['rm', '-f', container], { allowFailure: true, quiet: true });
}

async function assertZeroInfrastructureImplementation() {
  const paths = [
    '02_platform_pingtai/database/supabase/migrations/20260912040000_create_sfl_hosted_mall_opening.sql',
    '01_core_hexin/services/commerce/src/modules/member/01_public_gongkai/MemberPort.ts',
    '01_core_hexin/services/commerce/src/modules/member/03_application_yingyong/HostedMallOpeningOperation.ts',
    '01_core_hexin/services/commerce/src/modules/member/03_application_yingyong/MemberOperations.ts',
  ];
  const source = (await Promise.all(paths.map((path) => readFile(join(repositoryRoot, path), 'utf8')))).join('\n');
  const forbidden = /NodeManifest|Domain Binding Set|\bDNS\b|\bTLS\b|\bTunnel\b|runtime_instance|release_pointer|systemd|rsync|deploy|provision_hosted_node\s*\(/i;
  const match = source.match(forbidden);
  if (match) throw new Error(`SFL_HOSTED_MALL_OPENING_INFRASTRUCTURE_REFERENCE_FORBIDDEN:${match[0]}`);
  if (!source.includes('host_sovereign_node_id') || !source.includes("infrastructure_mode='shared_host'")) {
    throw new Error('SFL_HOSTED_MALL_OPENING_SHARED_HOST_EVIDENCE_MISSING');
  }
}

function invokeOpening(membership, node, request, allowFailure = false) {
  return run('docker', [
    'exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-f', '-'
  ], {
    input: `set role zhudatuanwebapi; select opening_id,mall_id,capability_version,replayed from organization.open_hosted_member_mall('${membership}','${node}','${JSON.stringify(request)}'::jsonb);`,
    quiet: true,
    allowFailure,
  });
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const ready = await run('docker', ['exec', container, 'psql', '-X', '-U', 'postgres', '-d', database, '-c', 'select 1'], { allowFailure: true, quiet: true });
    if (ready === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('SFL_HOSTED_MALL_OPENING_POSTGRES_NOT_READY');
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
