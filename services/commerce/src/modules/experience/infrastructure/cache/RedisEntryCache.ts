import { CACHE_CATALOG } from '@shop/config/runtime';
import type { Cache } from '../../../../foundation/cache/Cache';
import { VersionedKey } from '../../../../foundation/cache/VersionedKey';
import type { EntryCache } from '../../application/port/EntryCache';
import type { StorefrontEntry } from '../../application/port/EntryRepository';

export class RedisEntryCache implements EntryCache {
  constructor(private readonly cache: Cache) {}

  async read(handle: string): Promise<StorefrontEntry | null> {
    return entry(await this.cache.get<unknown>(this.key(handle)), handle);
  }

  async write(entry: StorefrontEntry): Promise<void> {
    await this.cache.put(this.key(entry.handle), entry, CACHE_CATALOG.storefrontentry.maximumSeconds);
  }

  async remove(handle: string): Promise<void> {
    await this.cache.remove(this.key(handle));
  }

  private key(handle: string): string {
    return VersionedKey.create('storefrontentry', { handle });
  }
}

function entry(value: unknown, handle: string): StorefrontEntry | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Reflect.get(value, 'handle') !== handle) return null;
  const read = (field: string) => Reflect.get(value, field);
  const application = read('application');
  const mall = read('mall');
  const pool = read('pool');
  const release = read('release');
  const version = read('version');
  const tenant = read('tenant');
  const contentHash = read('contentHash');
  const objectKey = read('objectKey');
  const url = read('url');
  if (
    ![application, mall, pool, release, version, tenant, objectKey, url].every((item) => typeof item === 'string' && item.length >= 3) ||
    typeof contentHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(contentHash) ||
    !String(objectKey).endsWith(`/${contentHash}.json`)
  )
    return null;
  try {
    const address = new URL(String(url));
    if (address.protocol !== 'https:' || !address.pathname.endsWith(`/${handle}`)) return null;
  } catch {
    return null;
  }
  return Object.freeze({
    application: String(application),
    handle,
    url: String(url),
    mall: String(mall),
    pool: String(pool),
    release: String(release),
    version: String(version),
    tenant: String(tenant),
    contentHash,
    objectKey: String(objectKey),
  });
}
