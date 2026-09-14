import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const systemdRoot = join(projectRoot, '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd');
const adapter = JSON.parse(await readFile(join(projectRoot, '02_platform_pingtai/infrastructure/release/zdt-next.release.json'), 'utf8'));
const policy = JSON.parse(await readFile(join(projectRoot, '02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json'), 'utf8'));
const deployWorkflow = await readFile(join(projectRoot, '.github/workflows/legacy-direct-recovery-aliyun.yml'), 'utf8');
const deployOssWorkflow = await readFile(join(projectRoot, '.github/workflows/legacy-oss-recovery-aliyun.yml'), 'utf8');
const preparedDeployWorkflow = await readFile(join(projectRoot, '.github/workflows/deploy-prepared-aliyun.yml'), 'utf8');
const baselineRegistrationWorkflow = await readFile(join(projectRoot, '.github/workflows/register-current-baseline-aliyun.yml'), 'utf8');
const prepareWorkflow = await readFile(join(projectRoot, '.github/workflows/prepare-artifact-aliyun.yml'), 'utf8');
const releaseEngine = await readFile(join(projectRoot, '04_tools/release-engine/src/engine.mjs'), 'utf8');
const deployNow = await readFile(join(projectRoot, 'scripts/deploy-now.sh'), 'utf8');
const deployPrepared = await readFile(join(projectRoot, 'scripts/deploy-prepared.sh'), 'utf8');
const prepareRelease = await readFile(join(projectRoot, 'scripts/prepare-release.sh'), 'utf8');
const preparedKnownHosts = await readFile(join(projectRoot, '02_platform_pingtai/infrastructure/release/zdt-next.ssh-known-hosts'), 'utf8');
const qualityWorkflow = await readFile(join(projectRoot, '.github/workflows/quality-aliyun.yml'), 'utf8');
const githubTransportInstaller = await readFile(join(projectRoot, '02_platform_pingtai/infrastructure/github-actions-runner/install-github-transport.sh'), 'utf8');
const storefrontUnit = await readFile(join(systemdRoot, 'sfl-storefront@.service'), 'utf8');
const storefrontPackage = JSON.parse(await readFile(join(projectRoot, '01_core_hexin/apps/storefront-web/package.json'), 'utf8'));
const storefrontRuntimeBuilder = await readFile(join(projectRoot, '01_core_hexin/apps/storefront-web/scripts/build-production-runtime.mjs'), 'utf8');
const databaseMigrationExecutor = await readFile(join(projectRoot, '04_tools/release-engine/adapters/zdt-next/database-migration-executor.mjs'), 'utf8');

test('production acceptance is fixed to the eight retained domains', () => {
  assert.equal(adapter.productionAcceptance.domains.length, 8);
  assert.equal(new Set(adapter.productionAcceptance.domains).size, 8);
  assert.deepEqual(adapter.productionAcceptance.domains, ['accounts.zhudatuan.com', 'api.zhudatuan.com', 'console.zhudatuan.com', 'www.zhudatuan.com', 'zhudatuan.com', 'hbbtzn.com', 'www.hbbtzn.com', 'console.hbbtzn.com']);
  assert.equal(policy.caddyConfig, '/etc/caddy/Caddyfile');
  assert.equal(policy.minimumFreeBytes, 15 * 1024 ** 3);
  assert.deepEqual(policy.lifecycleUnits, ['zhudatuan-release-policy.timer', 'zhudatuan-release-policy.path']);
});

test('legacy 1.2 recovery remains visibly separate from normal 1.3.2 deployment', () => {
  for (const workflow of [deployWorkflow, deployOssWorkflow]) {
    assert.doesNotMatch(workflow, /legacy_1_2_ack|LEGACY_1_2_ACK/);
    assert.match(workflow, /npm ci/);
  }
  assert.match(deployWorkflow, /^name: Legacy 1\.2 Recovery - Direct Aliyun/m);
  assert.match(deployOssWorkflow, /^name: Legacy 1\.2 Recovery - Wuhan OSS via Aliyun Runner/m);
  assert.match(deployOssWorkflow, /commerce-api\|identity-api\|workers/);
});

