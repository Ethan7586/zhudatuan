import { createHash } from 'node:crypto';
import { parseExperience, serializeExperience } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgExperienceReadPort } from './PgExperienceReadPort';

const document = parseExperience({
  version: 2,
  application: 'application:one',
  theme: { preset: 'shop', primaryColor: '#1F5EFF', accentColor: '#19A974', logoObjectRef: null, faviconObjectRef: null },
  navigation: [{ id: 'navigation:home', label: '首页', page: 'home' }],
  assets: [],
  pages: [{ id: 'home', path: 'home', blocks: [{ id: 'hero', component: 'hero', content: { title: '福利首页' } }] }],
});
const hash = createHash('sha256').update(serializeExperience(document)).digest('hex');
const published = Object.freeze({
  application: 'application:one',
  mall: 'mall:one',
  pool: 'pool:one',
  release: 'release:one',
  version: 'version:one',
  hash,
  document,
  effectiveAt: '2026-09-04T08:00:00.000Z',
  objectKey: `experience/one/${hash}.json`,
});

describe('PgExperienceReadPort cache isolation', () => {
  it('rejects a cross-mall or hash-poisoned cache record and rereads the authorized transaction', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce('version:one')
      .mockResolvedValueOnce({ ...published, mall: 'mall:other' });
    const put = vi.fn(async () => true);
    const query = vi.fn(async () =>
      result([
        {
          application: published.application,
          mall: published.mall,
          pool: published.pool,
          release: published.release,
          version: published.version,
          hash: published.hash,
          document: published.document,
          effective_at: published.effectiveAt,
          object_key: published.objectKey,
        },
      ])
    );
    const port = createPort(get, put, query);

    await expect(port.publishedFor(context(), { mall: 'mall:one', channel: 'web', locale: 'zh-CN' })).resolves.toMatchObject({
      mall: 'mall:one',
      version: 'version:one',
      channel: 'web',
      locale: 'zh-CN',
      etag: `"${hash}"`,
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('application.mall_id=$1'), ['mall:one']);
    expect(put).toHaveBeenCalledTimes(2);
  });

  it('serves an integrity-checked immutable version without touching PostgreSQL', async () => {
    const get = vi.fn().mockResolvedValueOnce('version:one').mockResolvedValueOnce(published);
    const query = vi.fn();
    const port = createPort(get, vi.fn(), query);
    await expect(port.publishedFor(context(), { mall: 'mall:one', channel: 'miniapp', locale: 'zh-CN' })).resolves.toMatchObject({ version: 'version:one' });
    expect(query).not.toHaveBeenCalled();
  });
});

function createPort(get: ReturnType<typeof vi.fn>, put: ReturnType<typeof vi.fn>, query: ReturnType<typeof vi.fn>) {
  const cache = { get, put, remove: vi.fn(), setnx: vi.fn(), compareDelete: vi.fn(), state: vi.fn(), start: vi.fn(), close: vi.fn() };
  const database = { query } as unknown as SqlExecutor;
  return new PgExperienceReadPort({} as never, cache as never, { database: () => database } as unknown as PgTransactionAccess);
}

function context(): ReadTransactionContext {
  return { trace: 'trace:one', operation: 'experience.published.read', deadline: Date.now() + 10_000, signal: new AbortController().signal } as ReadTransactionContext;
}

function result(rows: readonly Record<string, unknown>[]) {
  return { rows: [...rows], rowCount: rows.length, command: '', oid: 0, fields: [] };
}
