import { CACHE_CATALOG } from '@shop/config/runtime';
import type { RouteId } from '../generated/RouteBinding';

interface CacheEntry {
  readonly key: string;
  readonly value: unknown;
  readonly storedAt: number;
}

const PUBLIC_ROUTES = new Set<RouteId>(['miniapphome', 'miniappcatalog', 'miniappproduct']);
const STORAGE_PREFIX = 'zhudatuan:miniapp:public:v2:';
const STORAGE_INDEX = `${STORAGE_PREFIX}index`;

export class MiniappCache {
  private readonly entries = new Map<string, CacheEntry>();

  read(route: RouteId, key: string, now = Date.now()): unknown | undefined {
    if (!PUBLIC_ROUTES.has(route)) return undefined;
    const entry = this.entries.get(key) ?? this.restore(key);
    if (entry === undefined) return undefined;
    const maximum = (route === 'miniapphome' ? CACHE_CATALOG.publishedexperience.maximumSeconds : CACHE_CATALOG.listing.maximumSeconds) * 1_000;
    if (now - entry.storedAt > maximum) {
      this.remove(key);
      return undefined;
    }
    return entry.value;
  }

  write(route: RouteId, key: string, value: unknown, now = Date.now()): void {
    if (!PUBLIC_ROUTES.has(route)) return;
    const entry = Object.freeze({ key, value, storedAt: now });
    this.entries.set(key, entry);
    try {
      const storageKey = this.storageKey(key);
      wx.setStorageSync(storageKey, entry);
      wx.setStorageSync(STORAGE_INDEX, Object.freeze([...new Set([...this.index(), storageKey])].slice(-50)));
    } catch {
      // Memory cache remains usable when the device storage quota is exhausted.
    }
  }

  clear(): void {
    this.entries.clear();
    try {
      for (const key of this.index()) wx.removeStorageSync(key);
      wx.removeStorageSync(STORAGE_INDEX);
    } catch {
      // A later write repairs the bounded index.
    }
  }

  private restore(key: string): CacheEntry | undefined {
    try {
      const candidate = wx.getStorageSync(this.storageKey(key));
      if (!isCacheEntry(candidate) || candidate.key !== key) return undefined;
      this.entries.set(key, candidate);
      return candidate;
    } catch {
      return undefined;
    }
  }

  private remove(key: string): void {
    this.entries.delete(key);
    try {
      wx.removeStorageSync(this.storageKey(key));
    } catch {
      // Expired memory state is already removed.
    }
  }

  private storageKey(key: string): string {
    let hash = 2_166_136_261;
    for (let index = 0; index < key.length; index += 1) hash = Math.imul(hash ^ key.charCodeAt(index), 16_777_619);
    return `${STORAGE_PREFIX}${(hash >>> 0).toString(36)}`;
  }

  private index(): readonly string[] {
    const candidate = wx.getStorageSync(STORAGE_INDEX);
    return Array.isArray(candidate) ? candidate.filter((value): value is string => typeof value === 'string' && value.startsWith(STORAGE_PREFIX)) : [];
  }
}

function isCacheEntry(value: unknown): value is CacheEntry {
  if (value === null || typeof value !== 'object') return false;
  return typeof Reflect.get(value, 'key') === 'string' && typeof Reflect.get(value, 'storedAt') === 'number' && 'value' in value;
}
