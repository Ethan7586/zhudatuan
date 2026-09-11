import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { loadAdapter } from '../src/adapter.mjs';
import { classifyChanges, createPlan } from '../src/planner.mjs';

const adapter = {
  fallbackTarget: 'core',
  targets: {
    media: { lane: 'A0' },
    web: { lane: 'A1', dependencyLayer: { keyFiles: ['apps/web/package.json'] } },
    api: { lane: 'A2' },
    core: { lane: 'A3' },
  },
  rules: [
    { id: 'docs', lane: 'NONE', include: ['docs/**'] },
    { id: 'media', lane: 'A0', targets: ['media'], include: ['public/media/**'] },
    { id: 'web', lane: 'A1', targets: ['web'], include: ['apps/web/**'] },
    { id: 'api', lane: 'A2', targets: ['api'], include: ['services/api/entry/**'] },
    { id: 'core', lane: 'A3', targets: ['core'], include: ['database/**'], touches: ['database'] },
  ],
};

const change = (path, status = 'M', sourcePath = null) => ({ path, status, sourcePath });

test('classifies the four release lanes and documentation-only changes', () => {
  assert.equal(classifyChanges(adapter, [change('public/media/a.webp')]).lane, 'A0');
  assert.equal(classifyChanges(adapter, [change('apps/web/App.tsx')]).lane, 'A1');
  assert.equal(classifyChanges(adapter, [change('services/api/entry/Main.ts')]).lane, 'A2');
  const database = classifyChanges(adapter, [change('database/001.sql')]);
  assert.equal(database.lane, 'A3');
  assert.deepEqual(database.touches, ['database']);
  assert.equal(classifyChanges(adapter, [change('docs/readme.md')]).lane, 'NONE');
});

test('fails closed for unknown changes and keeps mixed client-service targets affected', () => {
  const unknown = classifyChanges(adapter, [change('mystery/file.txt')]);
  assert.equal(unknown.lane, 'A3');
  assert.deepEqual(unknown.targets, ['core']);
  assert.equal(unknown.ambiguous, true);
  assert.match(unknown.reasons.join('\n'), /unclassified/);

  const mixed = classifyChanges(adapter, [
    change('services/api/entry/Main.ts'),
    change('apps/web/App.tsx'),
  ]);
  assert.equal(mixed.lane, 'A2');
  assert.deepEqual(mixed.targets, ['api', 'web']);
});

test('classifies both sides of a rename', () => {
  const renamed = classifyChanges(adapter, [change('apps/web/new.tsx', 'R100', 'mystery/old.tsx')]);
  assert.equal(renamed.lane, 'A1');
  assert.deepEqual(renamed.targets, ['web']);
});

test('dependency layer key changes always upgrade to A3', () => {
  const dependencyChange = classifyChanges(adapter, [change('apps/web/package.json')]);
  assert.equal(dependencyChange.lane, 'A3');
  assert.deepEqual(dependencyChange.targets, ['core']);
  assert.deepEqual(dependencyChange.touches, ['dependency-layer']);
  assert.match(dependencyChange.reasons.join('\n'), /dependency-layer-key/);
});

