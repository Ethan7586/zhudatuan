import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { createOssClient } from '../src/oss.mjs';
import { routeBuildRequest } from '../src/runner-routing.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

test('distributed lease time follows authenticated OSS response time instead of Runner wall clock', async () => {
  let monotonic = 1000;
  const client = createOssClient({ accessKeyId: 'id', accessKeySecret: 'secret', bucket: 'bucket', endpoint: 'https://oss.example.test' }, {
    now: () => new Date('2099-01-01T00:00:00Z'),
    monotonicNow: () => monotonic,
    sleep: async () => {},
    fetchImpl: async () => new Response('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>', {
      status: 200, headers: { date: 'Wed, 16 Sep 2026 00:00:00 GMT' },
    }),
  });
  await client.listPrefix('fixture/');
  assert.equal(client.authoritativeNow().toISOString(), '2026-09-16T00:00:00.000Z');
  monotonic += 5000;
  assert.equal(client.authoritativeNow().toISOString(), '2026-09-16T00:00:05.000Z');
});

test('a distributed Runner lease fails closed when no trusted OSS clock exists', async () => {
  const client = {
    async listPrefix() { return []; },
    async getObject() { throw Object.assign(new Error('missing'), { code: 'OSS_OBJECT_NOT_FOUND' }); },
    async putImmutable() { return { status: 'uploaded' }; },
  };
  await assert.rejects(() => routeBuildRequest(client, {
    project: 'fixture', sourceSha: 'a'.repeat(40), controlPlaneSha: 'b'.repeat(40), releaseTarget: 'console', physicalNode: 'node-a', runners: [],
  }), (error) => error.code === 'RUNNER_AUTHORITATIVE_TIME_UNAVAILABLE');
});

test('cold Standby has an executable mutually-exclusive local takeover path', async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'zdt-release-standby-drill-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const bin = join(fixture, 'bin');
  const state = join(fixture, 'state.json');
  const calls = join(fixture, 'calls.jsonl');
  await mkdir(bin);
  await writeFile(state, JSON.stringify({ primary: 'active', standby: 'stopped' }));
  await writeFile(join(bin, 'id'), '#!/bin/sh\necho 0\n', { mode: 0o755 });
  await writeFile(join(bin, 'pgrep'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  await writeFile(join(bin, 'curl'), `#!/bin/sh\ncase "$*" in *latest/api/token*) echo token;; *) echo i-2zeewhay0farxq8lucrc;; esac\n`, { mode: 0o755 });
  await writeFile(join(bin, 'systemctl'), `#!${process.execPath}
const fs=require('node:fs');const a=process.argv.slice(2),f=process.env.RUNNER_STATE,s=JSON.parse(fs.readFileSync(f));fs.appendFileSync(process.env.CALLS,JSON.stringify(a)+'\\n');
const standby=a.at(-1).includes('standby'),k=standby?'standby':'primary';
if(a[0]==='is-active')process.exit(s[k]==='active'?0:3);
if(a[0]==='stop')s[k]='stopped';if(a[0]==='start')s[k]='active';fs.writeFileSync(f,JSON.stringify(s));
`, { mode: 0o755 });
  const script = join(root, '02_platform_pingtai/infrastructure/github-actions-runner/switch-release-runner.sh');
  const result = spawnSync(script, ['standby'], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, RUNNER_STATE: state, CALLS: calls } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(await readFile(state, 'utf8')), { primary: 'stopped', standby: 'active' });
  assert.match(result.stdout, /primary=stopped standby=active/);
});

test('1.4.2 compatibility is read-only and cannot bypass the 1.4.3 Seal path', async () => {
  const [engine, guide, workflow, agent] = await Promise.all([
    readFile(join(root, '04_tools/release-engine/src/engine.mjs'), 'utf8'),
    readFile(join(root, 'AI-DELIVERY.md'), 'utf8'),
    readFile(join(root, '.github/workflows/deploy-prepared-aliyun.yml'), 'utf8'),
    readFile(join(root, '04_tools/release-engine/remote/agent.mjs'), 'utf8'),
  ]);
  assert.match(engine, /resolvePreparedArtifact\(adapter, \{ \.\.\.options, node: requestedNode, allowLegacy: false \}\)/);
  assert.ok(engine.indexOf('await requireFinalSealReceipt(adapter') < engine.indexOf('await writerStore.run(writerOptions'));
  assert.match(guide, /1\.4\.2 制品与历史回执保持只读/);
  assert.match(guide, /不能自动生成新 Seal/);
  assert.doesNotMatch(workflow, /npm ci|\brelease\s+--\s+(?:build|package|publish)\b/);
  assert.ok(agent.indexOf("await atomicPointer(join(root, 'current'), previousCurrent)") < agent.indexOf("throw failure('CUTOVER_FAILED_AND_ROLLED_BACK'"));
});

test('machine-readable final drill covers all 62 scenarios and computes the fixed score', async () => {
  const fixture = JSON.parse(await readFile(join(root, '04_tools/release-engine/test/fixtures/delivery-control-plane-1.4.3-final-drill.json'), 'utf8'));
  assert.equal(fixture.schema, 'ai.delivery.control-plane-final-drill.v1');
  assert.deepEqual(fixture.scenarios.map(({ id }) => id), Array.from({ length: 62 }, (_, index) => index + 1));
  assert.ok(fixture.scenarios.every(({ result, evidence }) => result === 'PASS' && evidence.length > 0));
  const total = Object.values(fixture.score.categories).reduce((sum, value) => sum + value.score, 0);
  assert.equal(total, fixture.score.total);
  assert.equal(fixture.score.total, 99);
  assert.equal(fixture.score.categories.failureRecovery.score, 14);
  assert.match(fixture.score.categories.failureRecovery.deduction, /second physical host/i);
});
