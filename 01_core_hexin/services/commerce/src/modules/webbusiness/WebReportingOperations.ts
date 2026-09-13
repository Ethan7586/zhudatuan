import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, type OperationDatabase } from '../../foundation/application/ModuleOperations';
import { CACHE } from '../../foundation/cache/Cache';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { getDashboardOperations } from '../reporting/03_application_yingyong/query/GetDashboard';
import { PgReportingRepository } from '../reporting/04_adapters_shixian/persistence/PgReportingRepository';
import { WEB_REPORTING_OPERATION_IDS } from './WebBusinessOperationIds';

export function webReportingOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  const repository = (database: OperationDatabase) => new PgReportingRepository(database);
  return new ModuleOperations('reporting', pool, context.container.get(AUDIT_SINK),
    getDashboardOperations(repository, pool.workload('query'), context.container.get(CACHE)),
    WEB_REPORTING_OPERATION_IDS);
}
