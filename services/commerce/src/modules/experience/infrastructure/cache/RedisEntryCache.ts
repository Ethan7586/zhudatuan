import { CACHE_CATALOG } from '@shop/config/runtime';
import type { Cache } from '../../../../foundation/cache/Cache';
import { VersionedKey } from '../../../../foundation/cache/VersionedKey';
import type { EntryCache } from '../../application/port/EntryCache';
import type { StorefrontEntry } from '../../application/port/EntryRepository';

export class RedisEntryCache implements EntryCache {
  constructor(private readonly cache: Cache) {}

  read(handle: string): Promise<StorefrontEntry | null> {
    return this.cache.get<StorefrontEntry>(this.key(handle));
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
