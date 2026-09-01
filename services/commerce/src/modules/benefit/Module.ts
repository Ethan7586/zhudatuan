import { PgSupportBenefitPort } from './infrastructure/persistence/PgSupportBenefitPort';
import { PgBenefitReadPort } from './infrastructure/persistence/PgBenefitReadPort';

import { defineModule } from '../../bootstrap/DefinedModule';
import { Manifest } from './Manifest';
import { BenefitPort } from './infrastructure/persistence/BenefitPort';
import { BENEFIT_ACCOUNTING_PORT } from '../finance/public/index';
import { CHECKOUT_BENEFIT_PORT, PAYMENT_BENEFIT_PORT } from './public/index';
import { BENEFIT_READ_PORT } from './public/BenefitReadPort';
import { SUPPORT_BENEFIT_PORT } from './public/SupportBenefitPort';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { PgBenefitRepository } from './infrastructure/persistence/PgBenefitRepository';
import { AccountsReadHandler } from './application/handler/AccountsReadHandler';
import { LedgersReadHandler } from './application/handler/LedgersReadHandler';
import { PlansReadHandler } from './application/handler/PlansReadHandler';
import { PlansManageHandler } from './application/handler/PlansManageHandler';
import { BudgetsReadHandler } from './application/handler/BudgetsReadHandler';
import { BudgetsManageHandler } from './application/handler/BudgetsManageHandler';
import { GrantsCreateHandler } from './application/handler/GrantsCreateHandler';
import { GrantsDecideHandler } from './application/handler/GrantsDecideHandler';
import { GrantsReadHandler } from './application/handler/GrantsReadHandler';
import { GrantsControlHandler } from './application/handler/GrantsControlHandler';
import { GrantsRevokeHandler } from './application/handler/GrantsRevokeHandler';
import { LotsReadHandler } from './application/handler/LotsReadHandler';
import { createJobs } from './interface/job/JobFactory';

export const BenefitModule = defineModule(Manifest, {
  jobs: createJobs,
  handlers: (context) => {
    const repository = new PgBenefitRepository(new PgTransactionAccess(), context);
    return [
      new AccountsReadHandler(repository),
      new LedgersReadHandler(repository),
      new PlansReadHandler(repository),
      new PlansManageHandler(repository),
      new BudgetsReadHandler(repository),
      new BudgetsManageHandler(repository),
      new GrantsCreateHandler(repository),
      new GrantsDecideHandler(repository),
      new GrantsReadHandler(repository),
      new GrantsControlHandler(repository),
      new GrantsRevokeHandler(repository),
      new LotsReadHandler(repository),
    ];
  },
  ports: (context) => {
    const checkout = new BenefitPort();
    return [
      { token: CHECKOUT_BENEFIT_PORT, value: checkout },
      { token: PAYMENT_BENEFIT_PORT, value: new BenefitPort(context.ports.get(BENEFIT_ACCOUNTING_PORT)) },
      { token: BENEFIT_READ_PORT, value: new PgBenefitReadPort() },
      { token: SUPPORT_BENEFIT_PORT, value: new PgSupportBenefitPort() },
    ];
  },
  jobPorts: (context) => [{ token: PAYMENT_BENEFIT_PORT, value: new BenefitPort(context.ports.get(BENEFIT_ACCOUNTING_PORT)) }],
});
