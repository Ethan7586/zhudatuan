import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { PgExperiencePublicationRepository } from './PgExperiencePublicationRepository';

const context = {} as WriteTransactionContext;
const target = Object.freeze({
  application: 'application:one',
  configuration: Object.freeze({
    version: 2 as const,
    application: 'application:one',
    theme: Object.freeze({ preset: 'shop' as const, primaryColor: '#1F5EFF', accentColor: '#19A974', logoObjectRef: null, faviconObjectRef: null }),
    navigation: Object.freeze([{ id: 'navigation:home', label: '首页', page: 'home' }]),
    assets: Object.freeze([]),
    pages: Object.freeze([{ id: 'home', path: 'home', blocks: Object.freeze([]) }]),
  }),
  effectiveAt: '2026-09-01T00:00:00.000Z',
  hash: 'a'.repeat(64),
  pool: 'pool:one',
  release: 'release:new',
  state: 'scheduled',
  version: 'version:new',
});

function database(): SqlExecutor {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('from runtime.inbox inbox join runtime.outbox')) {
        return result([{ id: 'event:one', type: 'experience.release.requested', version: 1, aggregate: target.application, scope: 'mall:one', payload: {}, occurredAt: target.effectiveAt }]);
      }
      if (sql.includes('superseded'))
        return result([
          {
            superseded: false,
            id: target.release,
            application_id: target.application,
            version_id: target.version,
            pool_id: target.pool,
            state: target.state,
            effective_at: target.effectiveAt,
            retired_at: null,
            failed_at: null,
            failure_code: null,
            published_by: 'actor:publisher',
          },
        ]);
      if (sql.includes('select id,mall_id'))
        return result([
          {
            id: target.application,
            mall_id: 'mall:one',
            code: 'MALLONE',
            public_slug: 'mall-one',
            name: '一号商城',
            status: 'active',
            is_primary: true,
            head_version_id: target.version,
            version: 2,
            created_at: target.effectiveAt,
            updated_at: target.effectiveAt,
          },
        ]);
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

    await expect(repository.activate(context, 'event:one', target, 'experience/one.json', { reference: 'object:one', sha256: target.hash, size: 42 })).resolves.toEqual({ active: true, malls: ['mall:one'], handles: ['mall-one'] });

    const statements = vi.mocked(sql.query).mock.calls.map(([statement]) => statement);
    const retire = statements.findIndex((statement) => statement.includes("update experience.publication set state='retired'"));
    const activate = statements.findIndex((statement) => statement.includes('insert into experience.publication'));
    expect(retire).toBeGreaterThan(-1);
    expect(activate).toBeGreaterThan(retire);
  });
});
