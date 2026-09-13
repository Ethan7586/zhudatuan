import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, type OperationDatabase } from '../../foundation/application/ModuleOperations';
import { CACHE, type Cache, type CacheState } from '../../foundation/cache/Cache';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { getDashboardOperations } from '../reporting/03_application_yingyong/query/GetDashboard';
import { PgReportingRepository } from '../reporting/04_adapters_shixian/persistence/PgReportingRepository';
import { WEB_REPORTING_OPERATION_IDS } from './WebBusinessOperationIds';

export function webReportingOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  const repository = (database: OperationDatabase) => new PgReportingRepository(database);
  return new ModuleOperations('reporting', pool, context.container.get(AUDIT_SINK),
    getDashboardOperations(repository, pool.workload('query'),
      context.container.has(CACHE) ? context.container.get(CACHE) : WEB_REPORTING_CACHE),
    WEB_REPORTING_OPERATION_IDS);
}

class WebReportingMemoryCache implements Cache {
  private readonly entries = new Map<string, Readonly<{ value: unknown; expiresAt: number }>>();

  async start(): Promise<void> {}
  onUnavailable(): () => void { return () => undefined; }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async put<T>(key: string, value: T, seconds: number): Promise<boolean> {
    if (!this.entries.has(key) && this.entries.size >= 512) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, Object.freeze({ value, expiresAt: Date.now() + (seconds * 1_000) }));
    return true;
  }

  async remove(...keys: readonly string[]): Promise<boolean> {
    for (const key of keys) this.entries.delete(key);
    return true;
  }

  state(): CacheState { return Object.freeze({ available: true }); }
  async close(): Promise<void> { this.entries.clear(); }
}

const WEB_REPORTING_CACHE = new WebReportingMemoryCache();
