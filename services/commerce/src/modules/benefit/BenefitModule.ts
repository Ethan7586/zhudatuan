import { defineModule } from '../../bootstrap/DefinedModule';
import { benefitOperations } from './BenefitOperations';
import { Manifest } from './Manifest';
import { BenefitPort } from './BenefitPort';
import { BENEFIT_ACCOUNTING_PORT } from '../finance/public/index';
import { CHECKOUT_BENEFIT_PORT, PAYMENT_BENEFIT_PORT } from './public/index';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { BENEFIT_READ_PORT, PgBenefitReadPort } from './public/BenefitReadPort';
import { PgSupportBenefitPort, SUPPORT_BENEFIT_PORT } from './public/SupportBenefitPort';
import { readDatabaseWorkload } from '../../foundation/persistence/Workload';
export const BenefitModule = defineModule(Manifest, benefitOperations, (context) => {
  const checkout = new BenefitPort();
  return [
    { token: CHECKOUT_BENEFIT_PORT, value: checkout },
    { token: PAYMENT_BENEFIT_PORT, value: new BenefitPort(context.ports.get(BENEFIT_ACCOUNTING_PORT)) },
    { token: BENEFIT_READ_PORT, value: new PgBenefitReadPort(context.service(DATABASE_POOL), readDatabaseWorkload(context.workload)) },
    { token: SUPPORT_BENEFIT_PORT, value: new PgSupportBenefitPort() },
  ];
});
