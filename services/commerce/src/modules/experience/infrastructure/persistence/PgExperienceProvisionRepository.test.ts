import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ExperienceCatalogPort } from '../../../catalog/public';
import { PgExperienceProvisionRepository } from './PgExperienceProvisionRepository';
import { serializeExperience } from '@shop/contract';

const context = {} as WriteTransactionContext;
const mall = Object.freeze({
  id: 'mall:one',
  name: '主打团福利商城',
  code: 'WELFARE01',
  publicSlug: 'welfare-one',
  brandName: '主打团',
  domain: Object.freeze({ mode: 'custom' as const, customDomain: 'mall.example.com' }),
  timezone: 'Asia/Shanghai',
  currency: 'CNY',
  theme: Object.freeze({ preset: 'shop' as const, primaryColor: '#E8502A', accentColor: '#FF8A34', logoObjectRef: null, faviconObjectRef: null }),
  status: 'draft' as const,
  version: 1,
});

describe('PgExperienceProvisionRepository', () => {
  it('initializes once and treats delivery replay as a completed no-op', async () => {
    let claims = 0;
    const database = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('from runtime.inbox inbox join runtime.outbox')) {
          claims += 1;
          return result(claims === 1 ? [{ id: 'event:one', type: 'organization.mall.created', version: 1, aggregate: mall.id, scope: mall.id, payload: {}, occurredAt: '2026-09-04T00:00:00.000Z' }] : []);
        }
        if (sql.includes('from experience.application where mall_id')) return result([]);
        if (sql.includes('update runtime.inbox')) return result([], 1);
        return result([]);
      }),
    } as unknown as SqlExecutor;
    const catalog = { provisionPool: vi.fn(async () => 'pool:one') } as unknown as ExperienceCatalogPort;
    const repository = new PgExperienceProvisionRepository(catalog, { database: () => database } as unknown as PgTransactionAccess);

    await expect(repository.provision(context, { event: 'event:one', mall, actor: 'membership:owner' })).resolves.toBe('created');
    await expect(repository.provision(context, { event: 'event:one', mall, actor: 'membership:owner' })).resolves.toBe('replayed');
    expect(catalog.provisionPool).toHaveBeenCalledTimes(1);
    expect(vi.mocked(database.query).mock.calls.some(([sql]) => sql.includes('insert into organization.'))).toBe(false);
    const binding = vi.mocked(database.query).mock.calls.find(([sql]) => sql.includes('insert into experience.binding'));
    expect(binding?.[1]).toEqual([expect.stringMatching(/^application:/), 'mall.example.com', mall.id, 'pool:one']);
  });

  it('synchronizes an existing application and creates an immutable theme version for MallUpdated', async () => {
    const application = 'application:mall:one';
    const sourceVersion = `${application}:version:1`;
    const configuration = {
      version: 2 as const,
      application,
      theme: { preset: 'market' as const, primaryColor: '#A23B32', accentColor: '#C99A45', logoObjectRef: null, faviconObjectRef: null },
      navigation: [{ id: `${application}:navigation:home`, label: '首页', page: `${application}:home` }],
      assets: [],
      pages: [{ id: `${application}:home`, path: 'home', blocks: [{ id: 'hero', component: 'hero' as const, content: { title: '原装修' } }] }],
    };
    const database = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('from runtime.inbox inbox join runtime.outbox'))
          return result([{ id: 'event:update', type: 'organization.mall.updated', version: 1, aggregate: mall.id, scope: mall.id, payload: {}, occurredAt: '2026-09-04T00:00:00.000Z' }]);
        if (sql.includes('from experience.application where mall_id'))
          return result([
            {
              id: application,
              mall_id: mall.id,
              code: mall.code,
              public_slug: mall.publicSlug,
              name: mall.name,
              status: mall.status,
              is_primary: true,
              head_version_id: sourceVersion,
              version: '1',
              created_at: '2026-09-03T00:00:00.000Z',
              updated_at: '2026-09-03T00:00:00.000Z',
            },
          ]);
        if (sql.includes('select configuration,sequence from experience.version')) return result([{ configuration, sequence: '1' }]);
        if (sql.includes('update experience.application')) return result([{ id: application }], 1);
        if (sql.includes('update runtime.inbox')) return result([], 1);
        return result([]);
      }),
    } as unknown as SqlExecutor;
    const catalog = { provisionPool: vi.fn(), activeBinding: vi.fn(async () => ({ mall: mall.id, pool: 'pool:one' })) } as unknown as ExperienceCatalogPort;
    const repository = new PgExperienceProvisionRepository(catalog, { database: () => database } as unknown as PgTransactionAccess);

    await expect(repository.provision(context, { event: 'event:update', mall, actor: 'membership:owner' })).resolves.toBe('synchronized');
    expect(catalog.provisionPool).not.toHaveBeenCalled();
    expect(vi.mocked(database.query).mock.calls.some(([sql]) => sql.includes('insert into experience.binding'))).toBe(true);
    const insert = vi.mocked(database.query).mock.calls.find(([sql]) => sql.includes('insert into experience.version'));
    expect(insert?.[1]?.[9]).toBe(sourceVersion);
    expect(String(insert?.[1]?.[3])).toContain('"preset":"shop"');
    expect(() => serializeExperience(configuration)).not.toThrow();
  });
});

function result(rows: readonly Record<string, unknown>[], rowCount = rows.length) {
  return { rows: [...rows], rowCount, command: '', oid: 0, fields: [] };
}
