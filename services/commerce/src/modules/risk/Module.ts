import { defineModule } from '../../composition/DefinedModule';
import { Manifest } from './Manifest';
import { createJobs } from './interface/job/JobFactory';
import { EvaluateRiskDecision } from './infrastructure/persistence/EvaluateRiskDecision';
import { RISK_DECISION_PORT } from './public';
import { CenterReadHandler } from './application/handler/CenterReadHandler';
import { PoliciesManageHandler } from './application/handler/PoliciesManageHandler';
import { CasesReviewHandler } from './application/handler/CasesReviewHandler';
import { PgRiskAdministrationRepository } from './infrastructure/persistence/PgRiskAdministrationRepository';
import { PgTransactionAccess } from '../../platform/database/PgTransactionAccess';
import { PgJobScheduler } from '../../platform/database/PgJobScheduler';
import { MEMBER_READ_PORT } from '../member/public';
import { EVENT_SUBSCRIPTIONS } from '../../generated/EventSubscriptions';

export const RiskModule = defineModule(Manifest, {
  jobs: createJobs,
  events: [{ handler: 'riskscan', events: EVENT_SUBSCRIPTIONS.riskscan }],
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const risks = new PgRiskAdministrationRepository(transactions);
    return [new CenterReadHandler(risks, context.ports.get(MEMBER_READ_PORT)), new PoliciesManageHandler(risks, new PgJobScheduler(transactions)), new CasesReviewHandler(risks)];
  },
  ports: [{ token: RISK_DECISION_PORT, value: new EvaluateRiskDecision() }],
});