test('Console retains optional public acceptance metadata while Prepare and Deploy 1.3.2 remain exact single-target channels', () => {
  assert.deepEqual(adapter.nodes['zhudatuan-l0'].deployments.console.publicAcceptance, {
    url: 'https://console.fufu.wang/',
    allowedStatuses: [200],
    timeoutMs: 12000,
  });
  assert.deepEqual(adapter.nodes['hbbtzn-l1'].deployments.console.publicAcceptance, {
    url: 'https://console.hbbtzn.com/',
    allowedStatuses: [200],
    timeoutMs: 12000,
  });
  assert.match(preparedDeployWorkflow, /validate-prepared/);
  assert.match(preparedDeployWorkflow, /deploy-prepared/);
  assert.match(preparedDeployWorkflow, /head_sha:[\s\S]*?required: true/);
  assert.match(preparedDeployWorkflow, /release_target:[\s\S]*?required: true[\s\S]*?type: choice/);
  assert.match(preparedDeployWorkflow, /\^\[0-9a-f\]\{40\}\$/);
  assert.equal((preparedDeployWorkflow.match(/--target "\$RELEASE_TARGET"/g) ?? []).length, 1);
  assert.doesNotMatch(preparedDeployWorkflow, /affected|target_args|inputs\.head_sha \|\||inputs\.release_target \|\|/);
  assert.doesNotMatch(preparedDeployWorkflow, /Affected Delivery|external_baseline|approve-production|npm ci|release -- (?:build|package|publish)/);
  assert.doesNotMatch(preparedDeployWorkflow, /ssh-keyscan|production[_-]approval|zdt-next:prepared-deploy:/);
  assert.match(preparedDeployWorkflow, /zdt-next\.ssh-known-hosts/);
  assert.match(preparedDeployWorkflow, /StrictHostKeyChecking yes/);
  assert.match(preparedDeployWorkflow, /--expected-remote-agent-sha256 "\$expected_agent_sha256"/);
  assert.match(preparedDeployWorkflow, /--expected-remote-policy-sha256 "\$expected_policy_sha256"/);
  assert.match(preparedDeployWorkflow, /zdt-next\.remote-policy\.json/);
  assert.match(preparedDeployWorkflow, /d\.hostedBy&&d\.hostedBy!==process\.env\.RELEASE_NODE/);
  assert.equal((preparedDeployWorkflow.match(/uses: actions\/checkout@v6/g) ?? []).length, 1);
  assert.match(preparedDeployWorkflow, /id: checkout_control[\s\S]*?continue-on-error: true/);
  assert.match(preparedDeployWorkflow, /if: steps\.checkout_control\.outcome == 'failure'/);
  assert.match(preparedDeployWorkflow, /git -c protocol\.version=1 fetch[\s\S]*?--depth=1[\s\S]*?origin "\$CONTROL_SHA"/);
  assert.match(preparedDeployWorkflow, /test "\$\(git rev-parse HEAD\)" = "\$CONTROL_SHA"/);
  assert.match(preparedKnownHosts, /^123\.57\.232\.253 ssh-ed25519 AAAA[0-9A-Za-z+/]+={0,2}$/m);
  assert.match(prepareWorkflow, /--prepare/);
  assert.match(prepareWorkflow, /npm ci/);
  assert.match(prepareWorkflow, /release -- build/);
  assert.match(prepareWorkflow, /release -- package/);
  assert.match(prepareWorkflow, /release -- publish/);
  assert.equal((prepareWorkflow.match(/packageCache!=='miss'/g) ?? []).length, 1);
  assert.match(prepareWorkflow, /run_cold_prepare cold-a/);
  assert.match(prepareWorkflow, /run_cold_prepare cold-b/);
  assert.match(prepareWorkflow, /if ! left_package=/);
  assert.match(prepareWorkflow, /if ! right_package=/);
  assert.match(prepareWorkflow, /stopped during plan/);
  assert.match(prepareWorkflow, /stopped during build/);
  assert.match(prepareWorkflow, /stopped during package/);
  assert.match(prepareWorkflow, /verify-reproducibility/);
  assert.match(prepareWorkflow, /SHOP_BUILD_COMMIT="\$RELEASE_SHA"/);
  assert.match(prepareWorkflow, /SHOP_BUILD_BRANCH="zdt-next"/);
  assert.match(prepareWorkflow, /SHOP_BUILD_DIRTY="false"/);
  assert.match(prepareWorkflow, /SHOP_BUILD_ID="\$\{RELEASE_SHA:0:12\}"/);
  assert.match(prepareWorkflow, /SHOP_BUILD_AT="\$\(git show -s --format=%cI "\$RELEASE_SHA"\)"/);
  assert.ok(prepareWorkflow.indexOf('SHOP_BUILD_AT=') < prepareWorkflow.indexOf('run_cold_prepare cold-a'));
  assert.match(prepareWorkflow, /ubuntu-24\.04/);
  assert.match(prepareWorkflow, /NPM_VERSION: 10\.9\.4/);
  assert.equal((prepareWorkflow.match(/uses: actions\/checkout@v6/g) ?? []).length, 1);
  assert.match(prepareWorkflow, /id: checkout_source[\s\S]*?continue-on-error: true/);
  assert.match(prepareWorkflow, /if: steps\.checkout_source\.outcome == 'failure'/);
  assert.match(prepareWorkflow, /git -c protocol\.version=1 fetch[\s\S]*?--depth=2[\s\S]*?origin "\$RELEASE_SHA"/);
  assert.match(prepareWorkflow, /test "\$\(git rev-parse HEAD\)" = "\$RELEASE_SHA"/);
  for (const workflow of [prepareWorkflow, preparedDeployWorkflow]) {
    assert.match(workflow, /GIT_CONFIG_KEY_0: http\.version/);
    assert.match(workflow, /GIT_CONFIG_VALUE_0: HTTP\/1\.1/);
    assert.match(workflow, /GIT_HTTP_LOW_SPEED_LIMIT: 1024/);
    assert.match(workflow, /GIT_HTTP_LOW_SPEED_TIME: 20/);
  }
  assert.match(githubTransportInstaller, /Environment=GIT_HTTP_LOW_SPEED_LIMIT=1024/);
  assert.match(githubTransportInstaller, /Environment=GIT_HTTP_LOW_SPEED_TIME=20/);
  assert.doesNotMatch(prepareWorkflow, /release_node|deploy-prepared|ZDT_RELEASE_SSH_HOST/);
});

