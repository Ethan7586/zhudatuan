import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, type OperationDatabase } from '../../foundation/application/ModuleOperations';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { getDashboardOperations, type DashboardCache } from '../reporting/03_application_yingyong/query/GetDashboard';
import { PgReportingRepository } from '../reporting/04_adapters_shixian/persistence/PgReportingRepository';
import { WEB_REPORTING_OPERATION_IDS } from './WebBusinessOperationIds';

export function webReportingOperations(context: ModuleContext, cache: DashboardCache = WEB_REPORTING_CACHE): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  const repository = (database: OperationDatabase) => new PgReportingRepository(database);
  return new ModuleOperations('reporting', pool, context.container.get(AUDIT_SINK),
    getDashboardOperations(repository, pool.workload('query'), cache, async () => 0),
    WEB_REPORTING_OPERATION_IDS);
}

class WebReportingMemoryCache implements DashboardCache {
  private readonly entries = new Map<string, Readonly<{ value: unknown; expiresAt: number }>>();

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

}

const WEB_REPORTING_CACHE = new WebReportingMemoryCache();
