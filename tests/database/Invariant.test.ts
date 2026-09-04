import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { resolve } from 'node:path';

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, '../..');
let replay: Promise<string> | undefined;

function invariantSuite(): Promise<string> {
  replay ??= execute(process.execPath, ['scripts/audit/database-contracts.mjs', '--invariant-suite'], {
    cwd: root,
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
  }).then(({ stdout }) => stdout);
  return replay;
}

test('并发预占后库存不会超卖', async () => {
  assert.match(await invariantSuite(), /inventory=passed/);
});

test('并发入账后经济事项幂等且借贷平衡', async () => {
  assert.match(await invariantSuite(), /finance=passed/);
});

test('并发卡券占用后仅保留一个有效占用', async () => {
  assert.match(await invariantSuite(), /voucher=passed/);
});

test('并发支付意图后订单金额守恒且无重复有效意图', async () => {
  assert.match(await invariantSuite(), /orderpayment=passed/);
});

test('并发场景后 Scope 读写仍隔离', async () => {
  assert.match(await invariantSuite(), /scope=passed/);
});