test('legacy direct recovery retains the isolated H6 CDN channel', () => {
  assert.match(deployWorkflow, /--direct/);
  assert.match(deployWorkflow, /head_sha:[\s\S]*?required: true/);
  assert.match(deployWorkflow, /release_target:[\s\S]*?required: true[\s\S]*?type: choice/);
  assert.match(deployWorkflow, /\^\[0-9a-f\]\{40\}\$/);
  assert.equal((deployWorkflow.match(/--target "\$RELEASE_TARGET"/g) ?? []).length, 3);
  assert.match(deployWorkflow, /- h6-cdn/);
  assert.match(deployWorkflow, /cli\.mjs channel[\s\S]*?--action deploy/);
  assert.match(deployWorkflow, /ALIYUN_CDN_ACCESS_KEY_ID:[\s\S]*?CLOUDFLARE_API_TOKEN:/);
  assert.doesNotMatch(deployWorkflow, /affected|target_args|inputs\.head_sha \|\||inputs\.release_target \|\|/);
  assert.doesNotMatch(deployWorkflow, /Affected Delivery|external_baseline|approve-production/);
  assert.equal((deployWorkflow.match(/^  [a-z][a-z0-9_-]*:\s*$/gm) ?? []).filter((line) => line.trim() !== 'workflow_dispatch:').length, 1);
});

test('normal scripts expose only the 1.3.2 prepare and atomic-deploy sequence', () => {
  assert.match(deployNow, /exec "\$script_dir\/deploy-prepared\.sh" "\$@"/);
  assert.doesNotMatch(deployNow, /legacy|deploy\.yml|npm ci|build|git push/);
  assert.match(deployPrepared, /gh workflow run deploy-prepared-aliyun\.yml --ref zdt-next/);
  assert.match(deployPrepared, /d\.hostedBy&&d\.hostedBy!==node/);
  assert.doesNotMatch(deployPrepared, /production[_-]approval|zdt-next:prepared-deploy:/);
  assert.match(prepareRelease, /gh workflow run "\$WORKFLOW_PREPARE" --ref zdt-next/);
  assert.match(prepareRelease, /operation=validate-candidate/);
  assert.match(prepareRelease, /Candidate sealed\. Production was not switched\./);
  assert.doesNotMatch(prepareRelease, /operation=deploy|legacy|git push/);
});

test('1.3.2 accepts only source commits in the exact zdt-next history', () => {
  for (const workflow of [prepareWorkflow, preparedDeployWorkflow]) {
    assert.match(workflow, /CONTROL_SHA: \$\{\{ github\.sha \}\}/);
    assert.match(workflow, /CONTROL_REF: \$\{\{ github\.ref \}\}/);
    assert.match(workflow, /\[ "\$CONTROL_REF" != "refs\/heads\/zdt-next" \]/);
    assert.match(workflow, /compare\/\$\{RELEASE_SHA\}\.\.\.\$\{CONTROL_SHA\}/);
    assert.match(workflow, /--jq '\.merge_base_commit\.sha'/);
    assert.match(workflow, /\[ "\$merge_base" != "\$RELEASE_SHA" \]/);
  }
  assert.match(deployPrepared, /compare\/\$\{SHA\}\.\.\.zdt-next/);
  assert.match(deployPrepared, /\[ "\$ZDT_NEXT_MERGE_BASE" != "\$SHA" \]/);
});

