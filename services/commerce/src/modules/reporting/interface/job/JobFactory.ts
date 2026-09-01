import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { CACHE } from '../../../../foundation/cache/Cache';
import { jobDefinition } from '../../../../foundation/application/JobCatalog';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { OBJECT_STORE } from '../../../../foundation/infrastructure/ObjectStore';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { ExportReport } from '../../application/process/ExportReport';
import { ProjectReporting } from '../../application/process/ProjectReporting';
import { PgReportingJobRepository } from '../../infrastructure/persistence/PgReportingJobRepository';
import { ExportJob } from './ExportJob';
import { ProjectionJob } from './ProjectionJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const transactions = new PgTransactionManager(pool);
  const repository = new PgReportingJobRepository();
  return Object.freeze([
    { id: 'projection', processor: new ProjectionJob(new ProjectReporting(transactions, repository, context.service(CACHE))) },
    {
      id: 'export',
      processor: new ExportJob(new ExportReport(transactions, repository, context.service(OBJECT_STORE), jobDefinition('export').retry.attempts)),
    },
  ]);
}
