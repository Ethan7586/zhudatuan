import { PgReferralFinancePort } from './infrastructure/persistence/PgReferralFinancePort';

import { defineModule } from '../../bootstrap/DefinedModule';
import { Manifest } from './Manifest';
import { InvoicePort } from './application/service/InvoicePort';
import { FinancePort } from './infrastructure/persistence/FinancePort';
import { BENEFIT_ACCOUNTING_PORT, CHECKOUT_INVOICE_PORT, PROVIDER_FINANCE_PORT, VOUCHER_ACCOUNTING_PORT } from './public/index';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { REFERRAL_FINANCE_PORT } from './public/ReferralFinancePort';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { PgFinanceOperationRepository } from './infrastructure/persistence/PgFinanceOperationRepository';
import { OverviewReadHandler } from './application/handler/OverviewReadHandler';
import { EntriesReadHandler } from './application/handler/EntriesReadHandler';
import { StatementsReadHandler } from './application/handler/StatementsReadHandler';
import { StatementsExportHandler } from './application/handler/StatementsExportHandler';
import { ReconciliationsManageHandler } from './application/handler/ReconciliationsManageHandler';
import { ReconciliationsReadHandler } from './application/handler/ReconciliationsReadHandler';
import { SettlementsReadHandler } from './application/handler/SettlementsReadHandler';
import { SettlementsDecideHandler } from './application/handler/SettlementsDecideHandler';
import { SettlementsAdjustHandler } from './application/handler/SettlementsAdjustHandler';
import { WithdrawalsReadHandler } from './application/handler/WithdrawalsReadHandler';
import { WithdrawalsCreateHandler } from './application/handler/WithdrawalsCreateHandler';
import { WithdrawalsDecideHandler } from './application/handler/WithdrawalsDecideHandler';
import { WithdrawalsRecoverHandler } from './application/handler/WithdrawalsRecoverHandler';
import { HoldsReadHandler } from './application/handler/HoldsReadHandler';
import { PeriodsReadHandler } from './application/handler/PeriodsReadHandler';
import { PeriodsManageHandler } from './application/handler/PeriodsManageHandler';
import { BackfillsReadHandler } from './application/handler/BackfillsReadHandler';
import { BackfillsDecideHandler } from './application/handler/BackfillsDecideHandler';
import { PoliciesManageHandler } from './application/handler/PoliciesManageHandler';
import { InvoicesReadHandler } from './application/handler/InvoicesReadHandler';
import { InvoicesDownloadHandler } from './application/handler/InvoicesDownloadHandler';
import { ProfilesManageHandler } from './application/handler/ProfilesManageHandler';
import { ProfilesReadHandler } from './application/handler/ProfilesReadHandler';
import { RequestsCreateHandler } from './application/handler/RequestsCreateHandler';
import { RequestsReadHandler } from './application/handler/RequestsReadHandler';
import { RequestsCancelHandler } from './application/handler/RequestsCancelHandler';
import { RequestsDecideHandler } from './application/handler/RequestsDecideHandler';
import { RedInvoiceHandler } from './application/handler/RedInvoiceHandler';
import { PoliciesReadHandler } from './application/handler/PoliciesReadHandler';
import { PoliciesPreviewHandler } from './application/handler/PoliciesPreviewHandler';
import { RepairsReadHandler } from './application/handler/RepairsReadHandler';
import { RepairsPreviewHandler } from './application/handler/RepairsPreviewHandler';
import { RepairsSubmitHandler } from './application/handler/RepairsSubmitHandler';
import { RepairsDecideHandler } from './application/handler/RepairsDecideHandler';
import { RepairsReverseHandler } from './application/handler/RepairsReverseHandler';
import { createJobs, createProviderJobs } from './interface/job/JobFactory';
import { EVENT_SUBSCRIPTIONS } from '../../generated/EventSubscriptions';

export const FinanceModule = defineModule(Manifest, {
  jobs: createJobs,
  providerJobs: createProviderJobs,
  events: [{ handler: 'reconciliation', events: EVENT_SUBSCRIPTIONS.reconciliation }],
  handlers: (context) => {
    const repository = new PgFinanceOperationRepository(new PgTransactionAccess(), context);
    return [
      new OverviewReadHandler(repository),
      new EntriesReadHandler(repository),
      new StatementsReadHandler(repository),
      new StatementsExportHandler(repository),
      new ReconciliationsManageHandler(repository),
      new ReconciliationsReadHandler(repository),
      new SettlementsReadHandler(repository),
      new SettlementsDecideHandler(repository),
      new SettlementsAdjustHandler(repository),
      new WithdrawalsReadHandler(repository),
      new WithdrawalsCreateHandler(repository),
      new WithdrawalsDecideHandler(repository),
      new WithdrawalsRecoverHandler(repository),
      new HoldsReadHandler(repository),
      new PeriodsReadHandler(repository),
      new PeriodsManageHandler(repository),
      new BackfillsReadHandler(repository),
      new BackfillsDecideHandler(repository),
      new PoliciesManageHandler(repository),
      new InvoicesReadHandler(repository),
      new InvoicesDownloadHandler(repository),
      new ProfilesManageHandler(repository),
      new ProfilesReadHandler(repository),
      new RequestsCreateHandler(repository),
      new RequestsReadHandler(repository),
      new RequestsCancelHandler(repository),
      new RequestsDecideHandler(repository),
      new RedInvoiceHandler(repository),
      new PoliciesReadHandler(repository),
      new PoliciesPreviewHandler(repository),
      new RepairsReadHandler(repository),
      new RepairsPreviewHandler(repository),
      new RepairsSubmitHandler(repository),
      new RepairsDecideHandler(repository),
      new RepairsReverseHandler(repository),
    ];
  },
  ports: (context) => {
    const accounting = new FinancePort();
    return [
      { token: CHECKOUT_INVOICE_PORT, value: new InvoicePort() },
      { token: BENEFIT_ACCOUNTING_PORT, value: accounting },
      { token: VOUCHER_ACCOUNTING_PORT, value: accounting },
      { token: REFERRAL_FINANCE_PORT, value: new PgReferralFinancePort() },
    ];
  },
  jobPorts: () => {
    const accounting = new FinancePort();
    return [
      { token: BENEFIT_ACCOUNTING_PORT, value: accounting },
      { token: VOUCHER_ACCOUNTING_PORT, value: accounting },
      { token: REFERRAL_FINANCE_PORT, value: new PgReferralFinancePort() },
    ];
  },
  providerPorts: [{ token: PROVIDER_FINANCE_PORT, value: new FinancePort() }],
});