test('legacy baseline registration is isolated from build, deploy, restart and pointer switching', () => {
  assert.match(baselineRegistrationWorkflow, /^name: Register Legacy Production Baseline/m);
  assert.match(baselineRegistrationWorkflow, /register-current-baseline/);
  assert.match(baselineRegistrationWorkflow, /options:[\s\S]*?- database-migration/);
  assert.match(baselineRegistrationWorkflow, /legacy_artifact_sha256:[\s\S]*?required: true/);
  assert.match(baselineRegistrationWorkflow, /legacy_run_id:[\s\S]*?required: true/);
  assert.match(baselineRegistrationWorkflow, /CONTROL_REF: \$\{\{ github\.ref \}\}/);
  assert.match(baselineRegistrationWorkflow, /refs\/heads\/zdt-next/);
  assert.match(baselineRegistrationWorkflow, /--expected-remote-agent-sha256 "\$expected_agent_sha256"/);
  assert.match(baselineRegistrationWorkflow, /--expected-remote-policy-sha256 "\$expected_policy_sha256"/);
  assert.equal((baselineRegistrationWorkflow.match(/^  [a-z][a-z0-9_-]*:\s*$/gm) ?? []).filter((line) => line.trim() !== 'workflow_dispatch:').length, 1);
  assert.doesNotMatch(baselineRegistrationWorkflow, /npm ci|release -- (?:build|package|publish|deploy)|deploy-prepared|validate-prepared|ALIYUN_OSS|ssh-keyscan/);
  assert.match(releaseEngine, /register-current-baseline-v3/);
  assert.match(releaseEngine, /CURRENT_BASELINE_SOURCE_NOT_ON_MAINLINE/);
  assert.match(releaseEngine, /actions\/runs\/\$\{legacyRunId\}\/attempts\/\$\{legacyRunAttempt\}\/jobs\?per_page=100/);
  assert.match(releaseEngine, /actions\/jobs\/\$\{job\.id\}\/logs/);
  assert.doesNotMatch(releaseEngine, /'gh', 'run', 'view', legacyRunId/);
});

test('build and remote adapters agree on every pointer and process', () => {
  for (const [nodeKey, node] of Object.entries(adapter.nodes)) {
    for (const [target, deployment] of Object.entries(node.deployments)) {
      const remote = policy.nodes[nodeKey]?.deployments?.[target];
      if (deployment.hostedBy) {
        assert.equal(remote, undefined, `${nodeKey}/${target} is declared only by its runtime host`);
        const host = policy.nodes[deployment.hostedBy]?.deployments?.[target];
        assert.ok(host, `missing runtime host deployment ${deployment.hostedBy}/${target}`);
        assert.equal(host.pointerRoot, deployment.pointerRoot, `${nodeKey}/${target} hosted pointer`);
        assert.equal(host.restart.name, deployment.service, `${nodeKey}/${target} hosted service`);
        continue;
      }
      assert.ok(remote, `missing remote deployment ${nodeKey}/${target}`);
      assert.equal(remote.pointerRoot, deployment.pointerRoot, `${nodeKey}/${target} pointer`);
      assert.equal(remote.restart.name, deployment.service, `${nodeKey}/${target} service`);
    }
  }
});

test('remote policy registers each physical pointer exactly once', () => {
  const roots = Object.values(policy.nodes).flatMap((node) => Object.values(node.deployments).map((item) => item.pointerRoot));
  assert.equal(new Set(roots).size, roots.length);
});

test('L1 identity API owns its runtime, pointer, and rollback independently from L0', () => {
  const l0 = adapter.nodes['zhudatuan-l0'].deployments['identity-api'];
  const l1 = adapter.nodes['hbbtzn-l1'].deployments['identity-api'];
  const remote = policy.nodes['hbbtzn-l1'].deployments['identity-api'];
  assert.equal(l1.hostedBy, undefined);
  assert.equal(l1.pointerRoot, '/opt/sfl/nodes/hbbtzn-l1/targets/identity-api');
  assert.equal(l1.service, 'sfl-identity-api@hbbtzn-l1.service');
  assert.notEqual(l1.pointerRoot, l0.pointerRoot);
  assert.notEqual(l1.service, l0.service);
  assert.equal(remote.pointerRoot, l1.pointerRoot);
  assert.equal(remote.restart.name, l1.service);
});

test('L1 web API owns its runtime, pointer, and rollback independently from L0', () => {
  const l0 = adapter.nodes['zhudatuan-l0'].deployments['web-api'];
  const l1 = adapter.nodes['hbbtzn-l1'].deployments['web-api'];
  const remote = policy.nodes['hbbtzn-l1'].deployments['web-api'];
  assert.equal(l1.hostedBy, undefined);
  assert.equal(l1.pointerRoot, '/opt/sfl/nodes/hbbtzn-l1/targets/web-api');
  assert.equal(l1.service, 'sfl-web-api@hbbtzn-l1.service');
  assert.notEqual(l1.pointerRoot, l0.pointerRoot);
  assert.notEqual(l1.service, l0.service);
  assert.equal(remote.pointerRoot, l1.pointerRoot);
  assert.equal(remote.restart.name, l1.service);
});

