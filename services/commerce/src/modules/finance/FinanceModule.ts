import { defineModule } from '../../bootstrap/DefinedModule';
import { financeRoutes } from './interface/http/FinanceRoutes';
import { Manifest } from './Manifest';
import { InvoicePort } from './InvoicePort';
import { FinancePort } from './FinancePort';
import { BENEFIT_ACCOUNTING_PORT, CHECKOUT_INVOICE_PORT, VOUCHER_ACCOUNTING_PORT } from './public/index';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { PgReferralFinancePort, REFERRAL_FINANCE_PORT } from './public/ReferralFinancePort';
import { writeDatabaseWorkload } from '../../foundation/persistence/Workload';
export const FinanceModule = defineModule(Manifest, financeRoutes, (context) => {
  const accounting = new FinancePort();
  return [
    { token: CHECKOUT_INVOICE_PORT, value: new InvoicePort() },
    { token: BENEFIT_ACCOUNTING_PORT, value: accounting },
    { token: VOUCHER_ACCOUNTING_PORT, value: accounting },
    { token: REFERRAL_FINANCE_PORT, value: new PgReferralFinancePort(context.service(DATABASE_POOL), writeDatabaseWorkload(context.workload)) },
  ];
});
