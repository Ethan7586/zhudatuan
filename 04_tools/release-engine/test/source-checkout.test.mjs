import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

import { sourceCheckoutPaths } from '../source-checkout-1-7.mjs';

const root = resolve(new URL('../../..', import.meta.url).pathname);

test('exact commerce targets use a Source scope that retains build and test inputs', async () => {
  const project = JSON.parse(await readFile(join(root, '02_platform_pingtai/infrastructure/release/zdt-next.release.json')));
  const paths = sourceCheckoutPaths('identity-api', project.targets);
  for (const path of ['/package-lock.json', '/L-kernel/', '/01_core_hexin/services/commerce/', '/01_core_hexin/extensions/', '/02_platform_pingtai/', '/04_tools/release-engine/']) assert.ok(paths.includes(path));
  assert.ok(paths.includes('/01_core_hexin/apps/*/tsconfig.json'));
  assert.deepEqual(sourceCheckoutPaths('console', project.targets), []);
  assert.deepEqual(sourceCheckoutPaths('database-migration', project.targets), []);
  assert.deepEqual(sourceCheckoutPaths('', project.targets), []);
});

test('workflow and shared action use sparse checkout without an overriding filter', async () => {
  const workflow = parse(await readFile(join(root, '.github/workflows/delivery-1-6.yml'), 'utf8'));
  for (const job of [workflow.jobs.route, workflow.jobs.execute, workflow.jobs['hosted-startup-fallback']]) {
    for (const step of job.steps.filter((item) => item.with?.['sparse-checkout'])) assert.equal(step.with.filter, undefined);
  }
  const action = parse(await readFile(join(root, '.github/actions/runner-1-6/action.yml'), 'utf8'));
  const checkout = action.runs.steps.find((step) => step.name === 'Load exact source');
  assert.equal(checkout.with['sparse-checkout'], '${{ steps.source_scope.outputs.paths }}');
  assert.equal(checkout.with.filter, undefined);
  assert.ok(action.runs.steps.findIndex((step) => step.id === 'source_scope') < action.runs.steps.indexOf(checkout));
  const materialize = action.runs.steps.find((step) => step.name === 'Materialize full Source after reused sparse checkout');
  assert.equal(materialize.if, "inputs.source-sha != '' && (inputs.operation == 'release' || inputs.operation == 'retry') && steps.source_scope.outputs.paths == ''");
  assert.match(materialize.run, /git -C "\$GITHUB_WORKSPACE\/\.runner-1-6\/source" sparse-checkout disable/);
  assert.ok(action.runs.steps.indexOf(checkout) < action.runs.steps.indexOf(materialize));
  assert.ok(action.runs.steps.indexOf(materialize) < action.runs.steps.findIndex((step) => step.id === 'started'));
});

test('full Source recovery materializes a file hidden by a reused sparse index', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'runner-source-checkout-'));
  const source = join(workspace, '.runner-1-6/source');
  const migration = join(source, '04_tools/scripts/audit/migrations.mjs');
  const git = (...args) => execFileSync('git', ['-C', source, ...args], { stdio: 'pipe' });
  try {
    await mkdir(join(source, '04_tools/scripts/audit'), { recursive: true });
    await writeFile(join(source, 'package.json'), '{}\n');
    await writeFile(migration, 'export {};\n');
    execFileSync('git', ['init', source], { stdio: 'pipe' });
    git('add', '.');
    git('-c', 'user.name=Runner Test', '-c', 'user.email=runner@example.invalid', 'commit', '-m', 'fixture');
    git('sparse-checkout', 'set', '--no-cone', '/package.json');
    await assert.rejects(access(migration));
    assert.match(git('ls-files', '-v', '04_tools/scripts/audit/migrations.mjs').toString(), /^S /);

    const action = parse(await readFile(join(root, '.github/actions/runner-1-6/action.yml'), 'utf8'));
    const materialize = action.runs.steps.find((step) => step.name === 'Materialize full Source after reused sparse checkout');
    execFileSync('bash', ['-c', materialize.run], { env: { ...process.env, GITHUB_WORKSPACE: workspace }, stdio: 'pipe' });
    await access(migration);
    assert.match(git('ls-files', '-v', '04_tools/scripts/audit/migrations.mjs').toString(), /^H /);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
