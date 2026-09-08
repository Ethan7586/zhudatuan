import { PgReferralFinancePort } from './infrastructure/persistence/PgReferralFinancePort';

import { defineModule } from '../../composition/DefinedModule';
import { Manifest } from './Manifest';
import { InvoicePort } from './application/service/InvoicePort';
import { BENEFIT_ACCOUNTING_PORT, BENEFIT_SETTLEMENT_READ_PORT, CHECKOUT_INVOICE_PORT, ORDER_IMPORT_FINANCE_PORT, PROVIDER_FINANCE_PORT, VOUCHER_ACCOUNTING_PORT } from './public/index';
import { DATABASE_POOL } from '../../platform/database/Pool';
import { REFERRAL_FINANCE_PORT } from './public/ReferralFinancePort';
import { PgTransactionAccess } from '../../platform/database/PgTransactionAccess';
import { createFinanceAdapters } from './infrastructure/persistence/FinanceAdapters';
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
import { ImportsCreateHandler } from './application/handler/ImportsCreateHandler';
import { ImportsReadHandler } from './application/handler/ImportsReadHandler';
import { FacetsReadHandler } from './application/handler/FacetsReadHandler';
import { createJobs, createProviderJobs } from './interface/job/JobFactory';
import { PgJobScheduler } from '../../platform/database/PgJobScheduler';
import { IMPORT_OBJECT_PORT, RUNTIME_IMPORT_PORT } from '../runtime/public';
import { OBJECT_STORE } from '../runtime/public/ObjectPort';
import { PgFacetRepository } from './infrastructure/persistence/PgFacetRepository';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { FINANCE_CHANNEL_PORT } from '../channel/public';
import { AUDIT_READ_PORT } from '../audit/public';
import { EVENT_EVIDENCE_READ_PORT } from '../runtime/public';
import { AuditReadHandler } from './application/handler/AuditReadHandler';
import { PgAuditProjectionRepository } from './infrastructure/persistence/PgAuditProjectionRepository';
import { PgAccountingPort } from './infrastructure/persistence/PgAccountingPort';
import { PgSettlementReadPort } from './infrastructure/persistence/PgSettlementReadPort';
import { PgStatementEvidencePort } from './infrastructure/persistence/PgStatementEvidencePort';
import { PgChannelReconciliationPort } from './infrastructure/persistence/PgChannelReconciliationPort';
import { FinanceEventSubscriptions } from './interface/event/FinanceEventSubscriptions';

export const FinanceModule = defineModule(Manifest, {
  jobs: createJobs,
  providerJobs: createProviderJobs,
  events: FinanceEventSubscriptions,
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const finance = createFinanceAdapters(transactions, context);
    const imports = context.ports.get(RUNTIME_IMPORT_PORT);
    return [
      new OverviewReadHandler(finance.accountRead),
      new FacetsReadHandler(new PgFacetRepository(transactions), context.ports.get(ORGANIZATION_READ_PORT), context.ports.get(FINANCE_CHANNEL_PORT)),
      new AuditReadHandler(new PgAuditProjectionRepository(transactions), context.ports.get(ORGANIZATION_READ_PORT), context.ports.get(EVENT_EVIDENCE_READ_PORT), context.ports.get(AUDIT_READ_PORT)),
      new EntriesReadHandler(finance.journalRead),
      new ImportsCreateHandler(imports, new PgJobScheduler(transactions), context.ports.get(IMPORT_OBJECT_PORT), context.ports.get(ORGANIZATION_READ_PORT), context.ports.get(FINANCE_CHANNEL_PORT)),
      new ImportsReadHandler(imports, context.service(OBJECT_STORE)),
      new StatementsReadHandler(finance.statementRead),
      new StatementsExportHandler(finance.statementProcess),
      new ReconciliationsManageHandler(finance.reconciliation),
      new ReconciliationsReadHandler(finance.reconciliationRead),
      new SettlementsReadHandler(finance.settlementRead),
      new SettlementsDecideHandler(finance.settlement),
      new SettlementsAdjustHandler(finance.settlement),
      new WithdrawalsReadHandler(finance.withdrawalRead),
      new WithdrawalsCreateHandler(finance.withdrawal),
      new WithdrawalsDecideHandler(finance.withdrawal),
      new WithdrawalsRecoverHandler(finance.withdrawal),
      new HoldsReadHandler(finance.accountRead),
      new PeriodsReadHandler(finance.accountRead),
      new PeriodsManageHandler(finance.period),
      new BackfillsReadHandler(finance.statementRead),
      new BackfillsDecideHandler(finance.statementProcess),
      new PoliciesManageHandler(finance.policyCommand),
      new InvoicesReadHandler(finance.invoiceRead),
      new InvoicesDownloadHandler(finance.invoiceProcess),
      new ProfilesManageHandler(finance.invoiceProfile),
      new ProfilesReadHandler(finance.invoiceRead),
      new RequestsCreateHandler(finance.invoiceRequest),
      new RequestsReadHandler(finance.invoiceRead),
      new RequestsCancelHandler(finance.invoiceRequest),
      new RequestsDecideHandler(finance.invoiceRequest),
      new RedInvoiceHandler(finance.invoiceRequest),
      new PoliciesReadHandler(finance.policyRead),
      new PoliciesPreviewHandler(finance.policyProcess),
      new RepairsReadHandler(finance.repairRead),
      new RepairsPreviewHandler(finance.repairProcess),
      new RepairsSubmitHandler(finance.repairProcess),
      new RepairsDecideHandler(finance.repairProcess),
      new RepairsReverseHandler(finance.repairProcess),
    ];
  },
  ports: () => {
    const accounting = new PgAccountingPort();
    return [
      { token: CHECKOUT_INVOICE_PORT, value: new InvoicePort() },
      { token: BENEFIT_ACCOUNTING_PORT, value: accounting },
      { token: BENEFIT_SETTLEMENT_READ_PORT, value: new PgSettlementReadPort() },
      { token: VOUCHER_ACCOUNTING_PORT, value: accounting },
      { token: REFERRAL_FINANCE_PORT, value: new PgReferralFinancePort() },
      { token: ORDER_IMPORT_FINANCE_PORT, value: new PgStatementEvidencePort() },
    ];
  },
  jobPorts: () => {
    const accounting = new PgAccountingPort();
    return [
      { token: BENEFIT_ACCOUNTING_PORT, value: accounting },
      { token: VOUCHER_ACCOUNTING_PORT, value: accounting },
      { token: REFERRAL_FINANCE_PORT, value: new PgReferralFinancePort() },
      { token: ORDER_IMPORT_FINANCE_PORT, value: new PgStatementEvidencePort() },
    ];
  },
  providerPorts: [{ token: PROVIDER_FINANCE_PORT, value: new PgChannelReconciliationPort() }],
});
