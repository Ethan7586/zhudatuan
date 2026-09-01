import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgExperiencePublicationRepository } from './PgExperiencePublicationRepository';

const context = {} as WriteTransactionContext;
const target = Object.freeze({
  application: 'application:one',
  configuration: {},
  effectiveAt: '2026-09-01T00:00:00.000Z',
  hash: 'a'.repeat(64),
  release: 'release:new',
  state: 'scheduled',
  version: 'version:new',
});

function database(): SqlExecutor {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('from runtime.inbox inbox join runtime.outbox')) {
        return result([{ id: 'event:one', type: 'experience.published', version: 1, aggregate: target.application, scope: 'mall:one', payload: {}, occurredAt: target.effectiveAt }]);
      }
      if (sql.includes('superseded')) return result([{ superseded: false }]);
      if (sql.includes('select mall_id')) return result([{ mall_id: 'mall:one' }]);
      if (sql.includes('update runtime.inbox')) return result([], 1);
      return result([]);
    }),
  } as unknown as SqlExecutor;
}

function result(rows: readonly Record<string, unknown>[], rowCount = rows.length) {
  return { rows: [...rows], rowCount, command: '', oid: 0, fields: [] };
}

describe('PgExperiencePublicationRepository', () => {
  it('retires the previous active publication before activating its replacement', async () => {
    const sql = database();
    const repository = new PgExperiencePublicationRepository({ database: () => sql } as unknown as PgTransactionAccess);

    await expect(repository.activate(context, 'event:one', target, 'experience/one.json', { reference: 'object:one', sha256: target.hash, size: 42 })).resolves.toEqual({ active: true, malls: ['mall:one'] });

    const statements = vi.mocked(sql.query).mock.calls.map(([statement]) => statement);
    const retire = statements.findIndex((statement) => statement.includes("update experience.publication set state='retired'"));
    const activate = statements.findIndex((statement) => statement.includes('insert into experience.publication'));
    expect(retire).toBeGreaterThan(-1);
    expect(activate).toBeGreaterThan(retire);
  });
});
