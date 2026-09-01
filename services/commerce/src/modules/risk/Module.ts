import { defineModule } from '../../bootstrap/DefinedModule';
import { Manifest } from './Manifest';
import { createJobs } from './interface/job/JobFactory';
import { CheckoutRisk } from './infrastructure/persistence/CheckoutRisk';
import { CHECKOUT_RISK_PORT } from './public';
import { CenterReadHandler } from './application/handler/CenterReadHandler';
import { PoliciesManageHandler } from './application/handler/PoliciesManageHandler';
import { CasesReviewHandler } from './application/handler/CasesReviewHandler';
import { PgRiskAdministrationRepository } from './infrastructure/persistence/PgRiskAdministrationRepository';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { PgJobScheduler } from '../../adapter/database/PgJobScheduler';

export const RiskModule = defineModule(Manifest, {
  jobs: createJobs,
  handlers: () => {
    const transactions = new PgTransactionAccess();
    const risks = new PgRiskAdministrationRepository(transactions);
    return [new CenterReadHandler(risks), new PoliciesManageHandler(risks, new PgJobScheduler(transactions)), new CasesReviewHandler(risks)];
  },
  ports: [{ token: CHECKOUT_RISK_PORT, value: new CheckoutRisk() }],
});
