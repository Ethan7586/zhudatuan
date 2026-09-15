import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'yaml';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const workflow = parse(await readFile(join(projectRoot, '.github/workflows/prepare-artifact-aliyun.yml'), 'utf8'));
const prepareStep = workflow.jobs.prepare.steps.find((step) => step.run?.includes('run_cold_prepare()'));
const functionSource = prepareStep?.run.match(/run_cold_prepare\(\) \{[\s\S]*?^\}/m)?.[0];
if (functionSource === undefined) throw new Error('Prepare workflow cold function not found');

const fakeReleaseCli = `#!/usr/bin/env bash
set -euo pipefail
if [ "\$1" != fake-release-cli ]; then exec '${process.execPath}' "\$@"; fi
stage="$2"
printf '%s\\n' "$stage" >> "$FAKE_RELEASE_LOG"
case "$stage" in
  plan) envelope='{"ok":true,"result":{"deployRequired":true,"targets":["target"],"planPath":"plan.json"}}' ;;
  build) envelope='{"ok":true,"result":{"buildPath":"build.json"}}' ;;
  package) envelope='{"ok":true,"result":{"artifacts":[{"packageCache":"miss"}],"packagePath":"package.json"}}' ;;
  *) exit 90 ;;
esac
printf '%s\\n' "$envelope"
if [ "$stage" = "\${FAIL_STAGE:-}" ]; then exit 23; fi
`;

async function runFixture(failStage) {
  const fixture = await mkdtemp(join(tmpdir(), 'zdt-cold-prepare-'));
  const bin = join(fixture, 'bin');
  const log = join(fixture, 'release.log');
  await mkdir(bin);
  await writeFile(join(bin, 'node'), fakeReleaseCli);
  await chmod(join(bin, 'node'), 0o755);
  await writeFile(join(bin, 'date'), '#!/bin/sh\necho 1000\n');
  await chmod(join(bin, 'date'), 0o755);
  const result = spawnSync('bash', ['-c', `set -euo pipefail
base=base
RELEASE_SHA=release
RELEASE_TARGET=target
RELEASE_CLI=fake-release-cli
RELEASE_ADAPTER=adapter.json
GITHUB_WORKSPACE="$PWD"
RUNNER_TEMP="$PWD"
${functionSource}
run_cold_prepare cold-a`], {
    cwd: fixture,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_RELEASE_LOG: log, FAIL_STAGE: failStage },
  });
  return { result, stages: (await readFile(log, 'utf8')).trim().split('\n') };
}

test('cold Prepare stops at the first failed release stage without cascading', async () => {
  for (const [failed, expected] of [
    ['plan', ['plan']],
    ['build', ['plan', 'build']],
    ['package', ['plan', 'build', 'package']],
  ]) {
    const { result, stages } = await runFixture(failed);
    assert.equal(result.status, 23, `${failed} exit status`);
    assert.deepEqual(stages, expected, `${failed} executed stages`);
    assert.match(result.stderr, new RegExp(`stopped during ${failed}`));
    assert.doesNotMatch(result.stderr, /Unexpected end of JSON input|PACKAGE_BUILD_REQUIRED/);
  }
});

test('cold Prepare returns exactly one package path after all stages pass', async () => {
  const { result, stages } = await runFixture('none');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'package.json');
  assert.deepEqual(stages, ['plan', 'build', 'package']);
});
