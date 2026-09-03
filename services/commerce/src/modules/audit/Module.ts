import { defineModule } from '../../bootstrap/DefinedModule';
import { Manifest } from './Manifest';
import { createJobs } from './interface/job/JobFactory';
import { RecordsReadHandler } from './application/handler/RecordsReadHandler';
import { PgAuditHistoryRepository } from './infrastructure/persistence/PgAuditHistoryRepository';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { ORDER_AUDIT_READ_PORT } from './public';
import { PgOrderAuditReadPort } from './infrastructure/persistence/PgOrderAuditReadPort';

export const AuditModule = defineModule(Manifest, {
  jobs: createJobs,
  handlers: () => [new RecordsReadHandler(new PgAuditHistoryRepository(new PgTransactionAccess()))],
  ports: [{ token: ORDER_AUDIT_READ_PORT, value: new PgOrderAuditReadPort() }],
});
