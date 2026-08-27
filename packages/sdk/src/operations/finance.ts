// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const FINANCE_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "finance.overview.read",
  "finance.entries.read",
  "finance.statements.read",
  "finance.statements.export",
  "finance.reconciliations.manage",
  "finance.reconciliations.read",
<<<<<<< HEAD
  "finance.reconciliationrepairs.read",
  "finance.reconciliationrepairs.preview",
  "finance.reconciliationrepairs.submit",
  "finance.reconciliationrepairs.decide",
  "finance.reconciliationrepairs.reverse",
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  "finance.settlements.read",
  "finance.settlements.decide",
  "finance.settlements.adjust",
  "finance.withdrawals.read",
  "finance.withdrawals.create",
  "finance.withdrawals.decide",
  "finance.withdrawals.recover",
  "finance.holds.read",
  "finance.periods.read",
  "finance.periods.manage",
  "finance.backfills.read",
  "finance.backfills.decide",
  "finance.policies.manage",
<<<<<<< HEAD
  "finance.policies.preview",
  "finance.policies.read",
  "finance.audit.read",
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
] as const satisfies readonly OperationId[]);

export interface FinanceOperations {
  readonly overviewRead: OperationMethod<"finance.overview.read">;
  readonly entriesRead: OperationMethod<"finance.entries.read">;
  readonly statementsRead: OperationMethod<"finance.statements.read">;
  readonly statementsExport: OperationMethod<"finance.statements.export">;
  readonly reconciliationsManage: OperationMethod<"finance.reconciliations.manage">;
  readonly reconciliationsRead: OperationMethod<"finance.reconciliations.read">;
<<<<<<< HEAD
  readonly reconciliationrepairsRead: OperationMethod<"finance.reconciliationrepairs.read">;
  readonly reconciliationrepairsPreview: OperationMethod<"finance.reconciliationrepairs.preview">;
  readonly reconciliationrepairsSubmit: OperationMethod<"finance.reconciliationrepairs.submit">;
  readonly reconciliationrepairsDecide: OperationMethod<"finance.reconciliationrepairs.decide">;
  readonly reconciliationrepairsReverse: OperationMethod<"finance.reconciliationrepairs.reverse">;
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  readonly settlementsRead: OperationMethod<"finance.settlements.read">;
  readonly settlementsDecide: OperationMethod<"finance.settlements.decide">;
  readonly settlementsAdjust: OperationMethod<"finance.settlements.adjust">;
  readonly withdrawalsRead: OperationMethod<"finance.withdrawals.read">;
  readonly withdrawalsCreate: OperationMethod<"finance.withdrawals.create">;
  readonly withdrawalsDecide: OperationMethod<"finance.withdrawals.decide">;
  readonly withdrawalsRecover: OperationMethod<"finance.withdrawals.recover">;
  readonly holdsRead: OperationMethod<"finance.holds.read">;
  readonly periodsRead: OperationMethod<"finance.periods.read">;
  readonly periodsManage: OperationMethod<"finance.periods.manage">;
  readonly backfillsRead: OperationMethod<"finance.backfills.read">;
  readonly backfillsDecide: OperationMethod<"finance.backfills.decide">;
  readonly policiesManage: OperationMethod<"finance.policies.manage">;
<<<<<<< HEAD
  readonly policiesPreview: OperationMethod<"finance.policies.preview">;
  readonly policiesRead: OperationMethod<"finance.policies.read">;
  readonly auditRead: OperationMethod<"finance.audit.read">;
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}

