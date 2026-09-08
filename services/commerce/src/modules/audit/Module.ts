import { defineModule } from '../../composition/DefinedModule';
import { Manifest } from './Manifest';
import { createJobs } from './interface/job/JobFactory';
import { RecordsReadHandler } from './application/handler/RecordsReadHandler';
import { PgAuditHistoryRepository } from './infrastructure/persistence/PgAuditHistoryRepository';
import { PgTransactionAccess } from '../../platform/database/PgTransactionAccess';
import { AUDIT_PORT, AUDIT_READ_PORT } from './public';
import { PgAuditReadPort } from './infrastructure/persistence/PgAuditReadPort';
import { AUDIT_SINK } from '../../pipeline/AuditSink';

export const AuditModule = defineModule(Manifest, {
  jobs: createJobs,
  handlers: (context) => [new RecordsReadHandler(new PgAuditHistoryRepository(new PgTransactionAccess()), context.service(AUDIT_SINK))],
  ports: (context) => [
    { token: AUDIT_PORT, value: context.service(AUDIT_SINK) },
    { token: AUDIT_READ_PORT, value: new PgAuditReadPort() },
  ],
});
