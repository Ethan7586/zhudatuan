import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { NAVIGATION_CONFIGURATION } from '@shop/config/server';
import type { Telemetry } from '@shop/telemetry';
import type { Cache } from '../../../../foundation/cache/Cache';
import type { NavigationCacheRepository } from '../../application/port/NavigationCacheRepository';
import type { NavigationKey } from '../../domain/model/NavigationKey';
import { NavigationTree, type NavigationTreeValue } from '../../domain/model/NavigationTree';

interface CacheEnvelope {
  readonly schema: 1;
  readonly pointer: string;
  readonly key: string;
  readonly catalog: string;
  readonly tree: NavigationTreeValue;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly signature: string;
}

export class RedisNavigationCache implements NavigationCacheRepository {
  constructor(
    private readonly cache: Cache,
    private readonly secret: string,
    private readonly telemetry: Telemetry
  ) {
    if (secret.length < 32) throw new Error('NAVIGATION_CACHE_SECRET_INVALID');
  }

  async get(pointer: string): Promise<NavigationTree | null> {
    const key = await this.cache.get<string>(pointer);
    if (typeof key !== 'string' || !/^navigation:v1:[a-f0-9]{64}$/.test(key)) return null;
    const envelope = await this.cache.get<CacheEnvelope>(key);
    if (!this.valid(envelope, pointer, key)) {
      if (envelope !== null) this.observe('corrupt');
      return null;
    }
    try {
      return new NavigationTree(envelope.tree);
    } catch {
      this.observe('invalid');
      return null;
    }
  }

  async put(pointer: string, key: NavigationKey, tree: NavigationTreeValue): Promise<boolean> {
    const ttl = jitteredTtl();
    const now = Date.now();
    const unsigned = { schema: 1 as const, pointer, key: key.cache, catalog: tree.catalogVersion, tree, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + ttl * 1_000).toISOString() };
    const envelope = Object.freeze({ ...unsigned, signature: this.sign(unsigned) });
    if (Buffer.byteLength(JSON.stringify(envelope)) > NAVIGATION_CONFIGURATION.maximumBytes) throw new Error('NAVIGATION_CACHE_SIZE_EXCEEDED');
    const stored = await this.cache.put(key.cache, envelope, ttl);
    if (!stored) {
      this.observe('writefailure');
      return false;
    }
    for (const index of key.indexes) await this.remember(index, pointer, key.cache, ttl);
    return this.cache.put(pointer, key.cache, ttl);
  }

  async invalidate(indexes: readonly string[]): Promise<boolean> {
    let complete = true;
    for (const index of new Set(indexes)) {
      const keys = await this.cache.get<readonly string[]>(index);
      if (Array.isArray(keys) && keys.every((key) => typeof key === 'string')) complete = (await this.cache.remove(...keys, index)) && complete;
    }
    return complete;
  }

  async accept(event: string, indexes: readonly string[]): Promise<boolean> {
    if (!/^[A-Za-z0-9:.-]{8,200}$/.test(event)) throw new Error('NAVIGATION_EVENT_ID_INVALID');
    const marker = `navigation:event:${createHmac('sha256', this.secret).update(event).digest('hex')}`;
    if (!(await this.cache.setnx(marker, true, 86_400))) return true;
    const complete = await this.invalidate(indexes);
    if (!complete) await this.cache.remove(marker);
    return complete;
  }

  state() {
    return this.cache.state();
  }

  private async remember(index: string, pointer: string, key: string, ttl: number): Promise<void> {
    const lock = `${index}:lock`;
    const owner = createHmac('sha256', this.secret)
      .update(`${pointer}:${key}:${Date.now()}:${randomInt(1_000_000)}`)
      .digest('hex');
    if (!(await this.cache.setnx(lock, owner, 2))) {
      this.observe('indexcontention');
      return;
    }
    try {
      const current = await this.cache.get<readonly string[]>(index);
      const values = [...new Set([...(Array.isArray(current) ? current : []), pointer, key])].slice(-512);
      await this.cache.put(index, values, ttl);
    } finally {
      await this.cache.compareDelete(lock, owner);
    }
  }

  private valid(value: CacheEnvelope | null, pointer: string, key: string): value is CacheEnvelope {
    if (
      value === null ||
      value.schema !== 1 ||
      typeof value.catalog !== 'string' ||
      typeof value.createdAt !== 'string' ||
      value.pointer !== pointer ||
      value.key !== key ||
      typeof value.expiresAt !== 'string' ||
      typeof value.signature !== 'string' ||
      value.catalog !== value.tree?.catalogVersion ||
      Date.parse(value.expiresAt) <= Date.now()
    )
      return false;
    const unsigned = { schema: value.schema, pointer: value.pointer, key: value.key, catalog: value.catalog, tree: value.tree, createdAt: value.createdAt, expiresAt: value.expiresAt };
    const expected = Buffer.from(this.sign(unsigned), 'hex');
    const supplied = Buffer.from(value.signature, 'hex');
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  }

  private sign(value: Omit<CacheEnvelope, 'signature'>): string {
    return createHmac('sha256', this.secret).update(JSON.stringify(value)).digest('hex');
  }

  private observe(reason: string): void {
    this.telemetry.metrics.count('commerce.navigation.cache.failure', 1, { requestId: 'navigation-cache', traceId: 'navigation-cache', module: 'navigation', operation: 'cache', errorCode: reason });
  }
}

function jitteredTtl(): number {
  const { ttlSeconds, jitterRatio } = NAVIGATION_CONFIGURATION;
  const spread = Math.floor(ttlSeconds * jitterRatio);
  return ttlSeconds - spread + randomInt(spread * 2 + 1);
}
