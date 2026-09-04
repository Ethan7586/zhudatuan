import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { OBJECT_STORE } from '../../../../foundation/infrastructure/ObjectStore';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { MEMBER_ACCESS_PORT, MEMBER_IMPORT_ACCESS_PORT } from '../../../access/public';
import { MEMBER_IMPORT_IDENTITY_PORT } from '../../../identity/public';
import { MemberImportProcess } from '../../application/process/MemberImportProcess';
import { PgImportProcess } from '../../infrastructure/persistence/PgImportProcess';
import { MemberImportJob } from './MemberImportJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const persistence = new PgImportProcess(
    new PgTransactionManager(pool),
    context.ports.get(MEMBER_IMPORT_IDENTITY_PORT),
    context.ports.get(MEMBER_IMPORT_ACCESS_PORT),
    context.ports.get(MEMBER_ACCESS_PORT)
  );
  const process = new MemberImportProcess(context.service(OBJECT_STORE), persistence);
  return Object.freeze([
    {
      id: 'memberimport',
      processor: new MemberImportJob(process),
    },
  ]);
}
