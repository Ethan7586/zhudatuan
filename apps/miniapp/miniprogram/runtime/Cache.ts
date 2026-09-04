import { CACHE_CATALOG } from '@shop/config/runtime';
import type { RouteId } from '../generated/RouteBinding';

interface CacheEntry {
  readonly value: unknown;
  readonly storedAt: number;
}

const PUBLIC_ROUTES = new Set<RouteId>(['miniapphome', 'miniappcatalog', 'miniappproduct']);

export class MiniappCache {
  private readonly entries = new Map<string, CacheEntry>();

  read(route: RouteId, key: string, now = Date.now()): unknown | undefined {
    if (!PUBLIC_ROUTES.has(route)) return undefined;
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    const maximum = (route === 'miniapphome' ? CACHE_CATALOG.publishedexperience.maximumSeconds : CACHE_CATALOG.listing.maximumSeconds) * 1_000;
    if (now - entry.storedAt > maximum) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  write(route: RouteId, key: string, value: unknown, now = Date.now()): void {
    if (PUBLIC_ROUTES.has(route)) this.entries.set(key, Object.freeze({ value, storedAt: now }));
  }

  clear(): void {
    this.entries.clear();
  }
}
