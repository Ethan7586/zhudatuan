import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../../foundation/application/AuditSink';
import { ModuleOperations, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { OBJECT_STORE } from '../../../../foundation/infrastructure/ObjectStore';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { CACHE } from '../../../../foundation/cache/Cache';
import { createExportOperations } from '../../application/command/CreateExport';
import { getDashboardOperations } from '../../application/query/GetDashboard';
import { getExportOperations } from '../../application/query/GetExport';
import { getSalesReportOperations } from '../../application/query/GetSalesReport';
import { PgReportingRepository } from '../../infrastructure/persistence/PgReportingRepository';

export function reportingRoutes(context: ModuleContext): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  const objects = context.service(OBJECT_STORE);
  const cache = context.service(CACHE);
  const repository = (database: OperationDatabase) => new PgReportingRepository(database);
  return new ModuleOperations('reporting', pool, context.service(AUDIT_SINK), {
    ...getDashboardOperations(repository, cache),
    ...getSalesReportOperations(repository, cache),
    ...createExportOperations(repository),
    ...getExportOperations(repository, objects),
  });
}
