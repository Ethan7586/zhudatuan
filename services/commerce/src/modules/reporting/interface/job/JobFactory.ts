import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import { CACHE } from '../../../../platform/cache/Cache';
import { jobDefinition } from '../../../../pipeline/JobCatalog';
import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { ExportReport } from '../../application/process/ExportReport';
import { ProjectReporting } from '../../application/process/ProjectReporting';
import { PgReportingJobRepository } from '../../infrastructure/persistence/PgReportingJobRepository';
import { ExportJob } from './ExportJob';
import { ProjectionJob } from './ProjectionJob';
import { EXPORT_RUNNER_PORT } from '../../../runtime/public';
import { CATALOG_DIMENSION_PORT } from '../../../catalog/public';
import { EXPERIENCE_DIMENSION_PORT } from '../../../experience/public';
import { MEMBER_READ_PORT } from '../../../member/public';
import { ORGANIZATION_READ_PORT } from '../../../organization/public';
import { CATALOG_PARTNER_PORT } from '../../../partner/public';
import { DimensionReader } from '../../application/service/DimensionReader';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const transactions = new PgTransactionManager(pool);
  const repository = new PgReportingJobRepository();
  const dimensions = new DimensionReader(
    context.ports.get(ORGANIZATION_READ_PORT),
    context.ports.get(EXPERIENCE_DIMENSION_PORT),
    context.ports.get(CATALOG_DIMENSION_PORT),
    context.ports.get(MEMBER_READ_PORT),
    context.ports.get(CATALOG_PARTNER_PORT)
  );
  return Object.freeze([
    { id: 'projection', processor: new ProjectionJob(new ProjectReporting(transactions, repository, context.service(CACHE))) },
    {
      id: 'export',
      processor: new ExportJob(context.ports.get(EXPORT_RUNNER_PORT), new ExportReport(transactions, repository, dimensions, jobDefinition('export').retry.attempts)),
    },
  ]);
}
