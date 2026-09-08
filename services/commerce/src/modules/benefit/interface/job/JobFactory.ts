import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { BENEFIT_ACCOUNTING_PORT } from '../../../finance/public';
import { BENEFIT_MEMBER_PORT } from '../../../member/public';
import { RunBenefitGrant } from '../../application/process/RunBenefitGrant';
import { BenefitDeadletter } from '../../infrastructure/persistence/BenefitDeadletter';
import { PgBenefitJobProcess } from '../../infrastructure/persistence/PgBenefitJobProcess';
import { BenefitJob } from './BenefitJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const transactions = new PgTransactionManager(pool);
  const finance = context.ports.get(BENEFIT_ACCOUNTING_PORT);
  const members = context.ports.get(BENEFIT_MEMBER_PORT);
  const deadletter = new BenefitDeadletter();
  const grants = new RunBenefitGrant(new PgBenefitJobProcess(transactions, finance, members));
  return Object.freeze([
    { id: 'benefitgrant', processor: new BenefitJob('benefitgrant', grants), deadletter },
    { id: 'benefitexpiry', processor: new BenefitJob('benefitexpiry', grants), deadletter },
  ]);
}
