import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

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

test('fails closed for unknown or mixed service changes', () => {
  const unknown = classifyChanges(adapter, [change('mystery/file.txt')]);
  assert.equal(unknown.lane, 'A3');
  assert.deepEqual(unknown.targets, ['core']);
  assert.equal(unknown.ambiguous, true);
  assert.match(unknown.reasons.join('\n'), /unclassified/);

  const mixed = classifyChanges(adapter, [
    change('services/api/entry/Main.ts'),
    change('apps/web/App.tsx'),
  ]);
  assert.equal(mixed.lane, 'A3');
  assert.deepEqual(mixed.targets, ['core']);
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

test('keeps the conservative classification when an optional impact package is unavailable', async () => {
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

    const plan = await createPlan(dynamicAdapter, { from: 'HEAD', to: 'HEAD', files: ['services/shared.ts'] });

    assert.equal(plan.lane, 'A3');
    assert.deepEqual(plan.targets, ['core']);
    assert.match(plan.reasons.join('\n'), /dynamic impact services unavailable: missing package release-engine-missing-fixture/);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
