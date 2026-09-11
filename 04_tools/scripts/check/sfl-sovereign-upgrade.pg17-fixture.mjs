import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const identifier = randomUUID().replaceAll('-', '').slice(0, 16);
const container = `zhudatuan-sovereign-upgrade-${identifier}`;
const database = 'zhudatuan_sovereign_upgrade';
const password = `Sovereign${identifier}A`;

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
    '02_platform_pingtai/database/supabase/tests/sfl_hosted_mall_opening_bootstrap.sql',
    '02_platform_pingtai/database/supabase/migrations/20260912040000_create_sfl_hosted_mall_opening.sql',
    '02_platform_pingtai/database/supabase/tests/sfl_hosted_mall_opening_contract.sql',
    '02_platform_pingtai/database/supabase/migrations/20260912050000_create_sfl_sovereign_upgrade.sql',
    '02_platform_pingtai/database/supabase/tests/sfl_sovereign_upgrade_contract.sql',
  ];
  const sql = await Promise.all(files.map((path) => readFile(join(repositoryRoot, path), 'utf8')));
  await run('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-f', '-'], {
    input: sql.join('\n'),
  });

  const concurrent = request('upgrade-concurrent', `concurrent-${identifier}`);
  const upgrades = await Promise.all(Array.from({ length: 5 }, () => invoke(
    'membership:upgrade-concurrent', 'node:upgrade-concurrent:l6', concurrent,
  )));
  if (new Set(upgrades.map((upgrade) => upgrade.upgrade_id)).size !== 1
    || upgrades.filter((upgrade) => upgrade.replayed === false).length !== 1) {
    throw new Error('SFL_SOVEREIGN_UPGRADE_FIVE_WAY_IDEMPOTENCY_INVALID');
  }

  const races = ['a', 'b'].map((suffix) => invoke(
    'membership:upgrade-race', 'node:upgrade-race:l11', request('upgrade-race', `race-${identifier}-${suffix}`), true,
  ));
  const raceResults = await Promise.all(races);
  if (raceResults.filter(({ code }) => code === 0).length !== 1) {
    throw new Error(`SFL_SOVEREIGN_UPGRADE_DIFFERENT_KEY_RACE_INVALID:${raceResults.map(({ code }) => code).join(',')}`);
  }

  await execute(`do $verify$ begin
    if (select count(*) from organization.sovereignupgrade where node_id='node:upgrade-concurrent:l6')<>1
      or (select count(*) from organization.nodesovereigntyversion where node_id='node:upgrade-concurrent:l6')<>1
      or (select count(*) from organization.domainbinding binding join organization.domainbindingset binding_set
        on binding_set.binding_set_id=binding.binding_set_id and binding_set.binding_version=binding.binding_version
        where binding_set.node_id='node:upgrade-concurrent:l6')<>5
      or (select count(*) from organization.noderesourcebindingset where node_id='node:upgrade-concurrent:l6')<>1
      or (select count(*) from organization.nodemanifestversion where node_id='node:upgrade-concurrent:l6')<>1
      or (select count(*) from organization.sovereignupgradestep step join organization.sovereignupgrade upgrade
        on upgrade.upgrade_id=step.upgrade_id where upgrade.node_id='node:upgrade-concurrent:l6')<>4
      or (select count(*) from runtime.outbox where event_type='sfl.node.sovereignty_upgraded'
        and aggregate_id='node:upgrade-concurrent:l6')<>1
      or (select count(*) from organization.sovereignupgrade where node_id='node:upgrade-race:l11')<>1 then
      raise exception 'SFL_SOVEREIGN_UPGRADE_CONCURRENCY_FACTS_INVALID';
    end if;
  end $verify$;`);
  console.log('SFL Sovereign upgrade PostgreSQL 17 acceptance passed: L2/L5/L8 identity and lineage preservation, versioned bindings and manifest, Realm isolation, four-step state machine, five-way idempotency, three failure recoveries, rollback, unique resources');
} finally {
  await run('docker', ['rm', '-f', container], { allowFailure: true, quiet: true });
}

function request(key, idempotencyKey) {
  return {
    idempotency_key: `sovereign-upgrade:${idempotencyKey}`,
    brand_ref: `brand:${key}:v1`, public_api_host: `api.${key}.${identifier}.example.com`,
    storefront_host: `shop.${key}.${identifier}.example.com`, accounts_host: `accounts.${key}.${identifier}.example.com`,
    console_host: `console.${key}.${identifier}.example.com`, payment_callback_host: `pay.${key}.${identifier}.example.com`,
    edge_binding_ref: `edge:${key}:${idempotencyKey}`, tunnel_ref: `tunnel:${key}:${idempotencyKey}`,
    gateway_ref: `gateway:${key}:${idempotencyKey}`, runtime_identity_ref: `runtime:${key}:${idempotencyKey}`,
    data_scope_ref: `scope:${key}:${idempotencyKey}`, secret_binding_set_ref: `secrets:${key}:${idempotencyKey}`,
    payment_binding_ref: `payment:${key}:${idempotencyKey}`, callback_binding_ref: `callback:${key}:${idempotencyKey}`,
    runtime_config_ref: `runtime-config:${key}:${idempotencyKey}`,
  };
}

async function invoke(membership, node, payload, allowFailure = false) {
  const sql = `set role zhudatuanwebapi; select row_to_json(result) from organization.upgrade_hosted_mall_to_sovereign('${membership}','${node}','${JSON.stringify(payload)}'::jsonb) result;`;
  const output = await execute(sql, allowFailure, true);
  if (allowFailure) return output;
  return JSON.parse(output.stdout.trim().split('\n').filter(Boolean).at(-1));
}

function execute(input, allowFailure = false, capture = false) {
  return run('docker', ['exec', '-i', container, 'psql', '-X', '-t', '-A', '-v', 'ON_ERROR_STOP=1',
    '-U', 'postgres', '-d', database, '-f', '-'], { input, allowFailure, capture, quiet: !capture });
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const result = await run('docker', ['exec', container, 'psql', '-X', '-U', 'postgres', '-d', database, '-c', 'select 1'],
      { allowFailure: true, quiet: true });
    if (result.code === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('SFL_SOVEREIGN_UPGRADE_POSTGRES_NOT_READY');
}

function run(command, arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const child = spawn(command, arguments_, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: [options.input === undefined ? 'ignore' : 'pipe', options.capture ? 'pipe' : options.quiet ? 'ignore' : 'inherit',
        options.capture ? 'pipe' : options.quiet ? 'ignore' : 'inherit'],
    });
    if (options.capture) {
      child.stdout.on('data', (chunk) => chunks.push(chunk));
      child.stderr.on('data', (chunk) => chunks.push(chunk));
    }
    if (options.input !== undefined) child.stdin.end(options.input);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      const result = { code: code ?? 1, stdout: Buffer.concat(chunks).toString('utf8') };
      if (code === 0 || options.allowFailure) resolve(result);
      else reject(new Error(`COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}:${result.stdout.slice(-1000)}`));
    });
  });
}
