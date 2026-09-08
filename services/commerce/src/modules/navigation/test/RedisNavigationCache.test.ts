import { describe, expect, it, vi } from 'vitest';
import type { Cache } from '../../../platform/cache/Cache';
import { NavigationKey } from '../domain/model/NavigationKey';
import { NavigationTree, type NavigationTreeValue } from '../domain/model/NavigationTree';
import { NavigationInvalidator } from '../infrastructure/cache/NavigationInvalidator';
import { RedisNavigationCache } from '../infrastructure/cache/RedisNavigationCache';

const secret = 'navigation-test-secret-is-at-least-thirty-two-bytes';

describe('RedisNavigationCache', () => {
  it('partitions and precisely invalidates principal, membership and scope entries', async () => {
    const memory = new MemoryCache();
    const cache = new RedisNavigationCache(memory, secret, telemetry());
    const first = key('principal:one', 'membership:one', 'enterprise:one');
    const second = key('principal:two', 'membership:two', 'enterprise:two');
    const firstPointer = pointer('principal:one', 'membership:one', 'enterprise:one');
    const secondPointer = pointer('principal:two', 'membership:two', 'enterprise:two');
    await cache.put(firstPointer, first, tree('enterprise:one'));
    await cache.put(secondPointer, second, tree('enterprise:two'));
    const invalidator = new NavigationInvalidator(cache, secret, { now: () => new Date('2026-09-04T00:00:00.000Z') });

    await expect(invalidator.invalidate({ event: 'event:membership:one', memberships: ['membership:one'] })).resolves.toBe(true);
    await expect(cache.get(firstPointer)).resolves.toBeNull();
    await expect(cache.get(secondPointer)).resolves.toBeInstanceOf(NavigationTree);

    await expect(invalidator.invalidate({ event: 'event:scope:two', scopes: ['enterprise:two'] })).resolves.toBe(true);
    await expect(cache.get(secondPointer)).resolves.toBeNull();
    expect(invalidator.lastEventAt()).toBe('2026-09-04T00:00:00.000Z');
  });

  it('uses event markers idempotently and rejects unsigned cache tampering', async () => {
    const memory = new MemoryCache();
    const count = vi.fn();
    const cache = new RedisNavigationCache(memory, secret, telemetry(count));
    const value = key('principal:one', 'membership:one', 'enterprise:one');
    const cachePointer = pointer('principal:one', 'membership:one', 'enterprise:one');
    await cache.put(cachePointer, value, tree('enterprise:one'));
    const envelope = memory.values.get(value.cache) as Readonly<Record<string, unknown>>;
    memory.values.set(value.cache, { ...envelope, catalog: 'tampered' });
    await expect(cache.get(cachePointer)).resolves.toBeNull();
    expect(count).toHaveBeenCalledWith('commerce.navigation.cache.failure', 1, expect.objectContaining({ errorCode: 'corrupt' }));

    const index = NavigationKey.index(secret, 'scope', 'enterprise:one');
    await expect(cache.accept('event:idempotent:one', [index])).resolves.toBe(true);
    await expect(cache.accept('event:idempotent:one', [index])).resolves.toBe(true);
  });
});

class MemoryCache implements Cache {
  readonly values = new Map<string, unknown>();
  start(): Promise<void> {
    return Promise.resolve();
  }
  get<T>(key: string): Promise<T | null> {
    return Promise.resolve((this.values.get(key) as T | undefined) ?? null);
  }
  put<T>(key: string, value: T): Promise<boolean> {
    this.values.set(key, value);
    return Promise.resolve(true);
  }
  setnx<T>(key: string, value: T): Promise<boolean> {
    if (this.values.has(key)) return Promise.resolve(false);
    this.values.set(key, value);
    return Promise.resolve(true);
  }
  compareDelete<T>(key: string, expected: T): Promise<boolean> {
    if (this.values.get(key) !== expected) return Promise.resolve(false);
    this.values.delete(key);
    return Promise.resolve(true);
  }
  remove(...keys: readonly string[]): Promise<boolean> {
    for (const key of keys) this.values.delete(key);
    return Promise.resolve(true);
  }
  state() {
    return { available: true } as const;
  }
  close(): Promise<void> {
    this.values.clear();
    return Promise.resolve();
  }
}

function key(principal: string, membership: string, scope: string): NavigationKey {
  return new NavigationKey(secret, { catalog: 'catalog:one', target: 'console', principal, membership, scope, accessVersion: 3, capabilityVersion: 5, featureVersion: 'feature:one' });
}

function pointer(principal: string, membership: string, scope: string): string {
  return NavigationKey.pointer(secret, { catalog: 'catalog:one', target: 'console', principal, membership, scope, accessVersion: 3, capabilityVersion: 5, featureVersion: 'feature:one' });
}

function tree(scope: string): NavigationTreeValue {
  return new NavigationTree({
    scope: { id: scope, kind: 'enterprise' },
    target: 'console',
    version: 'version:one',
    etag: '"version:one"',
    generatedAt: '2026-09-04T00:00:00.000Z',
    catalogVersion: 'catalog:one',
    defaultKey: 'root',
    defaultRoute: '/root',
    nodes: [
      {
        key: 'root',
        title: '导航首页',
        parent: null,
        order: 1,
        operation: 'navigation.tree.read',
        experience: { icon: 'home', routeKey: 'rootroute', route: '/root', component: 'home', placement: 'primary', disabled: false, disabledReason: null, breadcrumbs: [{ key: 'root', title: '导航首页' }] },
        children: [],
      },
    ],
  }).toValue();
}

function telemetry(count = vi.fn()) {
  return { metrics: { count } } as never;
}
