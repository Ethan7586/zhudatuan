import { createClient, type RedisClientType } from 'redis';
import type { Cache, CacheState } from './Cache';

export class RedisCache implements Cache {
  private client: RedisClientType | undefined;
  private status: CacheState = Object.freeze({ available: false, reason: 'CACHE_NOT_STARTED' });

  constructor(private readonly connection: () => Promise<string>) {}

  async start(): Promise<void> {
    try {
      const url = await this.connection();
      if (!/^rediss?:\/\//.test(url)) throw new Error('REDIS_CONNECTION_INVALID');
      const client = createClient({ url, socket: { connectTimeout: 3_000, reconnectStrategy: false } });
      client.on('error', (cause) => this.degrade(cause));
      this.client = client as RedisClientType;
      await client.connect();
      this.status = Object.freeze({ available: true });
    } catch (cause) {
      this.client?.destroy();
      this.client = undefined;
      this.degrade(cause);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.ready()) return null;
    try {
      const value = await this.client!.get(key);
      return value === null ? null : (JSON.parse(value) as T);
    } catch (cause) {
      this.degrade(cause);
      return null;
    }
  }

  async put<T>(key: string, value: T, seconds: number): Promise<boolean> {
    if (!Number.isSafeInteger(seconds) || seconds < 1) throw new Error('CACHE_TTL_INVALID');
    if (!this.ready()) return false;
    try {
      await this.client!.set(key, JSON.stringify(value), { EX: seconds });
      return true;
    } catch (cause) {
      this.degrade(cause);
      return false;
    }
  }

  async setnx<T>(key: string, value: T, seconds: number): Promise<boolean> {
    if (!Number.isSafeInteger(seconds) || seconds < 1) throw new Error('CACHE_TTL_INVALID');
    if (!this.ready()) return false;
    try {
      return (await this.client!.set(key, JSON.stringify(value), { EX: seconds, NX: true })) === 'OK';
    } catch (cause) {
      this.degrade(cause);
      return false;
    }
  }

  async compareDelete<T>(key: string, expected: T): Promise<boolean> {
    if (!this.ready()) return false;
    try {
      return (await this.client!.eval("if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", { keys: [key], arguments: [JSON.stringify(expected)] })) === 1;
    } catch (cause) {
      this.degrade(cause);
      return false;
    }
  }

  async remove(...keys: readonly string[]): Promise<boolean> {
    if (keys.length === 0) return true;
    if (!this.ready()) return false;
    try {
      await this.client!.del([...keys]);
      return true;
    } catch (cause) {
      this.degrade(cause);
      return false;
    }
  }

  state(): CacheState {
    return this.status;
  }

  async close(): Promise<void> {
    const client = this.client;
    this.client = undefined;
    if (client?.isOpen) await client.close().catch(() => client.destroy());
    this.status = Object.freeze({ available: false, reason: 'CACHE_CLOSED' });
  }

  private ready(): boolean {
    return this.status.available && this.client?.isReady === true;
  }

  private degrade(cause: unknown): void {
    const code = cause instanceof Error ? cause.name.slice(0, 120) : 'CACHE_UNAVAILABLE';
    this.status = Object.freeze({ available: false, reason: code });
  }
}
