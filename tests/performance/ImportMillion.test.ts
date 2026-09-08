import assert from 'node:assert/strict';
import test from 'node:test';
import { IMPORT_CAPACITY } from '@shop/config/runtime';
import { RuntimeBatchImportProcess } from '../../services/commerce/src/modules/runtime/application/process/StageImport';

const target = Object.freeze({ id: 'import:million', scope: 'mall:one', reference: 'object:million', sha256: 'a'.repeat(64), state: 'uploaded' as const, authorization: Object.freeze({}), confirmed: true });

test('百万行导入以 AsyncIterable 流式分片且内存中单批不超过容量预算', async () => {
  let total = 0;
  let chunks = 0;
  let maximumRetained = 0;
  const process = new RuntimeBatchImportProcess(
    configuration(
      { sequence: 0, staged: 0 },
      (batch) => {
        chunks += batch.length;
        maximumRetained = Math.max(maximumRetained, ...batch.map(({ rows }) => rows.length));
      },
      (value) => {
        total = value;
      }
    )
  );
  await process.stage(target, rows(IMPORT_CAPACITY.maximumRows), execution());
  assert.equal(total, 1_000_000);
  assert.equal(chunks, 1_000);
  assert.equal(maximumRetained, IMPORT_CAPACITY.chunkRows);
});

test('百万行导入从持久化 Checkpoint 恢复且重复执行不重写已提交行', async () => {
  let staged = 0;
  let total = 0;
  const process = new RuntimeBatchImportProcess(
    configuration(
      { sequence: 999, staged: 999_000, size: 1_000 },
      (batch) => {
        staged += batch.reduce((sum, chunk) => sum + chunk.rows.length, 0);
      },
      (value) => {
        total = value;
      }
    )
  );
  await process.stage(target, rows(IMPORT_CAPACITY.maximumRows), execution());
  assert.equal(staged, 1_000);
  assert.equal(total, 1_000_000);
});

function configuration(cursor: Readonly<{ sequence: number; staged: number; size?: number }>, stage: (chunks: readonly Readonly<{ rows: readonly unknown[] }>[]) => void, ready: (total: number) => void) {
  return {
    owner: 'catalog',
    failure: 'CATALOG_IMPORT_ROW_INVALID',
    concurrency: 8,
    transactions: { read: async (_options: unknown, action: (context: unknown) => unknown) => action({}), write: async (_options: unknown, action: (context: unknown) => unknown) => action({}) },
    runtime: {
      find: async () => target,
      begin: async () => cursor,
      stage: async (_context: unknown, _id: string, _owner: string, chunks: readonly Readonly<{ rows: readonly unknown[] }>[]) => {
        stage(chunks);
      },
      ready: async (_context: unknown, _id: string, _owner: string, total: number) => {
        ready(total);
      },
    },
    authorization: { assert: async () => undefined },
    write: async () => undefined,
    continue: async () => undefined,
  } as never;
}

function execution() {
  return Object.freeze({ scope: 'mall:one', signal: new AbortController().signal, deadline: Date.now() + 120_000 });
}

async function* rows(count: number): AsyncGenerator<Readonly<Record<string, string>>> {
  for (let index = 0; index < count; index += 1) yield Object.freeze({ code: String(index) });
}
