import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { MEMBER_ACCESS_PORT, MEMBER_IMPORT_ACCESS_PORT } from '../../../access/public';
import { MEMBER_IMPORT_IDENTITY_PORT } from '../../../identity/public';
import { IMPORT_BATCH_FACTORY_PORT, IMPORT_RUNNER_PORT, JOB_PORT, RUNTIME_IMPORT_PORT } from '../../../runtime/public';
import { MemberImportProcess } from '../../application/process/MemberImportProcess';
import { createImportProcess } from '../../infrastructure/persistence/PgImportProcess';
import { MemberImportJob } from './MemberImportJob';
import { TASK_AUTHORIZATION_PORT } from '../../../access/public';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const persistence = createImportProcess(
    context.ports.get(IMPORT_BATCH_FACTORY_PORT),
    new PgTransactionManager(pool),
    context.ports.get(RUNTIME_IMPORT_PORT),
    context.ports.get(JOB_PORT),
    context.ports.get(MEMBER_IMPORT_IDENTITY_PORT),
    context.ports.get(MEMBER_IMPORT_ACCESS_PORT),
    context.ports.get(MEMBER_ACCESS_PORT),
    context.ports.get(TASK_AUTHORIZATION_PORT)
  );
  const process = new MemberImportProcess(context.ports.get(IMPORT_RUNNER_PORT), persistence);
  return Object.freeze([
    {
      id: 'memberimport',
      processor: new MemberImportJob(process),
    },
  ]);
}
