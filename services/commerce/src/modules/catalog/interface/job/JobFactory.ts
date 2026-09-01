import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { OBJECT_STORE } from '../../../../foundation/infrastructure/ObjectStore';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { PROVIDER_SYNC_PORT } from '../../../channel/public';
import { PROVIDER_CATALOG_PORT } from '../../public';
import { CatalogImportProcess } from '../../application/process/CatalogImportProcess';
import { PgImportProcess } from '../../infrastructure/persistence/PgImportProcess';
import { CatalogImportJob } from './CatalogImportJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const process = new CatalogImportProcess(context.service(OBJECT_STORE), new PgImportProcess(new PgTransactionManager(pool)));
  return Object.freeze([{ id: 'catalogimport', processor: new CatalogImportJob(process) }]);
}

export function createProviderJobs(context: ModuleContext): readonly ModuleJob[] {
  return Object.freeze([{ id: 'catalogsync', processor: context.ports.get(PROVIDER_SYNC_PORT).catalog(context.ports.get(PROVIDER_CATALOG_PORT)) }]);
}
