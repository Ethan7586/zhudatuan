import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import type { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { KMS_CLIENT } from '../../../../pipeline/KmsPort';
import { SECURITY_KEYS } from '../../../../platform/secret/SecretStore';
import { SystemClock } from '@shop/kernel';
import { MEMBER_ACCESS_PORT } from '../../../access/public';
import { APPROVAL_PORT, APPROVAL_READ_PORT } from '../../../approval/public';
import { ORGANIZATION_READ_PORT } from '../../../organization/public';
import { OBJECT_STORE } from '../../../runtime/public/ObjectPort';
import { FINANCE_ORDER_PORT } from '../../../order/public';
import { FINANCE_PAYMENT_PORT } from '../../../payment/public';
import type {
  AccountReadRepository,
  InvoiceReadRepository,
  JournalReadRepository,
  PolicyReadRepository,
  ReconciliationReadRepository,
  RepairReadRepository,
  SettlementReadRepository,
  StatementReadRepository,
  WithdrawalReadRepository,
} from '../../application/port/FinanceReadRepository';
import type { InvoiceProfileRepository, InvoiceRequestRepository, PeriodRepository, PolicyCommandRepository, ReconciliationRepository, SettlementRepository, WithdrawalRepository } from '../../application/port/FinanceCommandRepository';
import type { InvoiceProcessAdapter, PolicyProcessAdapter, RepairProcessAdapter, StatementProcessAdapter } from '../../application/port/FinanceProcessAdapter';
import { RepairApproval } from '../../application/service/RepairApproval';
import { PolicyPreview } from '../../domain/policy/PolicyPreview';
import { RepairPolicy } from '../../domain/policy/RepairPolicy';
import { accountQueries } from './AccountQueries';
import { backfillActions } from './BackfillActions';
import { FinanceScopeQuery } from './FinanceScopeQuery';
import { invoiceActions } from './InvoiceActions';
import { invoiceProfileActions } from './InvoiceProfileActions';
import { invoiceQueries } from './InvoiceQueries';
import { financeOverviewQueries } from './OverviewQueries';
import { periodActions } from './PeriodActions';
import { PgFinanceProcessAdapter } from './PgFinanceProcessAdapter';
import { PgFinanceWorkflow } from './PgFinanceWorkflow';
import type { FinanceWorkflowFactory } from './PgFinanceWorkflow';
import { PgPolicyRepository } from './PgPolicyRepository';
import { PgRepairRepository } from './PgRepairRepository';
import { financePolicyOperations } from './PolicyActions';
import { policyCommands } from './PolicyCommands';
import { reconciliationCommands } from './ReconciliationCommands';
import { reconciliationQueries } from './ReconciliationQueries';
import { repairOperations } from './RepairActions';
import { settlementAdjustmentActions } from './SettlementAdjustmentActions';
import { settlementDecisionActions } from './SettlementDecisionActions';
import { settlementQueries } from './SettlementQueries';
import { statementQueries } from './StatementQueries';
import { withdrawalActions } from './WithdrawalActions';
import { withdrawalQueries } from './WithdrawalQueries';

export interface FinanceAdapters {
  readonly accountRead: AccountReadRepository;
  readonly journalRead: JournalReadRepository;
  readonly statementRead: StatementReadRepository;
  readonly statementProcess: StatementProcessAdapter;
  readonly period: PeriodRepository;
  readonly reconciliationRead: ReconciliationReadRepository;
  readonly reconciliation: ReconciliationRepository;
  readonly settlementRead: SettlementReadRepository;
  readonly settlement: SettlementRepository;
  readonly withdrawalRead: WithdrawalReadRepository;
  readonly withdrawal: WithdrawalRepository;
  readonly invoiceRead: InvoiceReadRepository;
  readonly invoiceProcess: InvoiceProcessAdapter;
  readonly invoiceProfile: InvoiceProfileRepository;
  readonly invoiceRequest: InvoiceRequestRepository;
  readonly policyRead: PolicyReadRepository;
  readonly policyCommand: PolicyCommandRepository;
  readonly policyProcess: PolicyProcessAdapter;
  readonly repairRead: RepairReadRepository;
  readonly repairProcess: RepairProcessAdapter;
}

export function createFinanceAdapters(transactions: PgTransactionAccess, context: ModuleContext): FinanceAdapters {
  const bind = new PgFinanceProcessAdapter(transactions);
  const organization = context.ports.get(ORGANIZATION_READ_PORT);
  const scopes = new FinanceScopeQuery(organization);
  const key = context.service(SECURITY_KEYS).quote;
  const repairPolicy = new RepairPolicy(key);
  const overview = financeOverviewQueries(scopes);
  const accounts = accountQueries(scopes);
  const periods = periodActions(scopes);
  const statements = statementQueries(scopes);
  const backfills = backfillActions(scopes);
  const reconciliationReads = reconciliationQueries(scopes);
  const reconciliations = reconciliationCommands();
  const settlementReads = settlementQueries(scopes);
  const settlementWorkflow: FinanceWorkflowFactory = (database) => new PgFinanceWorkflow(database);
  const settlementDecisions = settlementDecisionActions(settlementWorkflow);
  const settlementAdjustments = settlementAdjustmentActions(settlementWorkflow);
  const withdrawalReads = withdrawalQueries(scopes);
  const withdrawals = withdrawalActions((database) => new PgFinanceWorkflow(database));
  const invoiceReads = invoiceQueries(context.ports.get(MEMBER_ACCESS_PORT), context.service(OBJECT_STORE));
  const invoices = invoiceActions((database) => new PgFinanceWorkflow(database), context.ports.get(FINANCE_ORDER_PORT), context.ports.get(FINANCE_PAYMENT_PORT));
  const profiles = invoiceProfileActions(context.service(KMS_CLIENT));
  const policyPreview = new PolicyPreview(key);
  const policies = financePolicyOperations({ scopes: (database, scopeId) => scopes.descendantsFromId(database, scopeId), repository: (database) => new PgPolicyRepository(database), preview: policyPreview, clock: new SystemClock() });
  const policyWrites = policyCommands(scopes, policyPreview, new SystemClock());
  const repairs = repairOperations({
    scopes: (database, scopeId) => scopes.descendantsFromId(database, scopeId),
    repository: (database) => new PgRepairRepository(database, repairPolicy),
    policy: repairPolicy,
    approval: new RepairApproval(context.ports.get(APPROVAL_PORT), context.ports.get(APPROVAL_READ_PORT)),
    clock: new SystemClock(),
  });

  return Object.freeze({
    accountRead: Object.freeze({
      overviewRead: bind.bind<'finance.overview.read'>(overview.overviewRead),
      holdsRead: bind.bind<'finance.holds.read'>(accounts.holdsRead),
      periodsRead: bind.bind<'finance.periods.read'>(periods.periodsRead),
    }),
    journalRead: Object.freeze({ entriesRead: bind.bind<'finance.entries.read'>(statements.entriesRead) }),
    statementRead: Object.freeze({ statementsRead: bind.bind<'finance.statements.read'>(statements.statementsRead), backfillsRead: bind.bind<'finance.backfills.read'>(backfills.backfillsRead) }),
    statementProcess: Object.freeze({ statementsExport: bind.bind<'finance.statements.export'>(statements.statementsExport), backfillsDecide: bind.bind<'finance.backfills.decide'>(backfills.backfillsDecide) }),
    period: Object.freeze({ periodsManage: bind.bind<'finance.periods.manage'>(periods.periodsManage) }),
    reconciliationRead: Object.freeze({ reconciliationsRead: bind.bind<'finance.reconciliations.read'>(reconciliationReads.reconciliationsRead) }),
    reconciliation: Object.freeze({ reconciliationsManage: bind.bind<'finance.reconciliations.manage'>(reconciliations.reconciliationsManage) }),
    settlementRead: Object.freeze({ settlementsRead: bind.bind<'finance.settlements.read'>(settlementReads.settlementsRead) }),
    settlement: Object.freeze({ settlementsDecide: bind.bind<'finance.settlements.decide'>(settlementDecisions.settlementsDecide), settlementsAdjust: bind.bind<'finance.settlements.adjust'>(settlementAdjustments.settlementsAdjust) }),
    withdrawalRead: Object.freeze({ withdrawalsRead: bind.bind<'finance.withdrawals.read'>(withdrawalReads.withdrawalsRead) }),
    withdrawal: Object.freeze({
      withdrawalsCreate: bind.bind<'finance.withdrawals.create'>(withdrawals.withdrawalsCreate),
      withdrawalsDecide: bind.bind<'finance.withdrawals.decide'>(withdrawals.withdrawalsDecide),
      withdrawalsRecover: bind.bind<'finance.withdrawals.recover'>(withdrawals.withdrawalsRecover),
    }),
    invoiceRead: Object.freeze({
      invoicesRead: bind.bind<'finance.invoices.read'>(invoiceReads.invoicesRead),
      profilesRead: bind.bind<'invoice.profiles.read'>(invoiceReads.profilesRead),
      requestsRead: bind.bind<'invoice.requests.read'>(invoiceReads.requestsRead),
    }),
    invoiceProcess: Object.freeze({ invoicesDownload: bind.bind<'finance.invoices.download'>(invoiceReads.invoicesDownload) }),
    invoiceProfile: Object.freeze({ profilesManage: bind.bind<'invoice.profiles.manage'>(profiles.profilesManage) }),
    invoiceRequest: Object.freeze({
      requestsCreate: bind.bind<'invoice.requests.create'>(invoices.requestsCreate),
      requestsCancel: bind.bind<'invoice.requests.cancel'>(invoices.requestsCancel),
      requestsDecide: bind.bind<'invoice.requests.decide'>(invoices.requestsDecide),
      redInvoice: bind.bind<'invoice.requests.red'>(invoices.redInvoice),
    }),
    policyRead: Object.freeze({ policiesRead: bind.bind<'finance.policies.read'>(policies.policiesRead) }),
    policyCommand: Object.freeze({ policiesManage: bind.bind<'finance.policies.manage'>(policyWrites.policiesManage) }),
    policyProcess: Object.freeze({ policiesPreview: bind.bind<'finance.policies.preview'>(policies.policiesPreview) }),
    repairRead: Object.freeze({ repairsRead: bind.bind<'finance.reconciliationrepairs.read'>(repairs.repairsRead) }),
    repairProcess: Object.freeze({
      repairsPreview: bind.bind<'finance.reconciliationrepairs.preview'>(repairs.repairsPreview),
      repairsSubmit: bind.bind<'finance.reconciliationrepairs.submit'>(repairs.repairsSubmit),
      repairsDecide: bind.bind<'finance.reconciliationrepairs.decide'>(repairs.repairsDecide),
      repairsReverse: bind.bind<'finance.reconciliationrepairs.reverse'>(repairs.repairsReverse),
    }),
  });
}
