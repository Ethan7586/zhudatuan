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
const workflowSource = await readFile(join(root, '.github/workflows/prepare-artifact-aliyun.yml'), 'utf8');
const workflow = parse(workflowSource);
const sha = '1'.repeat(40);

test('manual and reusable Prepare default to the same atomic auto route', () => {
  assert.equal(workflow.on.workflow_dispatch.inputs.build_runner.default, 'auto');
  assert.equal(workflow.on.workflow_call.inputs.build_runner.default, 'auto');
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.build_runner.options, ['auto', 'aliyun', 'github']);
  assert.equal(workflow.jobs.route['runs-on'], 'ubuntu-24.04');
  assert.equal(workflow.jobs.prepare['runs-on'], '${{ fromJSON(needs.route.outputs.runs_on) }}');
  assert.match(workflowSource, /select-runner/);
  assert.doesNotMatch(workflowSource, /larger|xlarge|[1-9][0-9]-core/i);
  for (const step of workflow.jobs.prepare.steps) assert.doesNotMatch(JSON.stringify(step), /secrets\.ZDT_RELEASE_SSH|operation=deploy|deploy-prepared/);
});

test('dispatch success with temporarily invisible run ID retries observation without redispatch', async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'zdt-prepare-dispatch-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const bin = join(fixture, 'bin');
  const log = join(fixture, 'calls.jsonl');
  const counter = join(fixture, 'counter');
  await mkdir(bin);
  await writeFile(join(bin, 'git'), `#!/bin/sh\nprintf '%s\\n' '${sha}'\n`, { mode: 0o755 });
  await writeFile(join(bin, 'sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  await writeFile(join(bin, 'gh'), `#!${process.execPath}
const fs=require('node:fs');const args=process.argv.slice(2);fs.appendFileSync(process.env.DISPATCH_LOG,JSON.stringify(args)+'\\n');
if(args[0]==='api') console.log('${sha}');
if(args[0]==='run'&&args[1]==='list'){
  if(args[args.indexOf('--limit')+1]==='1') console.log('100');
  else { const n=Number(fs.existsSync(process.env.COUNTER)?fs.readFileSync(process.env.COUNTER):0)+1;fs.writeFileSync(process.env.COUNTER,String(n));if(n>=3)console.log('201'); }
}
if(args[0]==='run'&&args[1]==='watch') process.exit(23);
`, { mode: 0o755 });
  const script = source.replace(/^export PATH=.*$/m, '');
  const result = spawnSync('bash', ['-c', script, 'prepare-release.sh', 'console', sha, 'hbbtzn-l1'], {
    cwd: root, encoding: 'utf8', timeout: 5000,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, DISPATCH_LOG: log, COUNTER: counter },
  });
  const calls = (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse);
  const dispatches = calls.filter((args) => args[0] === 'workflow' && args[1] === 'run');
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(dispatches, [[
    'workflow', 'run', 'prepare-artifact-aliyun.yml', '--ref', 'zdt-next', '-f', `head_sha=${sha}`,
    '-f', 'release_target=console', '-f', 'build_runner=auto', '-f', 'release_node=hbbtzn-l1',
  ]]);
  assert.equal(calls.filter((args) => args[0] === 'run' && args[1] === 'list' && args.includes('--limit') && args[args.indexOf('--limit') + 1] === '30').length, 3);
});

test('a failed build never dispatches sealing or production deployment', async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'zdt-prepare-failure-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const bin = join(fixture, 'bin');
  const log = join(fixture, 'calls.jsonl');
  await mkdir(bin);
  await writeFile(join(bin, 'git'), `#!/bin/sh\nprintf '%s\\n' '${sha}'\n`, { mode: 0o755 });
  await writeFile(join(bin, 'gh'), `#!${process.execPath}
const fs=require('node:fs');const args=process.argv.slice(2);fs.appendFileSync(process.env.DISPATCH_LOG,JSON.stringify(args)+'\\n');
if(args[0]==='api')console.log('${sha}');if(args[0]==='run'&&args[1]==='list')console.log(args[args.indexOf('--limit')+1]==='1'?'100':'201');if(args[0]==='run'&&args[1]==='watch')process.exit(23);
`, { mode: 0o755 });
  const result = spawnSync('bash', ['-c', source.replace(/^export PATH=.*$/m, ''), 'prepare-release.sh', 'console', sha, 'hbbtzn-l1'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, DISPATCH_LOG: log },
  });
  const calls = (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(result.status, 1);
  assert.equal(calls.filter((args) => args[0] === 'workflow' && args[1] === 'run').length, 1);
  assert.ok(!calls.some((args) => args.includes('operation=deploy') || args.includes('operation=validate-candidate')));
});

test('unsupported paid Runner override is rejected before external dispatch', async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'zdt-prepare-invalid-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const result = spawnSync('bash', ['-c', source.replace(/^export PATH=.*$/m, ''), 'prepare-release.sh', 'console', sha, 'hbbtzn-l1'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, ZDT_PREPARE_RUNNER: 'larger-paid-runner' },
  });
  assert.equal(result.status, 64);
});
