import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { MallProvisionPort, OrganizationReadPort } from '../../../organization/public';
import { PgApplicationReader } from './PgApplicationReader';

describe('PgApplicationReader presentation projection', () => {
  it('combines the Experience head with one batched authoritative mall profile and domain binding health', async () => {
    const database = { query: vi.fn(async () => result([row])) } as unknown as SqlExecutor;
    const organizations = { descendants: vi.fn(async () => ['mall:one']) } as unknown as OrganizationReadPort;
    const malls = {
      malls: vi.fn(async () => [profile]),
      mall: vi.fn(async () => profile),
    } as unknown as MallProvisionPort;
    const reader = new PgApplicationReader({ database: () => database } as unknown as PgTransactionAccess, organizations, malls, { origin: 'https://shop.example.com', entryPath: '/s' });

    const items = await reader.readSummaries({ trace: 'trace:one' } as ReadTransactionContext, { scope: 'enterprise:one', application: '', page: { sort: null, id: null, fetch: 51 } });

    expect(items[0]).toMatchObject({ mallName: '示范商城', brandName: '示范品牌', theme: { preset: 'market' }, domain: { mode: 'custom', address: 'mall.example.com', state: 'ready' } });
    expect(malls.malls).toHaveBeenCalledWith(expect.anything(), ['mall:one']);
    expect(database.query).toHaveBeenCalledTimes(1);
  });
});

const theme = Object.freeze({ preset: 'market' as const, primaryColor: '#A23B32', accentColor: '#C99A45', logoObjectRef: null, faviconObjectRef: null });
const profile = Object.freeze({
  id: 'mall:one',
  name: '示范商城',
  code: 'DEMO',
  publicSlug: 'demo',
  brandName: '示范品牌',
  domain: Object.freeze({ mode: 'custom' as const, customDomain: 'mall.example.com' }),
  timezone: 'Asia/Shanghai',
  currency: 'CNY',
  theme,
  status: 'active' as const,
  version: 3,
});
const row = Object.freeze({
  id: 'application:one',
  mall_id: 'mall:one',
  code: 'DEMO',
  public_slug: 'demo',
  name: '示范商城',
  status: 'active' as const,
  is_primary: true,
  version: '5',
  head_sequence: '4',
  head_theme: theme,
  binding_domains: ['mall.example.com'],
  release_id: 'release:one',
  release_version: 'version:four',
  pool_id: 'pool:one',
  published_sequence: '4',
  validation_state: 'valid',
  publication_state: 'active',
  content_hash: 'a'.repeat(64),
  configuration_hash: 'a'.repeat(64),
  object_key: 'experience/demo/manifest.json',
  updated_at: '2026-09-04T00:00:00.000Z',
});

function result(rows: readonly Record<string, unknown>[]) {
  return { rows: [...rows], rowCount: rows.length, command: '', oid: 0, fields: [] };
}
