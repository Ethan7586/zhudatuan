import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { loadAdapter } from '../src/adapter.mjs';
import { classifyChanges, createPlan } from '../src/planner.mjs';
import { resolveImpact as resolveWorkspaceImpact } from '../adapters/zdt-next/workspace-impact.mjs';

const execFileAsync = promisify(execFile);

const target = (kind = 'service') => ({ kind, tests: [], typecheck: [], build: [], artifactInputs: [] });
const adapter = {
  targets: { media: target('content'), web: target('frontend'), api: target(), database: target('migration') },
  rules: [
    { id: 'validation', validationOnly: true, include: ['**/*.md'], targets: [] },
    { id: 'media', include: ['public/media/**'], targets: ['media'] },
    { id: 'web', include: ['apps/web/**'], targets: ['web'] },
    { id: 'api', include: ['services/api/**'], targets: ['api'] },
    { id: 'database', include: ['database/migrations/**'], targets: ['database'], touches: ['database'] },
  ],
};
const change = (path, status = 'M', sourcePath = null) => ({ path, status, sourcePath });

test('classifies changed files directly into runtime targets and validation-only work', () => {
  assert.deepEqual(classifyChanges(adapter, [change('public/media/a.webp')]).targets, ['media']);
  assert.deepEqual(classifyChanges(adapter, [change('apps/web/App.tsx')]).targets, ['web']);
  assert.deepEqual(classifyChanges(adapter, [change('docs/readme.md')]).targets, []);
  const mixed = classifyChanges(adapter, [change('services/api/Main.ts'), change('apps/web/App.tsx')]);
  assert.deepEqual(mixed.targets, ['api', 'web']);
});

test('unrecognized files continue with the reachable runtime upper bound', () => {
  const result = classifyChanges(adapter, [change('mystery/file.txt')]);
  assert.deepEqual(result.targets, ['api', 'media', 'web']);
  assert.deepEqual(result.unknownFiles, ['mystery/file.txt']);
  assert.match(result.reasons.join('\n'), /reachable runtime target upper bound/);
});

test('classifies both sides of a rename without a severity rank', () => {
  assert.deepEqual(classifyChanges(adapter, [change('apps/web/new.tsx', 'R100', 'mystery/old.tsx')]).targets, ['web']);
});

test('fails visibly when a dynamic impact dependency is unavailable', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'release-engine-impact-'));
  try {
    await writeFile(join(fixtureRoot, 'missing-impact.mjs'), "import 'release-engine-missing-fixture';\n");
    const dynamicAdapter = {
      project: 'fixture', projectRoot: process.cwd(), adapterPath: join(fixtureRoot, 'adapter.json'),
      targets: { api: target() }, nodes: {}, impactResolvers: { services: { module: './missing-impact.mjs' } },
      rules: [{ id: 'shared', targets: [], include: ['services/**'], dynamicImpact: 'services' }],
    };
    await assert.rejects(
      () => createPlan(dynamicAdapter, { from: 'HEAD', to: 'HEAD', files: ['services/shared.ts'] }),
      (error) => error.code === 'ERR_MODULE_NOT_FOUND',
    );
  } finally { await rm(fixtureRoot, { recursive: true, force: true }); }
});

test('v1.2R console source plus workspace lock change selects only Console', async () => {
  const real = await loadAdapter('02_platform_pingtai/infrastructure/release/zdt-next.release.json');
  const plan = await createPlan(real, { from: 'HEAD', to: 'HEAD', files: [
    '01_core_hexin/apps/console/src/main.tsx',
    'package-lock.json',
  ] });
  assert.deepEqual(plan.targets, ['console']);
  assert.deepEqual(plan.deploymentOrder, ['console']);
  assert.equal(plan.actions.tests.length, 1);
  assert.equal(plan.actions.typecheck.length, 1);
  assert.equal(plan.actions.build.length, 1);
  assert.deepEqual(plan.artifacts.map((item) => item.target), ['console']);
});

