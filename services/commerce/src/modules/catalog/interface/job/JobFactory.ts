import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { PROVIDER_SYNC_PORT } from '../../../channel/public';
import { PROVIDER_CATALOG_PORT } from '../../public';
import { CatalogImportProcess } from '../../application/process/CatalogImportProcess';
import { createImportProcess } from '../../infrastructure/persistence/PgImportProcess';
import { CatalogImportJob } from './CatalogImportJob';
import { IMPORT_BATCH_FACTORY_PORT, IMPORT_RUNNER_PORT, JOB_PORT, RUNTIME_IMPORT_PORT } from '../../../runtime/public';
import { PgCatalogImportRepository } from '../../infrastructure/persistence/PgCatalogImportRepository';
import { TASK_AUTHORIZATION_PORT } from '../../../access/public';
import { AUDIT_PORT } from '../../../audit/public';
import { CATALOG_PARTNER_PORT } from '../../../partner/public';
import { CATALOG_QUALIFICATION_PORT } from '../../../qualification/public';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const process = new CatalogImportProcess(
    context.ports.get(IMPORT_RUNNER_PORT),
    createImportProcess(
      context.ports.get(IMPORT_BATCH_FACTORY_PORT),
      new PgTransactionManager(pool),
      context.ports.get(RUNTIME_IMPORT_PORT),
      context.ports.get(JOB_PORT),
      new PgCatalogImportRepository(context.ports.get(CATALOG_PARTNER_PORT), context.ports.get(CATALOG_QUALIFICATION_PORT), context.ports.get(AUDIT_PORT)),
      context.ports.get(TASK_AUTHORIZATION_PORT)
    )
  );
  return Object.freeze([{ id: 'catalogimport', processor: new CatalogImportJob(process) }]);
}

export function createProviderJobs(context: ModuleContext): readonly ModuleJob[] {
  const channel = context.ports.get(PROVIDER_SYNC_PORT).catalog(context.ports.get(PROVIDER_CATALOG_PORT));
  return Object.freeze([{ id: 'catalogsync', processor: channel, deadletter: channel }]);
}
