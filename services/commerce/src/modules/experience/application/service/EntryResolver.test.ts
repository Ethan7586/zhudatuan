import { describe, expect, it, vi } from 'vitest';
import { Singleflight } from '../../../../foundation/performance/Singleflight';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { StorefrontEntry } from '../port/EntryRepository';
import { EntryResolver } from './EntryResolver';

const entry: StorefrontEntry = Object.freeze({
  application: 'application:one',
  handle: 'mall-one',
  url: 'https://fufu.wang/s/mall-one',
  mall: 'mall:one',
  pool: 'pool:one',
  release: 'release:one',
  version: 'version:one',
  tenant: 'tenant:one',
  contentHash: 'a'.repeat(64),
  objectKey: `experience/mall-one/${'a'.repeat(64)}.json`,
});

describe('EntryResolver', () => {
  it('returns a cache hit without querying PostgreSQL', async () => {
    const repository = { resolve: vi.fn() };
    const measured = vi.fn();
    const resolver = new EntryResolver(repository as never, { read: vi.fn(async () => entry), write: vi.fn(), remove: vi.fn() }, new Singleflight(), observer(measured));
    await expect(resolver.resolve(context(), 'mall-one')).resolves.toBe(entry);
    expect(repository.resolve).not.toHaveBeenCalled();
    expect(measured).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ cache: 'hit', result: 'success' }));
  });

  it('coalesces concurrent cold reads into one PostgreSQL lookup', async () => {
    const repository = { resolve: vi.fn(async () => entry) };
    const cache = { read: vi.fn(async () => null), write: vi.fn(async () => undefined), remove: vi.fn() };
    const resolver = new EntryResolver(repository, cache, new Singleflight(), observer());
    await expect(Promise.all(Array.from({ length: 100 }, () => resolver.resolve(context(), 'mall-one')))).resolves.toHaveLength(100);
    expect(repository.resolve).toHaveBeenCalledTimes(1);
    expect(cache.write).toHaveBeenCalledTimes(1);
  });

  it('falls back to PostgreSQL when Redis read or write is unavailable', async () => {
    const repository = { resolve: vi.fn(async () => entry) };
    const resolver = new EntryResolver(
      repository,
      {
        read: vi.fn(async () => {
          throw new Error('REDIS_UNAVAILABLE');
        }),
        write: vi.fn(async () => {
          throw new Error('REDIS_UNAVAILABLE');
        }),
        remove: vi.fn(),
      },
      new Singleflight(),
      observer()
    );
    await expect(resolver.resolve(context(), 'mall-one')).resolves.toBe(entry);
    expect(repository.resolve).toHaveBeenCalledTimes(1);
  });

  it('fails closed and reports a bounded error code when PostgreSQL also fails', async () => {
    const measured = vi.fn();
    const resolver = new EntryResolver(
      {
        resolve: vi.fn(async () => {
          throw new Error('SECRET_DATABASE_DETAIL');
        }),
      },
      {
        read: vi.fn(async () => null),
        write: vi.fn(),
        remove: vi.fn(),
      },
      new Singleflight(),
      observer(measured)
    );
    await expect(resolver.resolve(context(), 'mall-one')).rejects.toThrow('SECRET_DATABASE_DETAIL');
    expect(measured).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ result: 'failure', errorCode: 'STOREFRONT_ENTRY_FAILED' }));
  });
});

function context(): ReadTransactionContext {
  return { trace: 'trace:entry', operation: 'storefront.bootstrap.read', deadline: Date.now() + 10_000, signal: new AbortController().signal } as ReadTransactionContext;
}

function observer(resolve = vi.fn()) {
  return { resolve, states: vi.fn(), publication: vi.fn() };
}
