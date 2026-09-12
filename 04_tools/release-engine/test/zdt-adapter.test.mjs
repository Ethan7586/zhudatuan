import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const systemdRoot = join(projectRoot, '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd');
const adapter = JSON.parse(await readFile(join(projectRoot, '02_platform_pingtai/infrastructure/release/zdt-next.release.json'), 'utf8'));
const policy = JSON.parse(await readFile(join(projectRoot, '02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json'), 'utf8'));
const deployWorkflow = await readFile(join(projectRoot, '.github/workflows/deploy.yml'), 'utf8');

test('production acceptance is fixed to the protected fifteen-domain baseline', () => {
  assert.equal(adapter.productionAcceptance.domains.length, 15);
  assert.equal(new Set(adapter.productionAcceptance.domains).size, 15);
  assert.deepEqual(adapter.productionAcceptance.domains.slice(0, 6), [
    'accounts.zhudatuan.com', 'api.zhudatuan.com', 'console.zhudatuan.com',
    'labs.zhudatuan.com', 'www.zhudatuan.com', 'zhudatuan.com',
  ]);
  assert.equal(policy.caddyConfig, '/etc/caddy/Caddyfile');
  assert.equal(policy.minimumFreeBytes, 15 * 1024 ** 3);
  assert.deepEqual(policy.lifecycleUnits, ['zhudatuan-release-policy.timer', 'zhudatuan-release-policy.path']);
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
  assert.deepEqual(target.build.map((command) => command.argv), [
    ['node', '04_tools/release-engine/adapters/zdt-next/build-database-migration.mjs'],
  ]);
  assert.deepEqual(target.artifactInputs, [
    { source: '01_core_hexin/services/commerce/dist/DatabaseMigrationExecutor.js', destination: 'executor/DatabaseMigrationExecutor.js' },
    { source: '01_core_hexin/services/commerce/dist/DatabaseMigrationExecutor.js.map', destination: 'executor/DatabaseMigrationExecutor.js.map' },
    { source: '02_platform_pingtai/database/supabase/migrations', destination: 'database/supabase/migrations' },
    { source: '02_platform_pingtai/database/contracts/history.json', destination: 'database/contracts/history.json' },
  ]);
  const deployment = policy.nodes['zhudatuan-l0'].deployments['database-migration'];
  assert.equal(deployment.restart.kind, 'none');
  assert.equal(deployment.databaseMigration.environmentFile, '/opt/zhudatuan/shared/migration.env');
  assert.equal(deployment.databaseMigration.executionRoot, '/opt/zhudatuan/releases');
  assert.equal(deployment.databaseMigration.recovery.mode, 'forward-only');
  assert.equal(deployment.databaseMigration.recovery.snapshot, 'not-captured-by-delivery-engine');
  assert.ok(deployment.candidateChecks.some((check) => check.argv.includes('{{candidateDir}}/executor/DatabaseMigrationExecutor.js')));
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
  assert.match(source, /^Environment=API_ALLOWED_ORIGINS=https:\/\/console\.zhudatuan\.com$/m);
  assert.match(source, /^EnvironmentFile=\/opt\/zhudatuan\/shared\/console-support\.env$/m);
});

test('storefront seed dependency identity matches the build adapter', () => {
  const expected = adapter.targets.storefront.dependencyLayer;
  const storefrontHosts = { 'zhudatuan-l0': 'zhudatuan.com', 'hbbtzn-l1': 'hbbtzn.com' };
  assert.deepEqual(adapter.targets.storefront.criticalFiles, ['app/dist/server/index.js']);
  for (const [nodeKey, node] of Object.entries(policy.nodes)) {
    assert.deepEqual(node.deployments.storefront.seedInputs, [{ source: '01_core_hexin/apps/storefront-web/dist', destination: 'app/dist' }]);
    assert.ok(node.deployments.storefront.candidateChecks.some((check) => check.argv.includes('{{candidateDir}}/app/dist/server/index.js')));
    const healthArgv = node.deployments.storefront.healthChecks[0].argv;
    assert.ok(healthArgv.includes(`Host: ${storefrontHosts[nodeKey]}`), `${nodeKey} health check carries the real Host boundary`);
    assert.ok(healthArgv.includes(`X-Forwarded-Host: ${storefrontHosts[nodeKey]}`), `${nodeKey} health check carries the forwarded Host boundary`);
    const seeded = node.deployments.storefront.seedDependencyLayer;
    assert.equal(seeded.runtime, expected.runtime);
    assert.deepEqual(seeded.keyFiles, expected.keyFiles);
    assert.equal(seeded.productionRoot, expected.productionRoot);
  }
  assert.equal(policy.nodes['hbbtzn-l1'].deployments.storefront.restart.jobMode, 'ignore-dependencies');
  assert.deepEqual(policy.readiness, { timeoutMs: 30000, intervalMs: 500, attemptTimeoutMs: 3000, hardFailureGraceMs: 1000 });
});

test('runtime installer cannot restart or cut over a service', async () => {
  const source = await readFile(join(projectRoot, '02_platform_pingtai/infrastructure/release/install-ai-delivery-agent.sh'), 'utf8');
  assert.doesNotMatch(source, /systemctl\s+(restart|start|reload)\b/);
  assert.doesNotMatch(source, /pm2\s+(restart|start|reload|startOrReload)\b/);
  assert.match(source, /systemctl daemon-reload/);
  assert.match(source, /agent-candidate/);
  assert.match(source, /candidate validated without installation/);
  assert.match(source, /i-2zeewhay0farxq8lucrd/);
  assert.match(source, /latest\/meta-data\/instance-id/);
  assert.match(source, /node_scope.*hbbtzn-l1/);
  assert.match(source, /node_scope.*zhudatuan-l0/);
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
  assert.deepEqual(firstActivations.sort(), ['hbbtzn-l1/catalog-media', 'zhudatuan-l0/catalog-media', 'zhudatuan-l0/database-migration']);
  assert.equal(policy.nodes['zhudatuan-l0'].deployments['support-api'].allowBaselineImport, true);
});

test('production deployment binds identity to the downloaded candidate package', () => {
  assert.match(deployWorkflow, /p\.sourceSha!==process\.env\.TARGET_SHA/);
  assert.match(deployWorkflow, /release-candidate-\$TARGET_SHA/);
  assert.match(deployWorkflow, /mv \.candidate-download\/\.ai-delivery \.ai-delivery/);
  assert.doesNotMatch(deployWorkflow, /candidate_sha.*TARGET_SHA/);
});
