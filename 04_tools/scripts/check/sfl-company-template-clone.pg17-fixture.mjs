import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const identifier = randomUUID().replaceAll('-', '').slice(0, 16);
const container = `zhudatuan-company-template-clone-${identifier}`;
const database = 'zhudatuan_company_template_clone';
const password = `CompanyClone${identifier}A`;
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
  '02_platform_pingtai/database/supabase/migrations/20260912050000_create_sfl_sovereign_upgrade.sql',
  '02_platform_pingtai/database/supabase/tests/sfl_company_template_clone_bootstrap.sql',
  '02_platform_pingtai/database/supabase/migrations/20260912200000_create_sfl_company_template_clone.sql',
  '02_platform_pingtai/database/supabase/tests/sfl_company_template_clone_contract.sql',
];

try {
  await assertHostedSharedKernelOnly();
  await run('docker', ['info', '--format', '{{.ServerVersion}}'], { quiet: true });
  await run('docker', ['run', '-d', '--rm', '--name', container, '-e', `POSTGRES_PASSWORD=${password}`,
    '-e', `POSTGRES_DB=${database}`, '-p', '127.0.0.1::5432', 'postgres:17-alpine'], { quiet: true });
  await waitForPostgres();
  const sql = await Promise.all(files.map((path) => readFile(join(repositoryRoot, path), 'utf8')));
  await execute(sql.join('\n'));
  console.log('SFL company template clone PostgreSQL 17 acceptance passed: complete independent company, shared Hosted kernel, cross-Realm membership isolation, replay, different keys, two rollback recoveries, no business-history copy, immutable source');
} finally {
  await run('docker', ['rm', '-f', container], { allowFailure: true, quiet: true });
}

async function assertHostedSharedKernelOnly() {
  const paths = [
    '02_platform_pingtai/database/supabase/migrations/20260912200000_create_sfl_company_template_clone.sql',
    '01_core_hexin/services/commerce/src/modules/provisioning/03_application_yingyong/CloneCompanyTemplate.ts',
    '01_core_hexin/services/commerce/src/modules/provisioning/03_application_yingyong/CompanyTemplateCloneWorkflow.ts',
  ];
  const source = (await Promise.all(paths.map((path) => readFile(join(repositoryRoot, path), 'utf8')))).join('\n');
  const forbidden = /NodeManifest|runtime_instance|release_pointer|systemd|rsync|candidate_release|current_release|previous_release|spawn\(|listen\(/i;
  const match = source.match(forbidden);
  if (match) throw new Error(`SFL_COMPANY_TEMPLATE_CLONE_INFRASTRUCTURE_REFERENCE_FORBIDDEN:${match[0]}`);
  if (!source.includes("'shared_host'") || !source.includes("'hosted_path'")
    || !source.includes('infrastructure_action_count')) {
    throw new Error('SFL_COMPANY_TEMPLATE_CLONE_SHARED_HOST_EVIDENCE_MISSING');
  }
}

function execute(input) {
  return run('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-f', '-'],
    { input });
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const ready = await run('docker', ['exec', container, 'psql', '-X', '-U', 'postgres', '-d', database, '-c', 'select 1'],
      { allowFailure: true, quiet: true });
    if (ready === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('SFL_COMPANY_TEMPLATE_CLONE_POSTGRES_NOT_READY');
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
