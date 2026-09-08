import { createHash } from 'node:crypto';
import { parseExperience, serializeExperience } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ExperienceCatalogPort } from '../../../catalog/public';
import { PUBLISH_DEPENDENCIES } from '../../domain/value/PublishEvidence';
import { PgVersionRepository } from './PgVersionRepository';

describe('PgVersionRepository restore', () => {
  it('appends a new pending version and advances the head without rewriting published history', async () => {
    const document = parseExperience({
      version: 2,
      application: 'application:one',
      theme: { preset: 'governance', primaryColor: '#E8502A', accentColor: '#F2A65A', logoObjectRef: null, faviconObjectRef: null },
      navigation: [{ id: 'navigation:home', label: '首页', page: 'home' }],
      assets: [],
      pages: [{ id: 'home', path: 'home', blocks: [{ id: 'hero', component: 'hero', content: { title: '历史版本' } }] }],
    });
    const source = 'version:source';
    const calls: { sql: string; values: readonly unknown[] }[] = [];
    const database = {
      query: vi.fn(async (sql: string, values: readonly unknown[] = []) => {
        calls.push({ sql, values });
        if (sql.includes('from experience.version version where version.id=$1'))
          return result([
            {
              id: source,
              application_id: 'application:one',
              sequence: '2',
              configuration: document,
              configuration_hash: createHash('sha256').update(serializeExperience(document)).digest('hex'),
              validation_state: 'valid',
              validation_issues: [],
              publish_evidence: evidence(),
              reason: '已发布历史版本',
              source_version_id: null,
              created_by: 'actor:old',
              created_at: '2026-09-03T08:00:00.000Z',
              frozen_at: '2026-09-03T08:01:00.000Z',
            },
          ]);
        if (sql.includes('from experience.application where id=$1 and version=$2'))
          return result([
            {
              id: 'application:one',
              mall_id: 'mall:one',
              code: 'MALL_ONE',
              public_slug: 'mall-one',
              name: '一号福利商城',
              status: 'active',
              is_primary: true,
              head_version_id: 'version:current',
              version: '5',
              created_at: '2026-09-01T08:00:00.000Z',
              updated_at: '2026-09-03T08:01:00.000Z',
            },
          ]);
        if (sql.includes('coalesce(max(sequence),0)')) return result([{ sequence: '5' }]);
        if (sql.includes('update experience.application')) return result([{ id: 'application:one' }]);
        return result([]);
      }),
    } as unknown as SqlExecutor;
    const repository = new PgVersionRepository({ database: () => database } as unknown as PgTransactionAccess, {} as ExperienceCatalogPort);

    const restored = await repository.restore({} as WriteTransactionContext, { version: source, expectedVersion: 5, reason: '恢复到可用历史版本', actor: 'actor:new' });

    const insert = calls.find(({ sql }) => sql.includes('insert into experience.version'))!;
    expect(insert.values[0]).not.toBe(source);
    expect(insert.values).toMatchObject({ 1: 'application:one', 2: 6, 5: 'pending', 7: null, 9: source, 10: 'actor:new', 12: null });
    expect(restored).toMatchObject({ id: insert.values[0], sequence: 6, validation_state: 'pending' });
    expect(calls.some(({ sql }) => /update experience\.(release|publication)/.test(sql))).toBe(false);
  });
});

function evidence() {
  return { dependencies: Object.fromEntries(PUBLISH_DEPENDENCIES.map((name) => [name, { ready: true, version: `${name}:1` }])), issues: [] };
}
function result(rows: readonly Record<string, unknown>[]) {
  return { rows: [...rows], rowCount: rows.length, command: '', oid: 0, fields: [] };
}
