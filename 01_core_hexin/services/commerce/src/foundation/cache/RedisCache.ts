import { createClient, type RedisClientType } from 'redis';
import type { Cache, CacheState } from './Cache';

const CACHE_COMMAND_TIMEOUT_MILLISECONDS = 100;

export class RedisCache implements Cache {
  private client: RedisClientType | undefined;
  private readonly unavailableListeners = new Set<(state: CacheState) => void>();
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
      const value = await this.commandClient().get(key);
      return value === null ? null : JSON.parse(value) as T;
    } catch (cause) {
      this.degrade(cause);
      return null;
    }
  }

  onUnavailable(listener: (state: CacheState) => void): () => void {
    this.unavailableListeners.add(listener);
    return () => this.unavailableListeners.delete(listener);
  }

  async put<T>(key: string, value: T, seconds: number): Promise<boolean> {
    if (!Number.isSafeInteger(seconds) || seconds < 1) throw new Error('CACHE_TTL_INVALID');
    if (!this.ready()) return false;
    try {
      await this.commandClient().set(key, JSON.stringify(value), { EX: seconds });
      return true;
    } catch (cause) {
      this.degrade(cause);
      return false;
    }
  }

  async remove(...keys: readonly string[]): Promise<boolean> {
    if (keys.length === 0) return true;
    if (!this.ready()) return false;
    try {
      await this.commandClient().del([...keys]);
      return true;
    } catch (cause) {
      this.degrade(cause);
      return false;
    }
  }

  state(): CacheState { return this.status; }

  async close(): Promise<void> {
    const client = this.client;
    this.client = undefined;
    if (client?.isOpen) await client.close().catch(() => client.destroy());
    this.status = Object.freeze({ available: false, reason: 'CACHE_CLOSED' });
  }

  private ready(): boolean {
    return this.status.available && this.client?.isReady === true;
  }

  private commandClient(): RedisClientType {
    return this.client!.withAbortSignal(AbortSignal.timeout(CACHE_COMMAND_TIMEOUT_MILLISECONDS));
  }

  private degrade(cause: unknown): void {
    const transitioned = this.status.available;
    const code = cause instanceof Error ? cause.message.split(':', 1)[0]!.slice(0, 120) : 'CACHE_UNAVAILABLE';
    this.status = Object.freeze({ available: false, reason: code });
    if (transitioned) for (const listener of this.unavailableListeners) listener(this.status);
  }
}