export function createFetchFinance(baseUrl: string): FinanceOperations {
  return createFinanceOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createFinanceOperations(client: OperationExecutor): FinanceOperations {
  return Object.freeze({
    overviewRead: bindOverviewRead(client),
    entriesRead: bindEntriesRead(client),
    statementsRead: bindStatementsRead(client),
    statementsExport: bindStatementsExport(client),
    reconciliationsManage: bindReconciliationsManage(client),
    reconciliationsRead: bindReconciliationsRead(client),
<<<<<<< HEAD
    reconciliationrepairsRead: bindReconciliationrepairsRead(client),
    reconciliationrepairsPreview: bindReconciliationrepairsPreview(client),
    reconciliationrepairsSubmit: bindReconciliationrepairsSubmit(client),
    reconciliationrepairsDecide: bindReconciliationrepairsDecide(client),
    reconciliationrepairsReverse: bindReconciliationrepairsReverse(client),
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    settlementsRead: bindSettlementsRead(client),
    settlementsDecide: bindSettlementsDecide(client),
    settlementsAdjust: bindSettlementsAdjust(client),
    withdrawalsRead: bindWithdrawalsRead(client),
    withdrawalsCreate: bindWithdrawalsCreate(client),
    withdrawalsDecide: bindWithdrawalsDecide(client),
    withdrawalsRecover: bindWithdrawalsRecover(client),
    holdsRead: bindHoldsRead(client),
    periodsRead: bindPeriodsRead(client),
    periodsManage: bindPeriodsManage(client),
    backfillsRead: bindBackfillsRead(client),
    backfillsDecide: bindBackfillsDecide(client),
    policiesManage: bindPoliciesManage(client),
<<<<<<< HEAD
    policiesPreview: bindPoliciesPreview(client),
    policiesRead: bindPoliciesRead(client),
    auditRead: bindAuditRead(client),
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  });
}

export function createFetchFinanceOverviewRead(baseUrl: string): OperationMethod<"finance.overview.read"> {
  return bindOverviewRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindOverviewRead(client: OperationExecutor): OperationMethod<"finance.overview.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.overview.read","method":"GET","path":"/api/v1/finance/overview","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchFinanceEntriesRead(baseUrl: string): OperationMethod<"finance.entries.read"> {
  return bindEntriesRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindEntriesRead(client: OperationExecutor): OperationMethod<"finance.entries.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.entries.read","method":"GET","path":"/api/v1/finance/entries","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchFinanceStatementsRead(baseUrl: string): OperationMethod<"finance.statements.read"> {
  return bindStatementsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStatementsRead(client: OperationExecutor): OperationMethod<"finance.statements.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.statements.read","method":"GET","path":"/api/v1/finance/statements","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchFinanceStatementsExport(baseUrl: string): OperationMethod<"finance.statements.export"> {
  return bindStatementsExport(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStatementsExport(client: OperationExecutor): OperationMethod<"finance.statements.export"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.statements.export","method":"POST","path":"/api/v1/finance/statements/exports","audience":"operator","idempotent":false,"pathKeys":[]}));
}

export function createFetchFinanceReconciliationsManage(baseUrl: string): OperationMethod<"finance.reconciliations.manage"> {
  return bindReconciliationsManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindReconciliationsManage(client: OperationExecutor): OperationMethod<"finance.reconciliations.manage"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.reconciliations.manage","method":"PUT","path":"/api/v1/finance/reconciliations/{reconciliationid}","audience":"operator","idempotent":true,"pathKeys":["reconciliationid"]}));
}

export function createFetchFinanceReconciliationsRead(baseUrl: string): OperationMethod<"finance.reconciliations.read"> {
  return bindReconciliationsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindReconciliationsRead(client: OperationExecutor): OperationMethod<"finance.reconciliations.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.reconciliations.read","method":"GET","path":"/api/v1/finance/reconciliations","audience":"operator","idempotent":true,"pathKeys":[]}));
}

<<<<<<< HEAD
export function createFetchFinanceReconciliationrepairsRead(baseUrl: string): OperationMethod<"finance.reconciliationrepairs.read"> {
  return bindReconciliationrepairsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindReconciliationrepairsRead(client: OperationExecutor): OperationMethod<"finance.reconciliationrepairs.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.reconciliationrepairs.read","method":"GET","path":"/api/v1/finance/reconciliation-repairs/{repairid}","audience":"operator","idempotent":true,"pathKeys":["repairid"]}));
}

export function createFetchFinanceReconciliationrepairsPreview(baseUrl: string): OperationMethod<"finance.reconciliationrepairs.preview"> {
  return bindReconciliationrepairsPreview(new ApiClient(baseUrl, new FetchTransport()));
}

