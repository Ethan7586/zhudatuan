import type { Singleflight } from '@shop/kernel';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { EntryCache } from '../port/EntryCache';
import type { EntryRepository, StorefrontEntry } from '../port/EntryRepository';
import type { ExperienceObserver } from '../port/ExperienceObserver';
import { safeErrorCode } from '../../../../platform/error/SafeError';

export class EntryResolver {
  constructor(
    private readonly repository: EntryRepository,
    private readonly cache: EntryCache,
    private readonly flights: Singleflight,
    private readonly observer: ExperienceObserver
  ) {}

  async resolve(context: ReadTransactionContext, handle: string): Promise<StorefrontEntry> {
    const started = performance.now();
    let cache: 'hit' | 'miss' = 'miss';
    try {
      const cached = await this.readCache(handle);
      if (cached) {
        cache = 'hit';
        this.observer.resolve(context, { cache, result: 'success', milliseconds: performance.now() - started });
        return cached;
      }
      const entry = await this.flights.run(
        `storefrontentry:${handle}`,
        async () => {
          const repeated = await this.readCache(handle);
          if (repeated) return repeated;
          const resolved = await this.repository.resolve(context, handle);
          await this.writeCache(resolved);
          return resolved;
        },
        { signal: context.signal, deadline: context.deadline }
      );
      this.observer.resolve(context, { cache, result: 'success', milliseconds: performance.now() - started });
      return entry;
    } catch (cause) {
      this.observer.resolve(context, { cache, result: 'failure', milliseconds: performance.now() - started, errorCode: safeErrorCode(cause, 'STOREFRONT_ENTRY_FAILED') });
      throw cause;
    }
  }

  private async readCache(handle: string): Promise<StorefrontEntry | null> {
    try {
      return await this.cache.read(handle);
    } catch {
      return null;
    }
  }

  private async writeCache(entry: StorefrontEntry): Promise<void> {
    try {
      await this.cache.write(entry);
    } catch {
      // PostgreSQL remains authoritative when the short-lived cache is unavailable.
    }
  }
}
