import { describe, expect, it, vi } from 'vitest';
import { result, transactionManager } from '../../../test/TransactionFixture';
import type { BatchImportProcessPort, ImportBatchConfiguration, ImportBatchFactoryPort, ImportExecution, ImportTarget, ImportPort, JobPort } from '../../runtime/public';
import type { CredentialProtector } from '../application/port/CredentialProtector';
import { createCredentialImportProcess } from '../infrastructure/persistence/PgCredentialImportProcess';

const target: ImportTarget = { id: 'import:one', scope: 'mall:one', reference: 'object:one', sha256: 'a'.repeat(64), state: 'uploaded', authorization: {}, metadata: { pool: 'pool:one' }, confirmed: false };
const authorization = { assert: vi.fn(async () => undefined) };

describe('credential import strategy', () => {
  it('persists only protected values and never exposes source credentials to the staged payload', async () => {
    const query = vi.fn(async (sql: string) =>
      result(sql.startsWith('select product_id') ? [{ product_id: 'product:one', state: 'open', mode: 'imported' }] : sql.startsWith('update voucher.credentialpool') ? [{ product_id: 'product:one' }] : [])
    );
    const protect = vi.fn<CredentialProtector['protect']>(async (_value, purpose) => ({ ciphertext: `encrypted-${purpose}-payload`, fingerprint: (purpose === 'number' ? 'b' : 'c').repeat(64), masked: '****1234', keyVersion: 'key:one' }));
    const harness = batchHarness();
    const process = createCredentialImportProcess(harness.factory, transactionManager(query), {} as ImportPort, {} as JobPort, { protect }, authorization);
    const execution = runContext();
    await process.stage(
      target,
      [
        { number: 'VC001234', secret: 'Secret9876' },
        { number: 'invalid number', secret: 'DontPersist123' },
      ],
      execution
    );
    expect(protect).toHaveBeenCalledTimes(2);
    const serialized = JSON.stringify(harness.rows);
    for (const value of ['VC001234', 'Secret9876', 'invalid number', 'DontPersist123']) expect(serialized).not.toContain(value);
    expect(harness.rows[0]?.value).toMatchObject({ numberCiphertext: 'encrypted-number-payload', secretCiphertext: 'encrypted-secret-payload' });
    expect(harness.rows[1]).toEqual({ row: 3, value: { invalid: 'VALIDATION_FAILED' } });
    protect.mockClear();
    await process.process(target, execution.signal, execution.deadline);
    expect(protect).not.toHaveBeenCalled();
    expect(query.mock.calls.some(([sql]) => sql.includes('insert into voucher.credential'))).toBe(true);
  });

  it('keeps invalid source values out of persisted chunks', async () => {
    const harness = batchHarness();
    const process = createCredentialImportProcess(
      harness.factory,
      transactionManager(async () => result([])),
      {} as ImportPort,
      {} as JobPort,
      {
        protect: vi.fn(async () => {
          throw new Error('SHOULD_NOT_RUN');
        }),
      },
      authorization
    );
    await process.stage(target, [{ number: 'bad value', secret: 'bad value' }], runContext());
    expect(harness.rows).toEqual([{ row: 2, value: { invalid: 'VALIDATION_FAILED' } }]);
  });

  it('propagates database outages as infrastructure failures', async () => {
    const failure = new Error('DATABASE_UNAVAILABLE');
    const harness = batchHarness();
    const process = createCredentialImportProcess(
      harness.factory,
      transactionManager(async () => {
        throw failure;
      }),
      {} as ImportPort,
      {} as JobPort,
      { protect: vi.fn(async (_value, purpose) => ({ ciphertext: `encrypted-${purpose}`, fingerprint: (purpose === 'number' ? 'b' : 'c').repeat(64), masked: '****1234', keyVersion: 'key:one' })) },
      authorization
    );
    const execution = runContext();
    await process.stage(target, [{ number: 'VC001234', secret: 'Secret9876' }], execution);
    await expect(process.process(target, execution.signal, execution.deadline)).rejects.toBe(failure);
  });

  it('does not stage a row when envelope encryption fails', async () => {
    const harness = batchHarness();
    const process = createCredentialImportProcess(
      harness.factory,
      transactionManager(async () => result([])),
      {} as ImportPort,
      {} as JobPort,
      {
        protect: vi.fn(async () => {
          throw new Error('KMS_ENCRYPT_FAILED');
        }),
      },
      authorization
    );
    await expect(process.stage(target, [{ number: 'VC001234', secret: 'Secret9876' }], runContext())).rejects.toThrow('KMS_ENCRYPT_FAILED');
    expect(harness.rows).toEqual([]);
  });
});

function batchHarness() {
  const rows: { row: number; value: Readonly<Record<string, string>> }[] = [];
  const factory: ImportBatchFactoryPort = {
    create(configuration) {
      return process(configuration, rows);
    },
  };
  return { factory, rows };
}

function process(configuration: ImportBatchConfiguration, staged: { row: number; value: Readonly<Record<string, string>> }[]): BatchImportProcessPort {
  return {
    find: async () => null,
    authorize: async () => undefined,
    stage: async (candidate, source, execution) => {
      let row = 1;
      const rows = [];
      for await (const value of source) {
        row += 1;
        rows.push({ row, value });
      }
      const prepared = configuration.prepare ? await configuration.prepare(candidate, rows, execution) : { rows: rows.map((item) => ({ row: item.row, payload: item.value })), failures: [] };
      staged.push(...prepared.rows.map((item) => ({ row: item.row, value: item.payload })));
    },
    process: async (candidate, signal, deadline) => {
      for (const item of staged) {
        try {
          await configuration.transactions.write({ tenant: candidate.scope, membership: '', scope: candidate.scope, actor: 'test', trace: candidate.id, operation: 'test', workload: 'jobs', signal, deadline }, (context) =>
            configuration.write(context, candidate, item.row, item.value)
          );
        } catch (cause) {
          const code = cause instanceof Error ? cause.message : '';
          if (code !== 'VALIDATION_FAILED' && !code.startsWith('VOUCHER_')) throw cause;
        }
      }
      return true;
    },
    failures: async () => [],
    report: async () => undefined,
    complete: async () => undefined,
    reject: async () => undefined,
    fault: async () => undefined,
  };
}

function runContext(): ImportExecution {
  return { scope: target.scope, signal: new AbortController().signal, deadline: Date.now() + 10_000 };
}