function bindReconciliationrepairsPreview(client: OperationExecutor): OperationMethod<"finance.reconciliationrepairs.preview"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.reconciliationrepairs.preview","method":"POST","path":"/api/v1/finance/reconciliations/{reconciliationid}/items/{itemid}/repairs/preview","audience":"operator","idempotent":false,"pathKeys":["reconciliationid","itemid"]}));
}

export function createFetchFinanceReconciliationrepairsSubmit(baseUrl: string): OperationMethod<"finance.reconciliationrepairs.submit"> {
  return bindReconciliationrepairsSubmit(new ApiClient(baseUrl, new FetchTransport()));
}

function bindReconciliationrepairsSubmit(client: OperationExecutor): OperationMethod<"finance.reconciliationrepairs.submit"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.reconciliationrepairs.submit","method":"POST","path":"/api/v1/finance/reconciliation-repairs/{repairid}/submit","audience":"operator","idempotent":false,"pathKeys":["repairid"]}));
}

export function createFetchFinanceReconciliationrepairsDecide(baseUrl: string): OperationMethod<"finance.reconciliationrepairs.decide"> {
  return bindReconciliationrepairsDecide(new ApiClient(baseUrl, new FetchTransport()));
}

function bindReconciliationrepairsDecide(client: OperationExecutor): OperationMethod<"finance.reconciliationrepairs.decide"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.reconciliationrepairs.decide","method":"POST","path":"/api/v1/finance/reconciliation-repairs/{repairid}/decide","audience":"operator","idempotent":false,"pathKeys":["repairid"]}));
}

export function createFetchFinanceReconciliationrepairsReverse(baseUrl: string): OperationMethod<"finance.reconciliationrepairs.reverse"> {
  return bindReconciliationrepairsReverse(new ApiClient(baseUrl, new FetchTransport()));
}

function bindReconciliationrepairsReverse(client: OperationExecutor): OperationMethod<"finance.reconciliationrepairs.reverse"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.reconciliationrepairs.reverse","method":"POST","path":"/api/v1/finance/reconciliation-repairs/{repairid}/reverse","audience":"operator","idempotent":false,"pathKeys":["repairid"]}));
}

=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
export function createFetchFinanceSettlementsRead(baseUrl: string): OperationMethod<"finance.settlements.read"> {
  return bindSettlementsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSettlementsRead(client: OperationExecutor): OperationMethod<"finance.settlements.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.settlements.read","method":"GET","path":"/api/v1/finance/settlements","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchFinanceSettlementsDecide(baseUrl: string): OperationMethod<"finance.settlements.decide"> {
  return bindSettlementsDecide(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSettlementsDecide(client: OperationExecutor): OperationMethod<"finance.settlements.decide"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.settlements.decide","method":"POST","path":"/api/v1/finance/settlements/{settlementid}/decide","audience":"operator","idempotent":false,"pathKeys":["settlementid"]}));
}

export function createFetchFinanceSettlementsAdjust(baseUrl: string): OperationMethod<"finance.settlements.adjust"> {
  return bindSettlementsAdjust(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSettlementsAdjust(client: OperationExecutor): OperationMethod<"finance.settlements.adjust"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.settlements.adjust","method":"POST","path":"/api/v1/finance/settlements/{settlementid}/adjust","audience":"operator","idempotent":false,"pathKeys":["settlementid"]}));
}

export function createFetchFinanceWithdrawalsRead(baseUrl: string): OperationMethod<"finance.withdrawals.read"> {
  return bindWithdrawalsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindWithdrawalsRead(client: OperationExecutor): OperationMethod<"finance.withdrawals.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.withdrawals.read","method":"GET","path":"/api/v1/finance/withdrawals","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchFinanceWithdrawalsCreate(baseUrl: string): OperationMethod<"finance.withdrawals.create"> {
  return bindWithdrawalsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindWithdrawalsCreate(client: OperationExecutor): OperationMethod<"finance.withdrawals.create"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.withdrawals.create","method":"POST","path":"/api/v1/finance/withdrawals","audience":"operator","idempotent":false,"pathKeys":[]}));
}

export function createFetchFinanceWithdrawalsDecide(baseUrl: string): OperationMethod<"finance.withdrawals.decide"> {
  return bindWithdrawalsDecide(new ApiClient(baseUrl, new FetchTransport()));
}

function bindWithdrawalsDecide(client: OperationExecutor): OperationMethod<"finance.withdrawals.decide"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.withdrawals.decide","method":"POST","path":"/api/v1/finance/withdrawals/{withdrawalid}/decide","audience":"operator","idempotent":false,"pathKeys":["withdrawalid"]}));
}

export function createFetchFinanceWithdrawalsRecover(baseUrl: string): OperationMethod<"finance.withdrawals.recover"> {
  return bindWithdrawalsRecover(new ApiClient(baseUrl, new FetchTransport()));
}

function bindWithdrawalsRecover(client: OperationExecutor): OperationMethod<"finance.withdrawals.recover"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.withdrawals.recover","method":"POST","path":"/api/v1/finance/withdrawals/{withdrawalid}/recover","audience":"operator","idempotent":false,"pathKeys":["withdrawalid"]}));
}

