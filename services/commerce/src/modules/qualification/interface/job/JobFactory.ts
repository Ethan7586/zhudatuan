import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import { PgTransactionalOutbox } from '../../../../adapter/database/PgTransactionalOutbox';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { ExpireQualification } from '../../application/process/ExpireQualification';
import { PgQualificationCaseRepository } from '../../infrastructure/persistence/PgQualificationCaseRepository';
import { QualificationExpiryJob } from './QualificationExpiryJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  return Object.freeze([
    {
      id: 'qualificationexpiry',
      processor: new QualificationExpiryJob(
        new ExpireQualification(new PgTransactionManager(context.service(DATABASE_POOL)), new PgQualificationCaseRepository(), new PgTransactionalOutbox())
      ),
    },
  ]);
}
