import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const source = (await readFile(join(root, 'scripts/deploy-source.sh'), 'utf8')).replace(/^export PATH=.*$/m, '');
const sha = 'a'.repeat(40);

test('one sealed-source command dispatches exactly one orchestration and never prepares', async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'zdt-deploy-source-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const bin = join(fixture, 'bin');
  const log = join(fixture, 'calls.jsonl');
  await mkdir(bin);
  await writeFile(join(bin, 'git'), `#!/bin/sh\nprintf '%s\\n' '${sha}'\n`);
  await chmod(join(bin, 'git'), 0o755);
  await writeFile(join(bin, 'gh'), `#!${process.execPath}
const fs=require('node:fs');
const a=process.argv.slice(2);fs.appendFileSync(process.env.CALL_LOG,JSON.stringify(a)+'\\n');
if(a[0]==='api') console.log('${sha}');
if(a[0]==='run'&&a[1]==='list') console.log(a.some(x=>x.includes('displayTitle'))?'101':'100');
`, { mode: 0o755 });

  const result = spawnSync('bash', ['-c', source, 'deploy-source.sh', sha], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, CALL_LOG: log },
  });
  assert.equal(result.status, 0, result.stderr);
  const calls = (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(calls.filter((args) => args[0] === 'workflow' && args[1] === 'run'), [
    ['workflow', 'run', 'deploy-source-aliyun.yml', '--ref', 'zdt-next', '-f', `head_sha=${sha}`],
  ]);
  assert.ok(!calls.some((args) => args.includes('prepare-artifact-aliyun.yml')));
  assert.ok(calls.some((args) => args[0] === 'run' && args[1] === 'watch' && args[2] === '101'));
});