export function createFetchFinanceHoldsRead(baseUrl: string): OperationMethod<"finance.holds.read"> {
  return bindHoldsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindHoldsRead(client: OperationExecutor): OperationMethod<"finance.holds.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.holds.read","method":"GET","path":"/api/v1/finance/holds","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchFinancePeriodsRead(baseUrl: string): OperationMethod<"finance.periods.read"> {
  return bindPeriodsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPeriodsRead(client: OperationExecutor): OperationMethod<"finance.periods.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.periods.read","method":"GET","path":"/api/v1/finance/periods","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchFinancePeriodsManage(baseUrl: string): OperationMethod<"finance.periods.manage"> {
  return bindPeriodsManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPeriodsManage(client: OperationExecutor): OperationMethod<"finance.periods.manage"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.periods.manage","method":"POST","path":"/api/v1/finance/periods/{period}/manage","audience":"operator","idempotent":false,"pathKeys":["period"]}));
}

export function createFetchFinanceBackfillsRead(baseUrl: string): OperationMethod<"finance.backfills.read"> {
  return bindBackfillsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindBackfillsRead(client: OperationExecutor): OperationMethod<"finance.backfills.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.backfills.read","method":"GET","path":"/api/v1/finance/backfills","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchFinanceBackfillsDecide(baseUrl: string): OperationMethod<"finance.backfills.decide"> {
  return bindBackfillsDecide(new ApiClient(baseUrl, new FetchTransport()));
}

function bindBackfillsDecide(client: OperationExecutor): OperationMethod<"finance.backfills.decide"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.backfills.decide","method":"POST","path":"/api/v1/finance/backfills/{backfillid}/decide","audience":"operator","idempotent":false,"pathKeys":["backfillid"]}));
}

export function createFetchFinancePoliciesManage(baseUrl: string): OperationMethod<"finance.policies.manage"> {
  return bindPoliciesManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPoliciesManage(client: OperationExecutor): OperationMethod<"finance.policies.manage"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.policies.manage","method":"PUT","path":"/api/v1/finance/policies/{policyid}","audience":"operator","idempotent":true,"pathKeys":["policyid"]}));
}
<<<<<<< HEAD

export function createFetchFinancePoliciesPreview(baseUrl: string): OperationMethod<"finance.policies.preview"> {
  return bindPoliciesPreview(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPoliciesPreview(client: OperationExecutor): OperationMethod<"finance.policies.preview"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.policies.preview","method":"POST","path":"/api/v1/finance/policies/{policyid}/preview","audience":"operator","idempotent":true,"pathKeys":["policyid"]}));
}

export function createFetchFinancePoliciesRead(baseUrl: string): OperationMethod<"finance.policies.read"> {
  return bindPoliciesRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPoliciesRead(client: OperationExecutor): OperationMethod<"finance.policies.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.policies.read","method":"GET","path":"/api/v1/finance/policies","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchFinanceAuditRead(baseUrl: string): OperationMethod<"finance.audit.read"> {
  return bindAuditRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindAuditRead(client: OperationExecutor): OperationMethod<"finance.audit.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"finance.audit.read","method":"GET","path":"/api/v1/finance/audits","audience":"operator","idempotent":true,"pathKeys":[]}));
}
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