test('workspace lock diff follows an added internal dependency only to Console', async () => {
  const root = await mkdtemp(join(tmpdir(), 'release-engine-workspace-'));
  try {
    const rootPackage = { workspaces: ['apps/*', 'packages/*'] };
    const before = { packages: {
      '': {}, 'apps/console': { name: '@shop/console', dependencies: { '@shop/alpha': '1.0.0' } },
      'apps/other': { name: '@shop/other', dependencies: {} }, 'packages/alpha': { name: '@shop/alpha' },
      'packages/beta': { name: '@shop/beta' },
    } };
    await writeFile(join(root, 'package.json'), JSON.stringify(rootPackage));
    await writeFile(join(root, 'package-lock.json'), JSON.stringify(before));
    await execFileAsync('git', ['init', '-q'], { cwd: root });
    await execFileAsync('git', ['add', 'package.json', 'package-lock.json'], { cwd: root });
    await execFileAsync('git', ['-c', 'user.name=Release Test', '-c', 'user.email=release@test.invalid', 'commit', '-qm', 'baseline'], { cwd: root });
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root });
    const after = structuredClone(before);
    after.packages['apps/console'].dependencies['@shop/beta'] = '1.0.0';
    await writeFile(join(root, 'package-lock.json'), JSON.stringify(after));
    const impact = await resolveWorkspaceImpact({
      adapter: { projectRoot: root, targets: { console: { kind: 'frontend', workspace: '@shop/console' }, other: { kind: 'frontend', workspace: '@shop/other' } } },
      changes: [change('package-lock.json')], refs: { fromSha: stdout.trim(), toSha: 'working-tree' },
    });
    assert.deepEqual(impact.targets, ['console']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('E04 documentation, tests and database fixtures never create a candidate', async () => {
  const real = await loadAdapter('02_platform_pingtai/infrastructure/release/zdt-next.release.json');
  const plan = await createPlan(real, { from: 'HEAD', to: 'HEAD', files: [
    '05_docs_ziliao/docs_wendang/e04.md',
    '01_core_hexin/apps/console/src/feature/e04/E04.test.tsx',
    '03_quality_ceshi/tests/fixtures/e04-database.fixture.sql',
  ] });
  assert.equal(plan.deployRequired, false);
  assert.deepEqual(plan.targets, []);
  assert.deepEqual(plan.artifacts, []);
  assert.equal(plan.actions.deployments.length, 0);
  assert.ok(plan.requiredValidations.length > 0);
});

test('L1 identity control-plane changes require focused validation without rebuilding service code', async () => {
  const real = await loadAdapter('02_platform_pingtai/infrastructure/release/zdt-next.release.json');
  const plan = await createPlan(real, { from: 'HEAD', to: 'HEAD', files: [
    '02_platform_pingtai/config/node-runtime/hbbtzn-l1/api-gateway.Caddyfile',
    '02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json',
  ] });
  assert.equal(plan.deployRequired, false);
  assert.deepEqual(plan.targets, []);
  assert.deepEqual(plan.requiredValidations.map((validation) => validation.name), [
    'release-adapter-boundary',
    'sfl-conformance-matrix',
    'l1-identity-sovereignty-tests',
  ]);
});

test('database migrations are independent and ordered before actual consumers', async () => {
  const real = await loadAdapter('02_platform_pingtai/infrastructure/release/zdt-next.release.json');
  const migrationOnly = await createPlan(real, { from: 'HEAD', to: 'HEAD', files: [
    '02_platform_pingtai/database/supabase/migrations/20990101000000_example.sql',
  ], nodes: ['hbbtzn-l1', 'zhudatuan-l0'] });
  assert.deepEqual(migrationOnly.targets, ['database-migration']);
  assert.deepEqual(migrationOnly.deploymentOrder, ['database-migration']);
  assert.equal(migrationOnly.actions.deployments.length, 1);
  assert.equal(migrationOnly.actions.deployments[0].service, 'none');
  assert.equal(migrationOnly.actions.deployments[0].restart, 'none');

  const withConsumer = await createPlan(real, { from: 'HEAD', to: 'HEAD', files: [
    '02_platform_pingtai/database/supabase/migrations/20990101000000_example.sql',
    '01_core_hexin/services/commerce/src/entry/WebBusinessApiMain.ts',
  ] });
  assert.deepEqual(withConsumer.targets, ['database-migration', 'web-api']);
  assert.deepEqual(withConsumer.deploymentOrder, ['database-migration', 'web-api']);

  for (const file of [
    '02_platform_pingtai/database/supabase/tests/example.sql',
    '02_platform_pingtai/database/supabase/fixtures/example.sql',
    '05_docs_ziliao/docs_wendang/example.sql',
  ]) {
    const validationOnly = await createPlan(real, { from: 'HEAD', to: 'HEAD', files: [file] });
    assert.deepEqual(validationOnly.targets, [], file);
    assert.equal(validationOnly.deployRequired, false, file);
  }
});

test('shared Commerce source expands through real entry graphs without refusal', async () => {
  const real = await loadAdapter('02_platform_pingtai/infrastructure/release/zdt-next.release.json');
  const plan = await createPlan(real, { from: 'HEAD', to: 'HEAD', files: [
    '01_core_hexin/services/commerce/src/modules/webbusiness/WebBusinessScopeResolver.ts',
  ] });
  assert.deepEqual(plan.targets, ['purchase-api', 'web-api']);
  assert.match(plan.reasons.join('\n'), /dependency graph selects purchase-api, web-api/);
});

test('shared Contract package expands through workspace consumers without a global fallback', async () => {
  const real = await loadAdapter('02_platform_pingtai/infrastructure/release/zdt-next.release.json');
  const plan = await createPlan(real, { from: 'HEAD', to: 'HEAD', files: [
    '01_core_hexin/packages/contract/src/index.ts',
  ] });
  assert.ok(plan.targets.includes('console'));
  assert.ok(plan.targets.includes('identity-api'));
  assert.ok(!plan.targets.includes('database-migration'));
  assert.match(plan.reasons.join('\n'), /workspace dependency graph selects/);
});

test('release tooling remains non-deploying and support keeps its physical host', async () => {
  const real = await loadAdapter('02_platform_pingtai/infrastructure/release/zdt-next.release.json');
  assert.deepEqual(classifyChanges(real, [change('.github/workflows/deploy.yml')]).targets, []);
  const plan = await createPlan(real, { from: 'HEAD', to: 'HEAD', files: [
    '01_core_hexin/services/commerce/src/entry/ConsoleSupportMain.ts',
  ], nodes: ['hbbtzn-l1'] });
  assert.deepEqual(plan.targets, ['support-api']);
  assert.equal(plan.actions.deployments[0].node, 'zhudatuan-l0');
});
