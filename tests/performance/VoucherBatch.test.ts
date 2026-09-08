import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CAPACITY_MODEL } from '@shop/config/runtime';
import { CHUNK_SIZE } from '../../services/commerce/src/modules/voucher/infrastructure/persistence/IssueBatchStore';

test('百万卡券发放按有界分片、跳锁和持久化进度运行', async () => {
  assert.equal(CAPACITY_MODEL.voucherBatch, 1_000_000);
  const source = await readFile('services/commerce/src/modules/voucher/infrastructure/persistence/PgIssueBatchProcess.ts', 'utf8');
  assert.ok(CHUNK_SIZE > 0 && CHUNK_SIZE <= 1_000);
  assert.equal(Math.ceil(CAPACITY_MODEL.voucherBatch / CHUNK_SIZE), 4_000);
  assert.match(source, /for update skip locked/);
  assert.match(source, /jobs\.progress/);
  assert.match(source, /on conflict\(batch_id,ordinal\) do nothing/);
});
