import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../../foundation/application/AuditSink';
import { ModuleOperations, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { manageRiskPolicyOperations } from '../../03_application_yingyong/command/ManageRiskPolicy';
import { reviewRiskCaseOperations } from '../../03_application_yingyong/command/ReviewRiskCase';
import { getRiskCenterOperations } from '../../03_application_yingyong/query/GetRiskCenter';
import { PgRiskRepository } from '../../04_adapters_shixian/persistence/PgRiskRepository';

export function riskRoutes(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  const repository = (database: OperationDatabase) => new PgRiskRepository(database);
  return new ModuleOperations('risk', pool, context.container.get(AUDIT_SINK), { ...getRiskCenterOperations(repository), ...manageRiskPolicyOperations(repository),
    ...reviewRiskCaseOperations(repository) });
}
