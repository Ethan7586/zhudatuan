import {
  createFetchFinanceAuditRead,
  createFetchFinanceEntriesRead,
  createFetchFinanceFacetsRead,
  createFetchFinanceOverviewRead,
  createFetchFinancePoliciesManage,
  createFetchFinancePoliciesPreview,
  createFetchFinancePoliciesRead,
  createFetchFinanceReconciliationrepairsDecide,
  createFetchFinanceReconciliationrepairsPreview,
  createFetchFinanceReconciliationrepairsRead,
  createFetchFinanceReconciliationrepairsReverse,
  createFetchFinanceReconciliationrepairsSubmit,
  createFetchFinanceReconciliationsManage,
  createFetchFinanceReconciliationsRead,
  createFetchFinanceSettlementsDecide,
  createFetchFinanceSettlementsRead,
  createFetchFinanceStatementsExport,
  createFetchFinanceStatementsRead,
  createFetchFinanceWithdrawalsCreate,
  createFetchFinanceWithdrawalsDecide,
  createFetchFinanceWithdrawalsRead,
  createFetchFinanceWithdrawalsRecover,
} from '@shop/sdk/finance';
import { createFetchInvoiceRequestsCancel, createFetchInvoiceRequestsDecide, createFetchInvoiceRequestsRead, createFetchInvoiceRequestsRed } from '@shop/sdk/invoice';
import { StatementImportGateway } from '../../../shared/import/StatementImportGateway';
import { FinanceMapper } from './FinanceMapper';

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
