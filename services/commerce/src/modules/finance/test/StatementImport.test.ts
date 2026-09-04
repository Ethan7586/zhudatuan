import { describe, expect, it, vi } from 'vitest';
import { result, transactionManager } from '../../../test/TransactionFixture';
import type { BatchImportProcessPort, ImportBatchConfiguration, ImportBatchFactoryPort, ImportExecution, ImportPort, ImportTarget, JobPort } from '../../runtime/public';
import type { StoredObject } from '../../runtime/public/ObjectPort';
import { PgStatementImportProcess } from '../infrastructure/persistence/PgStatementImportProcess';

const target: ImportTarget = Object.freeze({
  id: 'import:8b6bda6f-c218-42c3-bc9c-f8170d37d712',
  scope: 'mall:one',
  reference: 'object:statement',
  sha256: 'a'.repeat(64),
  state: 'reporting',
  authorization: { membership: 'membership:maker' },
  metadata: { provider: 'supplier', partnerId: 'partner:one', periodStart: '2026-08-01', periodEnd: '2026-08-31', currency: 'CNY', openingMinor: 1000, closingMinor: 1300 },
  confirmed: true,
});
const report: StoredObject = Object.freeze({ reference: 'object:report', sha256: 'b'.repeat(64), size: 128, scan: 'clean' });
const execution: ImportExecution = Object.freeze({ scope: target.scope, signal: new AbortController().signal, deadline: Date.now() + 10_000 });

describe('finance statement import', () => {
  it('keeps Statement invisible while Runtime is only staging the preflight', async () => {
    const query = vi.fn(async () => result([]));
    const harness = batchHarness();
    const process = new PgStatementImportProcess(harness.factory, transactionManager(query), runtime(), jobs(), authorization());
    await process.stage({ ...target, state: 'uploaded', confirmed: false }, [{ reference: 'pay:one', type: 'payment', amountMinor: '500' }], execution);
    expect(harness.staged).toBe(true);
    expect(query).not.toHaveBeenCalled();
  });

  it('publishes Statement, reconciliation and immutable lines in one completion transaction without writing Ledger', async () => {
    const statements: string[] = [];
    const query = vi.fn(async (sql: string) => {
      statements.push(sql.replace(/\s+/g, ' ').trim());
      if (sql.includes('select $1::bigint opening')) return result([{ opening: 1000, debit: 500, credit: 200, closing: 1300, rows: 2, failed: 0 }]);
      if (sql.includes('insert into finance.statement(')) return result([{ id: 'statement:one' }]);
      if (sql.includes('insert into finance.reconciliation(')) return result([{ id: 'reconciliation:one' }]);
      if (sql.includes('insert into finance.statementline(')) return result([{ id: 'line:one' }, { id: 'line:two' }]);
      return result([]);
    });
    const runtimePort = runtime();
    const jobPort = jobs();
    const harness = batchHarness();
    const process = new PgStatementImportProcess(harness.factory, transactionManager(query), runtimePort, jobPort, authorization());

    await process.complete(target, report, execution);

    expect(runtimePort.complete).toHaveBeenCalledWith(expect.anything(), target.id, 'finance', report);
    expect(jobPort.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: 'reconciliation', owner: 'finance' }));
    expect(statements.findIndex((sql) => sql.includes('insert into finance.statement('))).toBeLessThan(statements.findIndex((sql) => sql.includes('insert into finance.reconciliation(')));
    expect(statements.at(-1)).toContain('delete from finance.statementimportline');
    expect(statements.some((sql) => /finance\.(journal|entry|account)|balance/i.test(sql))).toBe(false);
  });

  it('rejects an unbalanced source before any business row becomes visible', async () => {
    const statements: string[] = [];
    const query = vi.fn(async (sql: string) => {
      statements.push(sql.replace(/\s+/g, ' ').trim());
      return sql.includes('select $1::bigint opening')
        ? result([{ opening: 1000, debit: 500, credit: 100, closing: 1300, rows: 2, failed: 0 }])
        : result([]);
    });
    const runtimePort = runtime();
    const jobPort = jobs();
    const process = new PgStatementImportProcess(batchHarness().factory, transactionManager(query), runtimePort, jobPort, authorization());

    await process.complete(target, report, execution);

    expect(runtimePort.reject).toHaveBeenCalledWith(expect.anything(), target.id, 'finance', 'FINANCE_STATEMENT_TOTAL_MISMATCH', expect.any(String));
    expect(statements.some((sql) => sql.includes('insert into finance.statement('))).toBe(false);
    expect(runtimePort.complete).not.toHaveBeenCalled();
    expect(jobPort.create).not.toHaveBeenCalled();
  });
});

function batchHarness(): Readonly<{ factory: ImportBatchFactoryPort; staged: boolean }> {
  const state = { staged: false };
  const factory: ImportBatchFactoryPort = { create(configuration) { return delegate(configuration, state); } };
  return Object.freeze({ factory, get staged() { return state.staged; } });
}

function delegate(configuration: ImportBatchConfiguration, state: { staged: boolean }): BatchImportProcessPort {
  return {
    find: async () => target,
    authorize: async () => undefined,
    stage: async () => { state.staged = true; },
    process: async () => true,
    failures: async () => [],
    report: async () => undefined,
    complete: async (candidate, resultFile, run) => { await configuration.publish?.(candidate, resultFile, run); },
    reject: async () => undefined,
    fault: async () => undefined,
  };
}

function runtime(): ImportPort {
  return {
    complete: vi.fn(async () => undefined),
    reject: vi.fn(async () => undefined),
    progress: vi.fn(async () => ({ total: 2, processed: 2, succeeded: 2, failed: 0 })),
  } as unknown as ImportPort;
}

function jobs(): JobPort {
  return { create: vi.fn(async () => ({ id: 'job:reconciliation', kind: 'reconciliation', state: 'queued', processed: 0, total: 0, succeeded: 0, failed: 0, retryable: 0, updatedAt: new Date().toISOString() })) } as unknown as JobPort;
}

function authorization() {
  return { assert: vi.fn(async () => undefined) };
}
