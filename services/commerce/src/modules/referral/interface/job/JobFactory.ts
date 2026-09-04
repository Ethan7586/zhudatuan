import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { REFERRAL_FINANCE_PORT } from '../../../finance/public';
import { APPROVAL_READ_PORT } from '../../../approval/public';
import { ProcessReferralEvent } from '../../application/process/ProcessReferralEvent';
import { SettleReferral } from '../../application/process/SettleReferral';
import { PgCommissionSettlementProcess } from '../../infrastructure/persistence/PgCommissionSettlementProcess';
import { PgReferralEventProcess } from '../../infrastructure/persistence/PgReferralEventProcess';
import { ReferralEventJob } from './ReferralEventJob';
import { ReferralSettlementJob } from './ReferralSettlementJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const transactions = new PgTransactionManager(pool);
  const finance = context.ports.get(REFERRAL_FINANCE_PORT);
  const events = new ProcessReferralEvent(new PgReferralEventProcess(transactions, finance, context.ports.get(APPROVAL_READ_PORT)));
  const settlements = new SettleReferral(new PgCommissionSettlementProcess(transactions, finance));
  return Object.freeze([
    { id: 'referralevent', processor: new ReferralEventJob(events) },
    { id: 'referralsettlement', processor: new ReferralSettlementJob(settlements) },
  ]);
}
