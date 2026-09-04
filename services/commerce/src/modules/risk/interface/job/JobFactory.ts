import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { RISK_CATALOG_PORT } from '../../../catalog/public';
import { APPROVAL_PORT } from '../../../approval/public';
import { ApplyQualificationRisk } from '../../application/process/ApplyQualificationRisk';
import { ApplyRiskAction } from '../../application/process/ApplyRiskAction';
import { EvaluateDeferredRisk } from '../../application/process/EvaluateDeferredRisk';
import { ReplayRiskPolicy } from '../../application/process/ReplayRiskPolicy';
import { PgRiskReplayRepository } from '../../infrastructure/persistence/PgRiskReplayRepository';
import { RiskScanJob } from './RiskScanJob';
import { PgRiskWorkRepository } from '../../infrastructure/persistence/PgRiskWorkRepository';
import { PgRiskRepositoryFactory } from '../../infrastructure/persistence/PgRiskRepositoryFactory';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const transactions = new PgTransactionManager(context.service(DATABASE_POOL));
  const repositories = new PgRiskRepositoryFactory();
  const work = new PgRiskWorkRepository();
  return Object.freeze([
    {
      id: 'riskscan',
      processor: new RiskScanJob(
        new ReplayRiskPolicy(transactions, new PgRiskReplayRepository()),
        new ApplyQualificationRisk(transactions, context.ports.get(RISK_CATALOG_PORT)),
        new ApplyRiskAction(transactions, work, context.ports.get(APPROVAL_PORT), context.ports.get(RISK_CATALOG_PORT)),
        new EvaluateDeferredRisk(transactions, work, (transaction) => repositories.create(transaction))
      ),
    },
  ]);
}
