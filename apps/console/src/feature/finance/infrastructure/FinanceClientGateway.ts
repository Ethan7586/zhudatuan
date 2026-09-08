import {
  createFetchFinanceEntriesRead,
  createFetchFinanceAuditRead,
  createFetchFinanceFacetsRead,
  createFetchFinanceOverviewRead,
  createFetchFinancePoliciesRead,
  createFetchFinancePoliciesManage,
  createFetchFinancePoliciesPreview,
  createFetchFinanceReconciliationrepairsRead,
  createFetchFinanceReconciliationrepairsPreview,
  createFetchFinanceReconciliationrepairsSubmit,
  createFetchFinanceReconciliationrepairsDecide,
  createFetchFinanceReconciliationrepairsReverse,
  createFetchFinanceReconciliationsManage,
  createFetchFinanceReconciliationsRead,
  createFetchFinanceSettlementsRead,
  createFetchFinanceSettlementsDecide,
  createFetchFinanceStatementsRead,
  createFetchFinanceStatementsExport,
  createFetchFinanceWithdrawalsRead,
  createFetchFinanceWithdrawalsCreate,
  createFetchFinanceWithdrawalsDecide,
  createFetchFinanceWithdrawalsRecover,
} from '@shop/sdk/finance';
import { createFetchInvoiceRequestsCancel, createFetchInvoiceRequestsDecide, createFetchInvoiceRequestsRead, createFetchInvoiceRequestsRed } from '@shop/sdk/invoice';
import {
  OP_FINANCE_SETTLEMENTS_DECIDE,
  OP_FINANCE_STATEMENTS_EXPORT,
  OP_FINANCE_WITHDRAWALS_CREATE,
  OP_FINANCE_WITHDRAWALS_DECIDE,
  OP_FINANCE_WITHDRAWALS_RECOVER,
  OP_INVOICE_REQUESTS_CANCEL,
  OP_INVOICE_REQUESTS_DECIDE,
  OP_INVOICE_REQUESTS_RED,
} from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../shared/api/RequestContext';
import { FINANCE_PAGE_LIMIT, type FinanceCommandResult, type FinanceReconciliationChange, type FinanceReconciliationQuery, type FinanceSection } from '../model/Finance';
import type { FinanceCommand } from '../model/FinanceCommand';
import type { FinanceImportDraft } from '../model/FinanceImport';
import { isoDay, type FinancePolicyPreview, type FinanceRepair, type FinanceRepairPreview, type PolicyDraft, type RepairDecision, type RepairDraft } from '../model/FinanceGovernance';
import type { FinancePort } from '../public';
import { FinanceMapper } from './FinanceMapper';
import { StatementImportGateway } from '../../../shared/import/StatementImportGateway';

export class FinanceClientGateway {
  protected readonly overviewRead;
  protected readonly auditRead;
  protected readonly facetsRead;
  protected readonly policiesRead;
  protected readonly policiesPreview;
  protected readonly policiesManage;
  protected readonly repairsRead;
  protected readonly repairsPreview;
  protected readonly repairsSubmit;
  protected readonly repairsDecide;
  protected readonly repairsReverse;
  protected readonly entriesRead;
  protected readonly statementsRead;
  protected readonly reconciliationsRead;
  protected readonly reconciliationsManage;
  protected readonly settlementsRead;
  protected readonly withdrawalsRead;
  protected readonly invoicesRead;
  protected readonly statementsExport;
  protected readonly settlementsDecide;
  protected readonly withdrawalsCreate;
  protected readonly withdrawalsDecide;
  protected readonly withdrawalsRecover;
  protected readonly invoicesCancel;
  protected readonly invoicesDecide;
  protected readonly invoicesRed;
  protected readonly mapper = new FinanceMapper();
  protected readonly imports;

  constructor(baseUrl: string) {
    this.imports = new StatementImportGateway(baseUrl);
    this.overviewRead = createFetchFinanceOverviewRead(baseUrl);
    this.auditRead = createFetchFinanceAuditRead(baseUrl);
    this.facetsRead = createFetchFinanceFacetsRead(baseUrl);
    this.policiesRead = createFetchFinancePoliciesRead(baseUrl);
    this.policiesPreview = createFetchFinancePoliciesPreview(baseUrl);
    this.policiesManage = createFetchFinancePoliciesManage(baseUrl);
    this.repairsRead = createFetchFinanceReconciliationrepairsRead(baseUrl);
    this.repairsPreview = createFetchFinanceReconciliationrepairsPreview(baseUrl);
    this.repairsSubmit = createFetchFinanceReconciliationrepairsSubmit(baseUrl);
    this.repairsDecide = createFetchFinanceReconciliationrepairsDecide(baseUrl);
    this.repairsReverse = createFetchFinanceReconciliationrepairsReverse(baseUrl);
    this.entriesRead = createFetchFinanceEntriesRead(baseUrl);
    this.statementsRead = createFetchFinanceStatementsRead(baseUrl);
    this.reconciliationsRead = createFetchFinanceReconciliationsRead(baseUrl);
    this.reconciliationsManage = createFetchFinanceReconciliationsManage(baseUrl);
    this.settlementsRead = createFetchFinanceSettlementsRead(baseUrl);
    this.withdrawalsRead = createFetchFinanceWithdrawalsRead(baseUrl);
    this.invoicesRead = createFetchInvoiceRequestsRead(baseUrl);
    this.statementsExport = createFetchFinanceStatementsExport(baseUrl);
    this.settlementsDecide = createFetchFinanceSettlementsDecide(baseUrl);
    this.withdrawalsCreate = createFetchFinanceWithdrawalsCreate(baseUrl);
    this.withdrawalsDecide = createFetchFinanceWithdrawalsDecide(baseUrl);
    this.withdrawalsRecover = createFetchFinanceWithdrawalsRecover(baseUrl);
    this.invoicesCancel = createFetchInvoiceRequestsCancel(baseUrl);
    this.invoicesDecide = createFetchInvoiceRequestsDecide(baseUrl);
    this.invoicesRed = createFetchInvoiceRequestsRed(baseUrl);
  }
}
