import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { withReadTransaction } from '../../../test/TransactionFixture';
import { PgEntryRepository } from '../infrastructure/persistence/PgEntryRepository';

const storefront = Object.freeze({ origin: 'https://fufu.wang', entryPath: '/s' });

describe('storefront entry resolver', () => {
  it('resolves one canonical handle through the security-definer boundary', async () => {
    const row = Object.freeze({
      application: 'application:one',
      handle: 'mall-one',
      mall: 'mall:one',
      pool: 'pool:one',
      release: 'release:one',
      version: 'version:one',
      tenant: 'tenant:one',
      application_status: 'active',
      validation_state: 'valid',
      publication_state: 'active',
      content_hash: 'a'.repeat(64),
      configuration_hash: 'a'.repeat(64),
      object_key: 'experience/mall-one/content.json',
    });
    const query = vi.fn(async () => ({ rows: [row], rowCount: 1 }) as unknown as QueryResult);
    await expect(withReadTransaction(query, (context) => new PgEntryRepository(storefront).resolve(context, 'mall-one'))).resolves.toMatchObject({
      application: 'application:one',
      handle: 'mall-one',
      url: 'https://fufu.wang/s/mall-one',
      mall: 'mall:one',
      release: 'release:one',
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('experience.resolve_storefront_entry($1)'), ['mall-one']);
  });

  it('rejects unknown and noncanonical handles without leaking another mall', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }) as unknown as QueryResult);
    await expect(withReadTransaction(query, (context) => new PgEntryRepository(storefront).resolve(context, 'missing-mall'))).rejects.toMatchObject({ code: 'STOREFRONT_NOT_FOUND' });
    await expect(withReadTransaction(query, (context) => new PgEntryRepository(storefront).resolve(context, 'Missing-Mall'))).rejects.toMatchObject({ code: 'STOREFRONT_HANDLE_INVALID' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['disabled', { application_status: 'disabled' }, 'STOREFRONT_DISABLED'],
    ['unpublished', { release: null, version: null, validation_state: null, publication_state: null, content_hash: null, configuration_hash: null, object_key: null }, 'STOREFRONT_NOT_PUBLISHED'],
    ['retired', { publication_state: 'retired' }, 'STOREFRONT_PUBLICATION_UNAVAILABLE'],
    ['hash mismatch', { configuration_hash: 'b'.repeat(64) }, 'STOREFRONT_PUBLICATION_UNAVAILABLE'],
    ['missing pool', { pool: null }, 'STOREFRONT_PUBLICATION_UNAVAILABLE'],
  ] as const)('fails closed for a %s entry record', async (_scenario, override, code) => {
    const row = {
      application: 'application:one',
      handle: 'mall-one',
      mall: 'mall:one',
      pool: 'pool:one',
      release: 'release:one',
      version: 'version:one',
      tenant: 'tenant:one',
      application_status: 'active',
      validation_state: 'valid',
      publication_state: 'active',
      content_hash: 'a'.repeat(64),
      configuration_hash: 'a'.repeat(64),
      object_key: 'experience/mall-one/content.json',
      ...override,
    };
    const query = vi.fn(async () => ({ rows: [row], rowCount: 1 }) as unknown as QueryResult);
    await expect(withReadTransaction(query, (context) => new PgEntryRepository(storefront).resolve(context, 'mall-one'))).rejects.toMatchObject({ code });
  });
});
