import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const source = await readFile(join(root, 'scripts/prepare-release.sh'), 'utf8');
const workflow = parse(await readFile(join(root, '.github/workflows/prepare-artifact-aliyun.yml'), 'utf8'));
const sha = '1'.repeat(40);

async function dispatch(t, runner, failPrepare = false, capacity = { idle: 2, queued: 0 }) {
  const fixture = await mkdtemp(join(tmpdir(), 'zdt-prepare-dispatch-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const bin = join(fixture, 'bin');
  const log = join(fixture, 'calls.jsonl');
  await mkdir(bin);
  await writeFile(join(bin, 'git'), `#!/bin/sh\nprintf '%s\\n' '${sha}'\n`, { mode: 0o755 });
  await writeFile(join(bin, 'gh'), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.DISPATCH_LOG, JSON.stringify(args) + '\\n');
if (args[0] === 'api') {
  if (args[1].includes('/actions/runners')) console.log(process.env.ALIYUN_IDLE_SLOTS);
  else console.log('${sha}');
}
if (args[0] === 'run' && args[1] === 'list') {
  if (args.includes('--status') && args[args.indexOf('--status') + 1] === 'queued') console.log(process.env.ALIYUN_QUEUED_RUNS);
  else if (args[args.indexOf('--limit') + 1] === '1') console.log('100');
  else {
    const prepare = args.includes('prepare-artifact-aliyun.yml');
    const title = prepare
      ? 'Prepare 1.4 ${sha} console' + (process.env.EXPECTED_BUILD_RUNNER === 'github' ? ' [github]' : '')
      : 'Deploy 1.4 validate-candidate ${sha} hbbtzn-l1 console';
    if (!args[args.indexOf('--jq') + 1].includes(title)) process.exit(91);
    console.log(prepare ? '201' : '202');
  }
}
if (args[0] === 'run' && args[1] === 'watch' && args[2] === '201' && process.env.FAIL_PREPARE === '1') process.exit(23);
`, { mode: 0o755 });
  const script = source.replace(/^export PATH=.*$/m, '');
  const result = spawnSync('bash', ['-c', script, 'prepare-release.sh', 'console', sha, 'hbbtzn-l1'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, DISPATCH_LOG: log,
      ZDT_PREPARE_RUNNER: runner ?? '', FAIL_PREPARE: failPrepare ? '1' : '',
      ALIYUN_IDLE_SLOTS: String(capacity.idle), ALIYUN_QUEUED_RUNS: String(capacity.queued),
      EXPECTED_BUILD_RUNNER: runner === 'github' || ((runner === undefined || runner === 'auto') && capacity.idle <= capacity.queued) ? 'github' : 'aliyun' },
  });
  const calls = (await readFile(log, 'utf8').catch(() => '')).trim().split('\n').filter(Boolean).map(JSON.parse);
  return { result, calls };
}

test('manual Prepare defaults to Aliyun and preserves the explicit GitHub fallback', () => {
  const input = workflow.on.workflow_dispatch.inputs.build_runner;
  assert.equal(input.default, 'aliyun');
  assert.deepEqual(input.options, ['aliyun', 'github']);
  const expression = workflow.jobs.prepare['runs-on'].slice(3, -2);
  const select = new Function('inputs', 'fromJSON', `return (${expression});`);
  assert.deepEqual(select({ build_runner: 'github' }, JSON.parse), ['ubuntu-24.04']);
  assert.deepEqual(select({ build_runner: 'aliyun' }, JSON.parse), ['self-hosted', 'linux', 'x64', 'zdt-aliyun-build']);
  for (const step of workflow.jobs.prepare.steps) {
    assert.doesNotMatch(JSON.stringify(step), /secrets\.ZDT_RELEASE_SSH|operation=deploy|deploy-prepared/);
  }
});

test('automatic routing uses Aliyun capacity first and GitHub when both slots are occupied', async (t) => {
  for (const scenario of [
    { runner: undefined, capacity: { idle: 2, queued: 0 }, selected: 'aliyun' },
    { runner: 'auto', capacity: { idle: 1, queued: 0 }, selected: 'aliyun' },
    { runner: 'auto', capacity: { idle: 0, queued: 0 }, selected: 'github' },
    { runner: 'auto', capacity: { idle: 2, queued: 2 }, selected: 'github' },
    { runner: 'aliyun', capacity: { idle: 0, queued: 0 }, selected: 'aliyun' },
    { runner: 'github', capacity: { idle: 2, queued: 0 }, selected: 'github' },
  ]) {
    const { result, calls } = await dispatch(t, scenario.runner, false, scenario.capacity);
    assert.equal(result.status, 0, result.stderr);
    const runs = calls.filter((args) => args[0] === 'workflow' && args[1] === 'run');
    assert.deepEqual(runs, [
      ['workflow', 'run', 'prepare-artifact-aliyun.yml', '--ref', 'zdt-next', '-f', `head_sha=${sha}`, '-f', 'release_target=console', '-f', `build_runner=${scenario.selected}`, '-f', 'release_node=hbbtzn-l1'],
      ['workflow', 'run', 'deploy-prepared-aliyun.yml', '--ref', 'zdt-next', '-f', `head_sha=${sha}`, '-f', 'release_node=hbbtzn-l1', '-f', 'release_target=console', '-f', 'operation=validate-candidate'],
    ]);
  }
});

test('a failed GitHub build never dispatches sealing or production deployment', async (t) => {
  const { result, calls } = await dispatch(t, 'github', true);
  assert.equal(result.status, 23, result.stderr);
  assert.equal(calls.filter((args) => args[0] === 'workflow' && args[1] === 'run').length, 1);
  assert.ok(!calls.some((args) => args.includes('operation=deploy') || args.includes('operation=validate-candidate')));
});

test('an unsupported runner is rejected before any external dispatch', async (t) => {
  const { result, calls } = await dispatch(t, 'larger-paid-runner');
  assert.equal(result.status, 64);
  assert.deepEqual(calls, []);
});
