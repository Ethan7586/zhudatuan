import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { RISK_CATALOG_PORT } from '../../../catalog/public';
import { ReplayRiskPolicy } from '../../application/process/ReplayRiskPolicy';
import { PgRiskReplayRepository } from '../../infrastructure/persistence/PgRiskReplayRepository';
import { RiskReplayJob } from './RiskReplayJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  return Object.freeze([
    {
      id: 'riskscan',
      processor: new RiskReplayJob(new ReplayRiskPolicy(new PgTransactionManager(context.service(DATABASE_POOL)), new PgRiskReplayRepository(), context.ports.get(RISK_CATALOG_PORT))),
    },
  ]);
}
import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
