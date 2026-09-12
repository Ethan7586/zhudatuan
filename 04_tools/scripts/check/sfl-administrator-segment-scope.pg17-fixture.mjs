import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const identifier = randomUUID().replaceAll('-', '').slice(0, 16);
const container = `zhudatuan-admin-segment-${identifier}`;
const database = 'zhudatuan_admin_segment';
const password = `Administrator${identifier}A`;
const migrationPath = '02_platform_pingtai/database/supabase/migrations/20260912150000_create_sfl_administrator_segment_scope.sql';
const targetSeparationMigrationPath = '02_platform_pingtai/database/supabase/migrations/20260912230000_separate_permission_write_targets.sql';

try {
  await run('docker', ['info', '--format', '{{.ServerVersion}}'], { quiet: true });
  await run('docker', ['run', '-d', '--rm', '--name', container, '-e', `POSTGRES_PASSWORD=${password}`,
    '-e', `POSTGRES_DB=${database}`, '-p', '127.0.0.1::5432', 'postgres:17-alpine'], { quiet: true });
  await waitForPostgres();
  const files = [
    '02_platform_pingtai/database/supabase/tests/sfl_administrator_segment_scope_bootstrap.sql',
    migrationPath,
    '02_platform_pingtai/database/supabase/tests/permission_write_target_separation_bootstrap.sql',
    targetSeparationMigrationPath,
    '02_platform_pingtai/database/supabase/tests/sfl_administrator_segment_scope_contract.sql',
  ];
  const sql = await Promise.all(files.map((path) => readFile(join(repositoryRoot, path), 'utf8')));
  await run('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-f', '-'], {
    input: sql.join('\n'),
  });

  const concurrent = request('grant', 'both_segments', `scope:concurrent:${identifier}`);
  const fiveWay = await Promise.all(Array.from({ length: 5 }, () => invoke(
    'membership:admin-concurrent', 1, concurrent,
  )));
  if (fiveWay.some((code) => code !== 0)) throw new Error('SFL_ADMIN_SCOPE_FIVE_WAY_CALL_FAILED');

  const races = ['a', 'b'].map((suffix) => invoke(
    'membership:admin-race', 1, request('grant', 'both_segments', `scope:race:${identifier}:${suffix}`), true,
  ));
  const raceResults = await Promise.all(races);
  if (raceResults.filter((code) => code === 0).length !== 1) {
    throw new Error(`SFL_ADMIN_SCOPE_DIFFERENT_KEY_RACE_INVALID:${raceResults.join(',')}`);
  }

  await execute(`do $verify$ begin
    if (select count(*) from access.administratorsegmentchange where administrator_membership_id='membership:admin-concurrent')<>1
      or (select count(*) from access.administratorsegmentscope scope join access.administratoridentity identity
        on identity.id=scope.administrator_identity_id where identity.membership_id='membership:admin-concurrent')<>1
      or (select count(*) from runtime.outbox where event_type='access.administrator.scope.changed'
        and payload->>'administrator_membership_id'='membership:admin-concurrent')<>1
      or (select count(*) from access.administratorsegmentchange where administrator_membership_id='membership:admin-race')<>1
      or (select access_version from access.membership where id='membership:admin-concurrent')<>2
      or (select access_version from access.membership where id='membership:admin-race')<>2 then
      raise exception 'SFL_ADMIN_SCOPE_CONCURRENCY_FACTS_INVALID';
    end if;
  end $verify$;`);

  const source = `${await readFile(join(repositoryRoot, migrationPath), 'utf8')}\n${await readFile(join(repositoryRoot, targetSeparationMigrationPath), 'utf8')}`;
  const forbidden = /update\s+organization\.noderelation|set\s+signed_level|set\s+parent_node_id|hbbtzn|zhudatuan\.com|1[3-9][0-9]{9}/i;
  const match = forbidden.exec(source);
  if (match) throw new Error(`SFL_ADMIN_SCOPE_FORBIDDEN_COUPLING:${match[0]}`);
  if (!source.includes("'first_segment','second_segment','both_segments'")
    || !source.includes('access.administrator_member_visible')
    || !source.includes("relation.signed_level~'^L([0-9]|10|11)$'")) {
    throw new Error('SFL_ADMIN_SCOPE_SHARED_SEMANTICS_MISSING');
  }
  console.log('SFL administrator segment scope PostgreSQL 17 acceptance passed: pre-existing active operator targets only, Realm/governance organization alignment, no identity mutation, L0-L5/L6-L11/both boundaries, rollback and deterministic concurrency');
} finally {
  await run('docker', ['rm', '-f', container], { allowFailure: true, quiet: true });
}

function request(action, segment, idempotencyKey) {
  return { action, role_id: 'role:segment-administrator', segment, root_node_id: 'node:a:l0',
    idempotency_key: idempotencyKey, trace_id: `trace:${idempotencyKey}` };
}

function invoke(targetMembership, expectedVersion, body, allowFailure = false) {
  return run('docker', [
    'exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-f', '-'
  ], {
    input: `set role shopapp; select business_number,scope_version,access_version,replayed from access.change_administrator_segment_scope('membership:owner','${targetMembership}',${expectedVersion},'${JSON.stringify(body)}'::jsonb);`,
    quiet: true,
    allowFailure,
  });
}

function execute(input) {
  return run('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-f', '-'], { input });
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const ready = await run('docker', ['exec', container, 'psql', '-X', '-U', 'postgres', '-d', database, '-c', 'select 1'], { allowFailure: true, quiet: true });
    if (ready === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('SFL_ADMIN_SEGMENT_POSTGRES_NOT_READY');
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
