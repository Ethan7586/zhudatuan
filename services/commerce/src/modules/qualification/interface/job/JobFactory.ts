import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import { PgTransactionalOutbox } from '../../../../platform/database/PgTransactionalOutbox';
import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { ExpireQualification } from '../../application/process/ExpireQualification';
import { PgQualificationCaseRepository } from '../../infrastructure/persistence/PgQualificationCaseRepository';
import { QualificationExpiryJob } from './QualificationExpiryJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  return Object.freeze([
    {
      id: 'qualificationexpiry',
      processor: new QualificationExpiryJob(new ExpireQualification(new PgTransactionManager(context.service(DATABASE_POOL)), new PgQualificationCaseRepository(), new PgTransactionalOutbox())),
    },
  ]);
}