test('fails visibly when a dynamic impact dependency is unavailable', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'release-engine-impact-'));
  try {
    await writeFile(join(fixtureRoot, 'missing-impact.mjs'), "import 'release-engine-missing-fixture';\n");
    const dynamicAdapter = {
      project: 'fixture',
      projectRoot: process.cwd(),
      adapterPath: join(fixtureRoot, 'adapter.json'),
      fallbackTarget: 'core',
      targets: {
        core: { lane: 'A3', tests: [], typecheck: [], build: [], artifactInputs: [] },
      },
      nodes: {},
      impactResolvers: {
        services: { module: './missing-impact.mjs' },
      },
      rules: [
        { id: 'shared', lane: 'A3', targets: ['core'], include: ['services/**'], dynamicImpact: 'services' },
      ],
    };

    await assert.rejects(
      () => createPlan(dynamicAdapter, { from: 'HEAD', to: 'HEAD', files: ['services/shared.ts'] }),
      (error) => {
        assert.equal(error.code, 'ERR_MODULE_NOT_FOUND');
        assert.match(error.message, /release-engine-missing-fixture/);
        return true;
      },
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('uses the real commerce dependency graph for shared source changes', async () => {
  const commerceAdapter = await loadAdapter('02_platform_pingtai/infrastructure/release/zdt-next.release.json');
  const singleService = await createPlan(commerceAdapter, {
    from: 'HEAD',
    to: 'HEAD',
    files: ['01_core_hexin/services/commerce/src/modules/member/05_interface_jieru/IdentityOperatorMemberModule.ts'],
  });
  assert.equal(singleService.lane, 'A2');
  assert.deepEqual(singleService.targets, ['identity-api']);
  assert.match(singleService.reasons.join('\n'), /dependency graph selects only identity-api/);
  assert.equal(typeof singleService.planDigest, 'string');

  const multipleServices = await createPlan(commerceAdapter, {
    from: 'HEAD',
    to: 'HEAD',
    files: ['01_core_hexin/services/commerce/src/modules/webbusiness/WebBusinessScopeResolver.ts'],
  });
  assert.equal(multipleServices.lane, 'A2');
  assert.deepEqual(multipleServices.targets, ['purchase-api', 'web-api']);
  assert.match(multipleServices.reasons.join('\n'), /dependency graph selects purchase-api, web-api/);
  assert.equal(typeof multipleServices.planDigest, 'string');

  const sharedTest = await createPlan(commerceAdapter, {
    from: 'HEAD',
    to: 'HEAD',
    files: ['01_core_hexin/services/commerce/src/modules/benefit/06_tests_ceshi/module.manifest.test.ts'],
  });
  assert.equal(sharedTest.lane, 'A3');
  assert.deepEqual(sharedTest.targets, ['core']);
  assert.match(sharedTest.reasons.join('\n'), /shared commerce dependency/);
  assert.equal(typeof sharedTest.planDigest, 'string');
});

test('keeps order export console and commerce changes out of A3', async () => {
  const commerceAdapter = await loadAdapter('02_platform_pingtai/infrastructure/release/zdt-next.release.json');
  const orderExport = await createPlan(commerceAdapter, {
    from: 'HEAD',
    to: 'HEAD',
    files: [
      '01_core_hexin/apps/console/src/feature/order/OrderExportWorkspace.tsx',
      '01_core_hexin/services/commerce/src/modules/reporting/ReportingModule.ts',
      '01_core_hexin/services/commerce/src/modules/reporting/04_adapters_shixian/persistence/PgReportingRepository.ts',
      '01_core_hexin/services/commerce/src/modules/reporting/05_interface_jieru/job/ExportJobRunner.ts',
      '01_core_hexin/services/commerce/src/modules/reporting/06_tests_ceshi/command/ExportDocument.test.ts',
    ],
  });
  assert.equal(orderExport.lane, 'A2');
  assert.deepEqual(orderExport.targets, ['catalog-jobs', 'console', 'payment-jobs']);
  assert.doesNotMatch(orderExport.reasons.join('\n'), /A3/);
});

test('deploys each sovereign node identity runtime independently', async () => {
  const commerceAdapter = await loadAdapter('02_platform_pingtai/infrastructure/release/zdt-next.release.json');
  const plan = await createPlan(commerceAdapter, {
    from: 'HEAD',
    to: 'HEAD',
    files: ['01_core_hexin/services/commerce/src/modules/member/05_interface_jieru/IdentityOperatorMemberModule.ts'],
    nodes: ['hbbtzn-l1', 'zhudatuan-l0'],
  });
  assert.deepEqual(plan.targets, ['identity-api']);
  assert.equal(plan.actions.deployments.length, 2);
  const hbbtzn = plan.actions.deployments.find((item) => item.node === 'hbbtzn-l1');
  assert.equal(hbbtzn.nodeId, 'node:hbbtzn:l1');
  assert.deepEqual(hbbtzn.requestedNodes, ['hbbtzn-l1']);
  assert.equal(hbbtzn.target, 'identity-api');
  assert.equal(hbbtzn.service, 'sfl-identity-api@hbbtzn-l1.service');
  const zhudatuan = plan.actions.deployments.find((item) => item.node === 'zhudatuan-l0');
  assert.equal(zhudatuan.nodeId, 'node:zhudatuan:l0');
  assert.deepEqual(zhudatuan.requestedNodes, ['zhudatuan-l0']);
  assert.equal(zhudatuan.target, 'identity-api');
  assert.equal(zhudatuan.service, 'zhudatuan-api.service');
});

test('keeps release policy and deploy workflow changes in the delivery-tooling lane', async () => {
  const commerceAdapter = await loadAdapter('02_platform_pingtai/infrastructure/release/zdt-next.release.json');
  const classified = classifyChanges(commerceAdapter, [
    change('.github/workflows/deploy.yml'),
    change('02_platform_pingtai/infrastructure/release/zdt-next.release.json'),
    change('02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json'),
  ]);
  assert.equal(classified.lane, 'NONE');
  assert.deepEqual(classified.targets, []);
});

test('routes the hbbtzn support entry to the shared support runtime', async () => {
  const commerceAdapter = await loadAdapter('02_platform_pingtai/infrastructure/release/zdt-next.release.json');
  const plan = await createPlan(commerceAdapter, {
    from: 'HEAD',
    to: 'HEAD',
    files: ['01_core_hexin/services/commerce/src/entry/ConsoleSupportMain.ts'],
    nodes: ['hbbtzn-l1'],
  });
  assert.deepEqual(plan.targets, ['support-api']);
  const deployment = plan.actions.deployments[0];
  assert.equal(deployment.node, 'zhudatuan-l0');
  assert.deepEqual(deployment.requestedNodes, ['hbbtzn-l1']);
  assert.equal(deployment.target, 'support-api');
  assert.equal(deployment.service, 'zhudatuan-console-support.service');
});
