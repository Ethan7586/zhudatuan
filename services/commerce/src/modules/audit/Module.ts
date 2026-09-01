import { defineModule } from '../../bootstrap/DefinedModule';
import { Manifest } from './Manifest';
import { createJobs } from './interface/job/JobFactory';
import { RecordsReadHandler } from './application/handler/RecordsReadHandler';
import { PgAuditHistoryRepository } from './infrastructure/persistence/PgAuditHistoryRepository';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';

export const AuditModule = defineModule(Manifest, {
  jobs: createJobs,
  handlers: () => [new RecordsReadHandler(new PgAuditHistoryRepository(new PgTransactionAccess()))],
});
