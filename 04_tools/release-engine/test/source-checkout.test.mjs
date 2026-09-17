import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
  assert.ok(action.runs.steps.indexOf(checkout) < action.runs.steps.findIndex((step) => step.id === 'started'));
});
