import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { resolve } from 'node:path';

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, '../..');
let replay: Promise<string> | undefined;

function replaySuite(): Promise<string> {
  replay ??= execute(process.execPath, ['scripts/audit/database-contracts.mjs', '--migration-replay-suite'], {
    cwd: root,
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
  }).then(({ stdout }) => stdout);
  return replay;
}

test('空库可执行全部迁移', async () => {
  assert.match(await replaySuite(), /target schema replay passed: migrations=414 historical=316 repair=98/);
});

test('生产脱敏快照升级后保持业务 Hash', async () => {
  assert.match(await replaySuite(), /snapshot=passed/);
});

test('重复执行最终迁移被保护且不产生部分提交', async () => {
  assert.match(await replaySuite(), /repeat=passed/);
});

test('最终迁移回滚点不泄漏 Schema Head', async () => {
  assert.match(await replaySuite(), /rollback=passed/);
});
