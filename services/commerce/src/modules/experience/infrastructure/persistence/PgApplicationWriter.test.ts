import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ExperienceCatalogPort } from '../../../catalog/public';
import type { MallProvisionPort } from '../../../organization/public';
import type { PgApplicationReader } from './PgApplicationReader';
import { PgApplicationWriter } from './PgApplicationWriter';

describe('PgApplicationWriter copy', () => {
  it('creates isolated application and version identities without copying runtime or publication state', async () => {
    const source = 'application:source';
    const configuration = {
      version: 2,
      application: source,
      theme: { preset: 'market', primaryColor: '#A23B32', accentColor: '#C99A45', logoObjectRef: 'object:logo', faviconObjectRef: null },
      navigation: [{ id: `${source}:navigation:home`, label: '首页', page: `${source}:home` }],
      assets: ['object:logo'],
      pages: [{ id: `${source}:home`, path: 'home', blocks: [{ id: `${source}:hero`, component: 'hero', content: { title: '来源商城' }, action: { type: 'micropage', target: `${source}:home` } }] }],
    };
    const queries: Readonly<{ sql: string; values: readonly unknown[] }>[] = [];
    const database = {
      query: vi.fn(async (sql: string, values: readonly unknown[] = []) => {
        queries.push({ sql, values });
        if (sql.includes('join experience.version')) return result([{ name: '来源商城', version_id: 'version:source', configuration }]);
        if (sql.includes('where code=$1 or lower(public_slug)')) return result([]);
        if (sql.includes('where mall_id=$1 limit 1')) return result([]);
        return result([]);
      }),
    } as unknown as SqlExecutor;
    const targetMall = {
      id: 'mall:target',
      name: '目标商城',
      code: 'TARGET',
      publicSlug: 'target',
      brandName: '目标',
      domain: { mode: 'custom' as const, customDomain: 'target.example.com' },
      timezone: 'Asia/Shanghai',
      currency: 'CNY',
      theme: { preset: 'shop' as const, primaryColor: '#1F5EFF', accentColor: '#19A974', logoObjectRef: null, faviconObjectRef: null },
      status: 'draft' as const,
      version: 1,
    };
    const malls = { mall: vi.fn(async () => targetMall) } as unknown as MallProvisionPort;
    const catalog = { provisionPool: vi.fn(async () => 'pool:target') } as unknown as ExperienceCatalogPort;
    const reader = { required: vi.fn(async (_context, id) => ({ id, mallId: targetMall.id })) } as unknown as PgApplicationReader;
    const writer = new PgApplicationWriter({ database: () => database } as unknown as PgTransactionAccess, malls, catalog, reader);

    const copied = await writer.copy({} as WriteTransactionContext, { source, targetMall: targetMall.id, reason: '复制装修模板', actor: 'actor:one' });

    const applicationInsert = queries.find(({ sql }) => sql.includes('insert into experience.application'))!;
    const versionInsert = queries.find(({ sql }) => sql.includes('insert into experience.version'))!;
    expect(applicationInsert.values[0]).not.toBe(source);
    expect(applicationInsert.values).toEqual(expect.arrayContaining([targetMall.id, expect.stringMatching(/^TARGET_/), expect.stringMatching(/^target-/)]));
    expect(versionInsert.values[0]).not.toBe('version:source');
    expect(versionInsert.values[1]).toBe(applicationInsert.values[0]);
    expect(versionInsert.values[9]).toBeNull();
    expect(String(versionInsert.values[3])).not.toContain(source);
    expect(String(versionInsert.values[3])).toContain('object:logo');
    expect(copied).toMatchObject({ mallId: targetMall.id, versionId: versionInsert.values[0] });
    expect(queries.some(({ sql }) => /experience\.(release|publication)/.test(sql))).toBe(false);
  });
});

function result(rows: readonly Record<string, unknown>[]) {
  return { rows: [...rows], rowCount: rows.length, command: '', oid: 0, fields: [] };
}