test('every restartable fast target has a one-time legacy seed and production rollback baseline', () => {
  for (const [nodeKey, node] of Object.entries(policy.nodes)) {
    assert.match(node.legacyRoot, /^\/opt\//, `${nodeKey} legacy root`);
    for (const [target, deployment] of Object.entries(node.deployments)) {
      if (target === 'core' || deployment.restart.kind === 'none') continue;
      assert.ok(Array.isArray(deployment.seedInputs) && deployment.seedInputs.length > 0, `${nodeKey}/${target} seed inputs`);
      assert.notEqual(deployment.allowFirstActivation, true, `${nodeKey}/${target} cannot skip a rollback baseline`);
    }
  }
});

test('every systemd target owns exactly one dependency-isolated restart unit', () => {
  for (const [nodeKey, node] of Object.entries(policy.nodes)) {
    const owners = new Set();
    for (const [target, deployment] of Object.entries(node.deployments)) {
      if (target === 'core' || deployment.restart.kind !== 'systemd') continue;
      assert.match(deployment.restart.name, /^[^\s]+\.service$/, `${nodeKey}/${target} restart unit`);
      assert.equal(deployment.restart.jobMode, 'ignore-dependencies', `${nodeKey}/${target} restart job mode`);
      assert.ok(!owners.has(deployment.restart.name), `${nodeKey}/${target} uniquely owns ${deployment.restart.name}`);
      owners.add(deployment.restart.name);
    }
  }
});

test('gateway and tunnel templates keep ordering without lifecycle propagation', async () => {
  const cases = [
    ['sfl-api-gateway@.service', 'sfl-storefront@%i.service'],
    ['sfl-cloudflared@.service', 'sfl-api-gateway@%i.service'],
  ];
  for (const [name, orderedUnit] of cases) {
    const source = await readFile(join(systemdRoot, name), 'utf8');
    assert.doesNotMatch(source, /^(Requires|Requisite|BindsTo|PartOf|ConsistsOf|PropagatesReloadTo|PropagatesReloadFrom)=/m, name);
    assert.match(source, new RegExp(`^Wants=.*${orderedUnit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'), `${name} soft dependency`);
    assert.match(source, new RegExp(`^After=.*${orderedUnit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'), `${name} startup ordering`);
  }
});

test('every fast target is either node-owned or explicitly hosted by one runtime node', () => {
  for (const [nodeKey, node] of Object.entries(adapter.nodes)) {
    const pointers = [];
    for (const [target, deployment] of Object.entries(node.deployments)) {
      if (target === 'core') continue;
      if (target === 'database-migration') assert.equal(deployment.pointerRoot, '/opt/ai-delivery/database-migrations/zdt-next');
      else assert.match(deployment.pointerRoot, new RegExp(`/${target.replaceAll('-', '\\-')}$`));
      assert.ok(!deployment.pointerRoot.endsWith('/current'), `${nodeKey}/${target} owns a pointer root, not a shared current`);
      if (deployment.hostedBy) {
        const host = adapter.nodes[deployment.hostedBy].deployments[target];
        assert.equal(deployment.pointerRoot, host.pointerRoot, `${nodeKey}/${target} reuses host pointer`);
        assert.equal(deployment.service, host.service, `${nodeKey}/${target} reuses host service`);
      }
      pointers.push(deployment.pointerRoot);
    }
    assert.equal(new Set(pointers).size, pointers.length, `${nodeKey} target pointers are unique`);
  }
  const l0 = new Set(Object.values(adapter.nodes['zhudatuan-l0'].deployments).map((item) => item.pointerRoot));
  for (const item of Object.values(adapter.nodes['hbbtzn-l1'].deployments)) {
    assert.equal(l0.has(item.pointerRoot), Boolean(item.hostedBy), `L1 pointer ownership is explicit: ${item.pointerRoot}`);
  }
});

test('artifacts never carry the repository node_modules tree', () => {
  for (const target of Object.values(adapter.targets)) {
    for (const input of target.artifactInputs) assert.doesNotMatch(input.source, /(^|\/)node_modules(\/|$)/);
  }
});

test('database migration packages the official runner inputs and uses the managed production connection source', () => {
  const target = adapter.targets['database-migration'];
  assert.deepEqual(
    target.build.map((command) => command.argv),
    [['node', '04_tools/release-engine/adapters/zdt-next/build-database-migration.mjs']]
  );
  assert.deepEqual(target.artifactInputs, [
    { source: '01_core_hexin/services/commerce/dist/DatabaseMigrationExecutor.js', destination: 'executor/DatabaseMigrationExecutor.js' },
    { source: '01_core_hexin/services/commerce/dist/DatabaseMigrationExecutor.js.map', destination: 'executor/DatabaseMigrationExecutor.js.map' },
    { source: '02_platform_pingtai/database/supabase/migrations', destination: 'database/supabase/migrations' },
    { source: '02_platform_pingtai/database/contracts/history.json', destination: 'database/contracts/history.json' },
  ]);
  const deployment = policy.nodes['zhudatuan-l0'].deployments['database-migration'];
  assert.equal(deployment.restart.kind, 'none');
  assert.equal(deployment.databaseMigration.environmentFile, '/opt/zhudatuan/shared/migration.env');
  assert.equal(deployment.databaseMigration.credentialFile, '/opt/zhudatuan/shared/postgres.env');
  assert.equal(deployment.databaseMigration.executionMode, 'database-owner');
  assert.equal(deployment.databaseMigration.ownerDatabaseHost, '127.0.0.1');
  assert.equal(deployment.databaseMigration.ownerDatabasePort, 55432);
  assert.equal(deployment.databaseMigration.executionRoot, '/opt/zhudatuan/releases');
  assert.equal(deployment.databaseMigration.recovery.mode, 'forward-only');
  assert.equal(deployment.databaseMigration.recovery.snapshot, 'not-captured-by-delivery-engine');
  assert.ok(deployment.candidateChecks.some((check) => check.argv.includes('{{candidateDir}}/executor/DatabaseMigrationExecutor.js')));
  assert.match(databaseMigrationExecutor, /import \{ migrationEnvironment, processEnvironment \} from '@shop\/config\/server';/);
  assert.match(databaseMigrationExecutor, /import \{ MigrationRunner \} from .*\/MigrationRunner\.ts';/);
  assert.match(databaseMigrationExecutor, /MIGRATION_OWNER_DATABASE_HOST/);
  assert.match(databaseMigrationExecutor, /kind: 'database-owner'/);
  assert.doesNotMatch(databaseMigrationExecutor, /RegistrationMigrationRunner|registrationMigrationEnvironment/);
});

test('service definitions use target pointers instead of node-wide code pointers', async () => {
  const units = {
    'sfl-identity-api@.service': 'identity-api',
    'sfl-purchase-api@.service': 'purchase-api',
    'sfl-web-api@.service': 'web-api',
    'sfl-catalog-api@.service': 'catalog-api',
    'sfl-catalog-jobs@.service': 'catalog-jobs',
    'sfl-payment-webhook-api@.service': 'payment-webhook-api',
    'sfl-payment-jobs@.service': 'payment-jobs',
    'sfl-storefront@.service': 'storefront',
  };
  for (const [name, target] of Object.entries(units)) {
    const source = await readFile(join(systemdRoot, name), 'utf8');
    assert.doesNotMatch(source, /\/opt\/sfl\/nodes\/%i\/current\//, name);
    assert.match(source, new RegExp(`/opt/sfl/nodes/%i/targets/${target}/current`), name);
  }

  const l0Units = {
    'zhudatuan-api.service': 'identity-api',
    'zhudatuan-console-support.service': 'support-api',
    'zhudatuan-purchase-api.service': 'purchase-api',
    'zhudatuan-web-api.service': 'web-api',
    'zhudatuan-catalog-api.service': 'catalog-api',
    'zhudatuan-catalog-jobs.service': 'catalog-jobs',
    'zhudatuan-payment-webhook-api.service': 'payment-webhook-api',
    'zhudatuan-payment-jobs.service': 'payment-jobs',
  };
  for (const [name, target] of Object.entries(l0Units)) {
    const source = await readFile(join(systemdRoot, name), 'utf8');
    assert.doesNotMatch(source, /WorkingDirectory=\/opt\/zhudatuan\/current/, name);
    assert.match(source, new RegExp(`/opt/zhudatuan/targets/${target}/current`), name);
    assert.match(source, new RegExp(`ReadOnlyPaths=/opt/zhudatuan/targets/${target}`), name);
  }
});

test('console support managed unit supplies every environment value required before secret resolution', async () => {
  const source = await readFile(join(systemdRoot, 'zhudatuan-console-support.service'), 'utf8');
  assert.match(source, /^Environment=API_PORT=4324$/m);
  assert.match(source, /^Environment=API_ALLOWED_ORIGINS=https:\/\/console\.zhudatuan\.com,https:\/\/console\.hbbtzn\.com$/m);
  assert.match(source, /^EnvironmentFile=\/opt\/zhudatuan\/shared\/console-support\.env$/m);
});

test('storefront ships a self-contained production server and keeps the old runtime only as rollback fallback', () => {
  const storefrontHosts = { 'zhudatuan-l0': 'zhudatuan.com', 'hbbtzn-l1': 'hbbtzn.com' };
  assert.equal(adapter.targets.storefront.dependencyLayer, undefined);
  assert.deepEqual(adapter.targets.storefront.criticalFiles, ['app/dist/start.mjs', 'app/dist/production-runtime.json', 'app/dist/server/index.js']);
  for (const [nodeKey, node] of Object.entries(policy.nodes)) {
    assert.deepEqual(node.deployments.storefront.seedInputs, [{ source: '01_core_hexin/apps/storefront-web/dist', destination: 'app/dist' }]);
    assert.equal(node.deployments.storefront.seedDependencyLayer, undefined);
    assert.ok(node.deployments.storefront.candidateChecks.some((check) => check.argv.includes('{{candidateDir}}/app/dist/start.mjs')));
    assert.ok(node.deployments.storefront.candidateChecks.some((check) => check.argv.includes('{{candidateDir}}/app/dist/server/index.js')));
    const healthArgv = node.deployments.storefront.healthChecks.find((check) => check.argv.includes('curl'))?.argv ?? [];
    assert.ok(healthArgv.includes(`Host: ${storefrontHosts[nodeKey]}`), `${nodeKey} health check carries the real Host boundary`);
    assert.ok(healthArgv.includes(`X-Forwarded-Host: ${storefrontHosts[nodeKey]}`), `${nodeKey} health check carries the forwarded Host boundary`);
  }
  assert.match(storefrontPackage.scripts.build, /build-production-runtime\.mjs/);
  assert.match(storefrontRuntimeBuilder, /bundle: true/);
  assert.match(storefrontRuntimeBuilder, /packages: 'bundle'/);
  assert.match(storefrontRuntimeBuilder, /STOREFRONT_RUNTIME_EXTERNAL_DEPENDENCY/);
  assert.match(storefrontRuntimeBuilder, /__VINEXT_DRAFT_SECRET/);
  assert.match(storefrontRuntimeBuilder, /__VINEXT_PRERENDER_SECRET/);
  assert.match(storefrontRuntimeBuilder, /STOREFRONT_DRAFT_SECRET_SHAPE_CHANGED/);
  assert.match(storefrontRuntimeBuilder, /STOREFRONT_BUILD_ID_SHAPE_CHANGED/);
  assert.match(storefrontRuntimeBuilder, /injected-at-runtime/);
  assert.match(storefrontUnit, /current\/app\/dist\/start\.mjs/);
  assert.match(storefrontUnit, /runtime\/node_modules\/vinext\/dist\/cli\.js/);
  assert.doesNotMatch(storefrontUnit, /^ConditionPathExists=.*runtime\/node_modules/m);
  assert.equal(policy.nodes['zhudatuan-l0'].deployments.storefront.pointerRoot, '/opt/sfl/nodes/zhudatuan-l0/targets/storefront');
  assert.deepEqual(policy.nodes['zhudatuan-l0'].deployments.storefront.restart, {
    kind: 'systemd',
    name: 'sfl-storefront@zhudatuan-l0.service',
    jobMode: 'ignore-dependencies',
  });
  assert.equal(policy.nodes['hbbtzn-l1'].deployments.storefront.restart.jobMode, 'ignore-dependencies');
  assert.deepEqual(policy.readiness, { timeoutMs: 30000, intervalMs: 500, attemptTimeoutMs: 3000, hardFailureGraceMs: 1000 });
});

test('runtime candidate stays inert while explicit runtime mode can cut over only the L1 gateway', async () => {
  const source = await readFile(join(projectRoot, '02_platform_pingtai/infrastructure/release/install-ai-delivery-agent.sh'), 'utf8');
  assert.doesNotMatch(source, /pm2\s+(restart|start|reload|startOrReload)\b/);
  assert.match(source, /systemctl daemon-reload/);
  assert.match(source, /agent-candidate/);
  assert.match(source, /candidate validated without installation/);
  assert.match(source, /i-2zeewhay0farxq8lucrd/);
  assert.match(source, /latest\/meta-data\/instance-id/);
  assert.match(source, /node_scope.*hbbtzn-l1/);
  assert.match(source, /node_scope.*zhudatuan-l0/);
  assert.match(source, /systemctl unmask sfl-identity-api@hbbtzn-l1\.service/);
  assert.match(source, /if \[\[ "\$mode" == runtime \]\]; then/);
  assert.match(source, /active semantic config differs from the single approved 4321-to-4433 transition/);
  assert.match(source, /unapproved-semantic\.diff/);
  assert.match(source, /__SFL_GATEWAY_CADDYFILE__/);
  assert.match(source, /systemctl restart "\$gateway_unit"/);
  assert.match(source, /gateway_companion_unit=sfl-cloudflared@hbbtzn-l1\.service/);
  assert.match(source, /nonTrafficProcesses=unchanged/);
  assert.match(source, /target_root="\$\{pointer%\/\*\}"/);
  assert.match(source, /chmod 0755 "\$target_parent" "\$target_root"/);
});

test('runtime installer uses the same L0 pointers and support unit as the release policy', async () => {
  const installer = await readFile(join(projectRoot, '02_platform_pingtai/infrastructure/release/install-ai-delivery-agent.sh'), 'utf8');
  for (const target of ['identity-api', 'purchase-api', 'web-api', 'catalog-api', 'catalog-jobs', 'payment-webhook-api', 'payment-jobs']) {
    assert.match(installer, new RegExp(`/opt/sfl/nodes/zhudatuan-l0/targets/${target}/current`));
    assert.doesNotMatch(installer, new RegExp(`/opt/zhudatuan/targets/${target}/current`));
  }
  assert.match(installer, /\/opt\/zhudatuan\/targets\/support-api\/current/);
  assert.match(installer, /zhudatuan-console-support\.service/);
});

test('first activation is limited to pointer-only content and migration evidence targets', () => {
  const firstActivations = [];
  for (const [node, nodePolicy] of Object.entries(policy.nodes)) {
    for (const [target, deployment] of Object.entries(nodePolicy.deployments)) {
      if (deployment.allowFirstActivation === true) firstActivations.push(`${node}/${target}`);
    }
  }
  assert.deepEqual(firstActivations.sort(), ['hbbtzn-l1/catalog-media', 'zhudatuan-l0/auth-web', 'zhudatuan-l0/catalog-media', 'zhudatuan-l0/console', 'zhudatuan-l0/database-migration']);
  assert.equal(policy.nodes['zhudatuan-l0'].deployments['auth-web'].restart.kind, 'none');
  assert.equal(policy.nodes['zhudatuan-l0'].deployments.console.restart.kind, 'none');
  assert.equal(policy.nodes['zhudatuan-l0'].deployments['support-api'].allowBaselineImport, true);
});

test('1.3.2 binds the artifact and control-plane provenance in one production action', () => {
  assert.match(preparedDeployWorkflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(preparedDeployWorkflow, /--source-sha "\$RELEASE_SHA"/);
  assert.match(preparedDeployWorkflow, /--control-sha "\$CONTROL_SHA"/);
  assert.match(preparedDeployWorkflow, /--github-run-id "\$GITHUB_RUN_ID"/);
  assert.match(preparedDeployWorkflow, /--github-run-attempt "\$GITHUB_RUN_ATTEMPT"/);
  assert.match(preparedDeployWorkflow, /--expected-remote-agent-sha256/);
  assert.match(preparedDeployWorkflow, /--expected-remote-policy-sha256/);
  assert.match(preparedDeployWorkflow, /^name: Deploy 1\.3\.2 - Aliyun Prepared Artifact/m);
  assert.match(preparedDeployWorkflow, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(releaseEngine, /candidateOnly \? 'validate-oss-candidate-v3' : 'deploy-oss-direct-v2'/);
  assert.match(releaseEngine, /seal-validated-candidate-v3/);
  assert.match(releaseEngine, /PREPARED_SOURCE_DOES_NOT_CONTAIN_CURRENT/);
  assert.match(releaseEngine, /input: `\$\{JSON\.stringify\([\s\S]*?artifactUrl:[\s\S]*?manifestUrl:/);
  assert.match(preparedDeployWorkflow, /--node "\$RELEASE_NODE"/);
  assert.match(preparedDeployWorkflow, /validate-candidate/);
  assert.match(preparedDeployWorkflow, /default: deploy/);
  assert.match(preparedDeployWorkflow, /jobs:\n  prepared:/);
  assert.doesNotMatch(preparedDeployWorkflow, /candidate_run_id|release-candidate-|approve-production|external-baseline|install-production-agent|npm ci|release -- build|release -- package/);
});

test('legacy direct recovery still binds an exact GitHub SHA directly to Aliyun', () => {
  assert.match(deployWorkflow, /ref: \$\{\{ inputs\.head_sha \}\}/);
  assert.match(deployWorkflow, /sha="\$\(git rev-parse HEAD\)"/);
  assert.match(deployWorkflow, /if \[ "\$sha" != "\$RELEASE_SHA" \]/);
  assert.ok(deployWorkflow.indexOf('mkdir -p .direct-release') < deployWorkflow.indexOf('if [ "$RELEASE_TARGET" = "h6-cdn" ]'));
  assert.match(deployWorkflow, /--environment production[\s\S]*?--direct/);
  assert.match(deployWorkflow, /jobs:\n  deploy:/);
  assert.doesNotMatch(deployWorkflow, /candidate_run_id|release-candidate-|approve-production|external-baseline|install-production-agent/);
  assert.match(qualityWorkflow, /^on:\n  workflow_dispatch:/m);
});
