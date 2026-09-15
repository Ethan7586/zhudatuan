import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

test('one sealed-source command uses the sole 1.4.3 orchestration and never prepares directly', async () => {
  const [dispatcher, workflow] = await Promise.all([
    readFile(join(root, 'scripts/delivery-dispatch.sh'), 'utf8'),
    readFile(join(root, '.github/workflows/delivery-1-4-3.yml'), 'utf8'),
  ]);
  assert.match(dispatcher, /workflow='delivery-1-4-3\.yml'/);
  assert.match(dispatcher, /-f operation="\$operation"/);
  assert.equal((dispatcher.match(/gh workflow run/g) ?? []).length, 1);
  assert.doesNotMatch(dispatcher, /prepare-artifact-aliyun|deploy-source-aliyun/);
  assert.match(workflow, /if: inputs\.operation == 'deploy-source'/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/deploy-source-aliyun\.yml/);
});

test('the unified dispatcher executes one observable workflow run', async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'zdt-delivery-1-4-3-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const bin = join(fixture, 'bin');
  const log = join(fixture, 'calls.jsonl');
  const sha = 'a'.repeat(40);
  await mkdir(bin);
  await writeFile(join(bin, 'git'), `#!/bin/sh\nprintf '%s\\n' '${sha}'\n`);
  await chmod(join(bin, 'git'), 0o755);
  await writeFile(join(bin, 'sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  await writeFile(join(bin, 'gh'), `#!${process.execPath}
const fs=require('node:fs');const a=process.argv.slice(2);fs.appendFileSync(process.env.CALL_LOG,JSON.stringify(a)+'\\n');
if(a[0]==='api')console.log('${sha}');
if(a[0]==='workflow'&&a[1]==='view')console.log('name: Delivery Control 1.4.3');
if(a[0]==='run'&&a[1]==='list')console.log(a[a.indexOf('--limit')+1]==='1'?'100':'101');
`, { mode: 0o755 });
  const source = (await readFile(join(root, 'scripts/delivery-dispatch.sh'), 'utf8')).replace(/^export PATH=.*$/m, '');
  const result = spawnSync('bash', ['-c', source, 'delivery-dispatch.sh', 'deploy-source', sha], {
    cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, CALL_LOG: log },
  });
  assert.equal(result.status, 0, result.stderr);
  const calls = (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(calls.filter((args) => args[0] === 'workflow' && args[1] === 'run'), [[
    'workflow', 'run', 'delivery-1-4-3.yml', '--ref', 'zdt-next', '-f', 'operation=deploy-source', '-f', `head_sha=${sha}`,
    '-f', 'release_target=', '-f', 'physical_node=',
  ]]);
  assert.ok(calls.some((args) => args[0] === 'run' && args[1] === 'watch' && args[2] === '101'));
});
