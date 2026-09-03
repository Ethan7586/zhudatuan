// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const FINANCE_OPERATION_IDS = Object.freeze([
  "finance.overview.read",
  "finance.entries.read",
  "finance.statements.read",
  "finance.statements.export",
  "finance.reconciliations.manage",
  "finance.reconciliations.read",
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
  "finance.invoices.read",
  "finance.invoices.download",
  "finance.policies.read",
  "finance.policies.preview",
  "finance.reconciliationrepairs.read",
  "finance.reconciliationrepairs.preview",
  "finance.reconciliationrepairs.submit",
  "finance.reconciliationrepairs.decide",
  "finance.reconciliationrepairs.reverse",
] as const satisfies readonly OperationId[]);

export interface FinanceOperations {
  readonly overviewRead: OperationMethod<"finance.overview.read">;
  readonly entriesRead: OperationMethod<"finance.entries.read">;
  readonly statementsRead: OperationMethod<"finance.statements.read">;
  readonly statementsExport: OperationMethod<"finance.statements.export">;
  readonly reconciliationsManage: OperationMethod<"finance.reconciliations.manage">;
  readonly reconciliationsRead: OperationMethod<"finance.reconciliations.read">;
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
  readonly invoicesRead: OperationMethod<"finance.invoices.read">;
  readonly invoicesDownload: OperationMethod<"finance.invoices.download">;
  readonly policiesRead: OperationMethod<"finance.policies.read">;
  readonly policiesPreview: OperationMethod<"finance.policies.preview">;
  readonly reconciliationrepairsRead: OperationMethod<"finance.reconciliationrepairs.read">;
  readonly reconciliationrepairsPreview: OperationMethod<"finance.reconciliationrepairs.preview">;
  readonly reconciliationrepairsSubmit: OperationMethod<"finance.reconciliationrepairs.submit">;
  readonly reconciliationrepairsDecide: OperationMethod<"finance.reconciliationrepairs.decide">;
  readonly reconciliationrepairsReverse: OperationMethod<"finance.reconciliationrepairs.reverse">;
}

export function createFetchFinance(baseUrl: string): FinanceOperations { return createFinanceOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createFinanceOperations(client: OperationExecutor): FinanceOperations { return Object.freeze({
    overviewRead: bindOverviewRead(client),
    entriesRead: bindEntriesRead(client),
    statementsRead: bindStatementsRead(client),
    statementsExport: bindStatementsExport(client),
    reconciliationsManage: bindReconciliationsManage(client),
    reconciliationsRead: bindReconciliationsRead(client),
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
    invoicesRead: bindInvoicesRead(client),
    invoicesDownload: bindInvoicesDownload(client),
    policiesRead: bindPoliciesRead(client),
    policiesPreview: bindPoliciesPreview(client),
    reconciliationrepairsRead: bindReconciliationrepairsRead(client),
    reconciliationrepairsPreview: bindReconciliationrepairsPreview(client),
    reconciliationrepairsSubmit: bindReconciliationrepairsSubmit(client),
    reconciliationrepairsDecide: bindReconciliationrepairsDecide(client),
    reconciliationrepairsReverse: bindReconciliationrepairsReverse(client),
  }); }

export function createFetchFinanceOverviewRead(baseUrl: string): OperationMethod<"finance.overview.read"> { return bindOverviewRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindOverviewRead(client: OperationExecutor): OperationMethod<"finance.overview.read"> { return bindOperation(client, defineOperation({ ...{"id":"finance.overview.read","method":"GET","path":"/api/v1/finance/overview","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinanceOverviewReadInput", [] as const, false), output: exactOperationOutput("FinanceOverviewReadOutput") })); }

export function createFetchFinanceEntriesRead(baseUrl: string): OperationMethod<"finance.entries.read"> { return bindEntriesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindEntriesRead(client: OperationExecutor): OperationMethod<"finance.entries.read"> { return bindOperation(client, defineOperation({ ...{"id":"finance.entries.read","method":"GET","path":"/api/v1/finance/entries","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinanceEntriesReadInput", [] as const, false), output: exactOperationOutput("FinanceEntriesReadOutput") })); }

export function createFetchFinanceStatementsRead(baseUrl: string): OperationMethod<"finance.statements.read"> { return bindStatementsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindStatementsRead(client: OperationExecutor): OperationMethod<"finance.statements.read"> { return bindOperation(client, defineOperation({ ...{"id":"finance.statements.read","method":"GET","path":"/api/v1/finance/statements","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinanceStatementsReadInput", [] as const, false), output: exactOperationOutput("FinanceStatementsReadOutput") })); }

export function createFetchFinanceStatementsExport(baseUrl: string): OperationMethod<"finance.statements.export"> { return bindStatementsExport(new ApiClient(baseUrl, new FetchTransport())); }

function bindStatementsExport(client: OperationExecutor): OperationMethod<"finance.statements.export"> { return bindOperation(client, defineOperation({ ...{"id":"finance.statements.export","method":"POST","path":"/api/v1/finance/statements/exports","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinanceStatementsExportInput", [] as const, true), output: exactOperationOutput("FinanceStatementsExportOutput") })); }

export function createFetchFinanceReconciliationsManage(baseUrl: string): OperationMethod<"finance.reconciliations.manage"> { return bindReconciliationsManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindReconciliationsManage(client: OperationExecutor): OperationMethod<"finance.reconciliations.manage"> { return bindOperation(client, defineOperation({ ...{"id":"finance.reconciliations.manage","method":"PUT","path":"/api/v1/finance/reconciliations/{reconciliationid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("FinanceReconciliationsManageInput", ["reconciliationid"] as const, true), output: exactOperationOutput("FinanceReconciliationsManageOutput") })); }

export function createFetchFinanceReconciliationsRead(baseUrl: string): OperationMethod<"finance.reconciliations.read"> { return bindReconciliationsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindReconciliationsRead(client: OperationExecutor): OperationMethod<"finance.reconciliations.read"> { return bindOperation(client, defineOperation({ ...{"id":"finance.reconciliations.read","method":"GET","path":"/api/v1/finance/reconciliations","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinanceReconciliationsReadInput", [] as const, false), output: exactOperationOutput("FinanceReconciliationsReadOutput") })); }

export function createFetchFinanceSettlementsRead(baseUrl: string): OperationMethod<"finance.settlements.read"> { return bindSettlementsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindSettlementsRead(client: OperationExecutor): OperationMethod<"finance.settlements.read"> { return bindOperation(client, defineOperation({ ...{"id":"finance.settlements.read","method":"GET","path":"/api/v1/finance/settlements","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinanceSettlementsReadInput", [] as const, false), output: exactOperationOutput("FinanceSettlementsReadOutput") })); }

export function createFetchFinanceSettlementsDecide(baseUrl: string): OperationMethod<"finance.settlements.decide"> { return bindSettlementsDecide(new ApiClient(baseUrl, new FetchTransport())); }

function bindSettlementsDecide(client: OperationExecutor): OperationMethod<"finance.settlements.decide"> { return bindOperation(client, defineOperation({ ...{"id":"finance.settlements.decide","method":"POST","path":"/api/v1/finance/settlements/{settlementid}/decide","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinanceSettlementsDecideInput", ["settlementid"] as const, true), output: exactOperationOutput("FinanceSettlementsDecideOutput") })); }

export function createFetchFinanceSettlementsAdjust(baseUrl: string): OperationMethod<"finance.settlements.adjust"> { return bindSettlementsAdjust(new ApiClient(baseUrl, new FetchTransport())); }

function bindSettlementsAdjust(client: OperationExecutor): OperationMethod<"finance.settlements.adjust"> { return bindOperation(client, defineOperation({ ...{"id":"finance.settlements.adjust","method":"POST","path":"/api/v1/finance/settlements/{settlementid}/adjust","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinanceSettlementsAdjustInput", ["settlementid"] as const, true), output: exactOperationOutput("FinanceSettlementsAdjustOutput") })); }

export function createFetchFinanceWithdrawalsRead(baseUrl: string): OperationMethod<"finance.withdrawals.read"> { return bindWithdrawalsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindWithdrawalsRead(client: OperationExecutor): OperationMethod<"finance.withdrawals.read"> { return bindOperation(client, defineOperation({ ...{"id":"finance.withdrawals.read","method":"GET","path":"/api/v1/finance/withdrawals","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinanceWithdrawalsReadInput", [] as const, false), output: exactOperationOutput("FinanceWithdrawalsReadOutput") })); }

export function createFetchFinanceWithdrawalsCreate(baseUrl: string): OperationMethod<"finance.withdrawals.create"> { return bindWithdrawalsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindWithdrawalsCreate(client: OperationExecutor): OperationMethod<"finance.withdrawals.create"> { return bindOperation(client, defineOperation({ ...{"id":"finance.withdrawals.create","method":"POST","path":"/api/v1/finance/withdrawals","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinanceWithdrawalsCreateInput", [] as const, true), output: exactOperationOutput("FinanceWithdrawalsCreateOutput") })); }

export function createFetchFinanceWithdrawalsDecide(baseUrl: string): OperationMethod<"finance.withdrawals.decide"> { return bindWithdrawalsDecide(new ApiClient(baseUrl, new FetchTransport())); }

function bindWithdrawalsDecide(client: OperationExecutor): OperationMethod<"finance.withdrawals.decide"> { return bindOperation(client, defineOperation({ ...{"id":"finance.withdrawals.decide","method":"POST","path":"/api/v1/finance/withdrawals/{withdrawalid}/decide","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinanceWithdrawalsDecideInput", ["withdrawalid"] as const, true), output: exactOperationOutput("FinanceWithdrawalsDecideOutput") })); }

export function createFetchFinanceWithdrawalsRecover(baseUrl: string): OperationMethod<"finance.withdrawals.recover"> { return bindWithdrawalsRecover(new ApiClient(baseUrl, new FetchTransport())); }

function bindWithdrawalsRecover(client: OperationExecutor): OperationMethod<"finance.withdrawals.recover"> { return bindOperation(client, defineOperation({ ...{"id":"finance.withdrawals.recover","method":"POST","path":"/api/v1/finance/withdrawals/{withdrawalid}/recover","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinanceWithdrawalsRecoverInput", ["withdrawalid"] as const, true), output: exactOperationOutput("FinanceWithdrawalsRecoverOutput") })); }

export function createFetchFinanceHoldsRead(baseUrl: string): OperationMethod<"finance.holds.read"> { return bindHoldsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindHoldsRead(client: OperationExecutor): OperationMethod<"finance.holds.read"> { return bindOperation(client, defineOperation({ ...{"id":"finance.holds.read","method":"GET","path":"/api/v1/finance/holds","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinanceHoldsReadInput", [] as const, false), output: exactOperationOutput("FinanceHoldsReadOutput") })); }

export function createFetchFinancePeriodsRead(baseUrl: string): OperationMethod<"finance.periods.read"> { return bindPeriodsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindPeriodsRead(client: OperationExecutor): OperationMethod<"finance.periods.read"> { return bindOperation(client, defineOperation({ ...{"id":"finance.periods.read","method":"GET","path":"/api/v1/finance/periods","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinancePeriodsReadInput", [] as const, false), output: exactOperationOutput("FinancePeriodsReadOutput") })); }

export function createFetchFinancePeriodsManage(baseUrl: string): OperationMethod<"finance.periods.manage"> { return bindPeriodsManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindPeriodsManage(client: OperationExecutor): OperationMethod<"finance.periods.manage"> { return bindOperation(client, defineOperation({ ...{"id":"finance.periods.manage","method":"POST","path":"/api/v1/finance/periods/{period}/manage","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinancePeriodsManageInput", ["period"] as const, true), output: exactOperationOutput("FinancePeriodsManageOutput") })); }

export function createFetchFinanceBackfillsRead(baseUrl: string): OperationMethod<"finance.backfills.read"> { return bindBackfillsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindBackfillsRead(client: OperationExecutor): OperationMethod<"finance.backfills.read"> { return bindOperation(client, defineOperation({ ...{"id":"finance.backfills.read","method":"GET","path":"/api/v1/finance/backfills","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinanceBackfillsReadInput", [] as const, false), output: exactOperationOutput("FinanceBackfillsReadOutput") })); }

export function createFetchFinanceBackfillsDecide(baseUrl: string): OperationMethod<"finance.backfills.decide"> { return bindBackfillsDecide(new ApiClient(baseUrl, new FetchTransport())); }

function bindBackfillsDecide(client: OperationExecutor): OperationMethod<"finance.backfills.decide"> { return bindOperation(client, defineOperation({ ...{"id":"finance.backfills.decide","method":"POST","path":"/api/v1/finance/backfills/{backfillid}/decide","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinanceBackfillsDecideInput", ["backfillid"] as const, true), output: exactOperationOutput("FinanceBackfillsDecideOutput") })); }

export function createFetchFinancePoliciesManage(baseUrl: string): OperationMethod<"finance.policies.manage"> { return bindPoliciesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindPoliciesManage(client: OperationExecutor): OperationMethod<"finance.policies.manage"> { return bindOperation(client, defineOperation({ ...{"id":"finance.policies.manage","method":"PUT","path":"/api/v1/finance/policies/{policyid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("FinancePoliciesManageInput", ["policyid"] as const, true), output: exactOperationOutput("FinancePoliciesManageOutput") })); }

export function createFetchFinanceInvoicesRead(baseUrl: string): OperationMethod<"finance.invoices.read"> { return bindInvoicesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindInvoicesRead(client: OperationExecutor): OperationMethod<"finance.invoices.read"> { return bindOperation(client, defineOperation({ ...{"id":"finance.invoices.read","method":"GET","path":"/api/v1/finance/invoices","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinanceInvoicesReadInput", [] as const, false), output: exactOperationOutput("FinanceInvoicesReadOutput") })); }

export function createFetchFinanceInvoicesDownload(baseUrl: string): OperationMethod<"finance.invoices.download"> { return bindInvoicesDownload(new ApiClient(baseUrl, new FetchTransport())); }

function bindInvoicesDownload(client: OperationExecutor): OperationMethod<"finance.invoices.download"> { return bindOperation(client, defineOperation({ ...{"id":"finance.invoices.download","method":"GET","path":"/api/v1/finance/invoices/{invoiceid}/download","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinanceInvoicesDownloadInput", ["invoiceid"] as const, false), output: exactOperationOutput("FinanceInvoicesDownloadOutput") })); }

export function createFetchFinancePoliciesRead(baseUrl: string): OperationMethod<"finance.policies.read"> { return bindPoliciesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindPoliciesRead(client: OperationExecutor): OperationMethod<"finance.policies.read"> { return bindOperation(client, defineOperation({ ...{"id":"finance.policies.read","method":"GET","path":"/api/v1/finance/policies","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinancePoliciesReadInput", [] as const, false), output: exactOperationOutput("FinancePoliciesReadOutput") })); }

export function createFetchFinancePoliciesPreview(baseUrl: string): OperationMethod<"finance.policies.preview"> { return bindPoliciesPreview(new ApiClient(baseUrl, new FetchTransport())); }

function bindPoliciesPreview(client: OperationExecutor): OperationMethod<"finance.policies.preview"> { return bindOperation(client, defineOperation({ ...{"id":"finance.policies.preview","method":"POST","path":"/api/v1/finance/policies/previews","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","FINANCE_POLICY_INVALID","FINANCE_REPAIR_CONFLICT","FINANCE_REPAIR_HASH_MISMATCH","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("FinancePoliciesPreviewInput", [] as const, true), output: exactOperationOutput("FinancePoliciesPreviewOutput") })); }

export function createFetchFinanceReconciliationrepairsRead(baseUrl: string): OperationMethod<"finance.reconciliationrepairs.read"> { return bindReconciliationrepairsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindReconciliationrepairsRead(client: OperationExecutor): OperationMethod<"finance.reconciliationrepairs.read"> { return bindOperation(client, defineOperation({ ...{"id":"finance.reconciliationrepairs.read","method":"GET","path":"/api/v1/finance/reconciliationrepairs","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FinanceReconciliationrepairsReadInput", [] as const, false), output: exactOperationOutput("FinanceReconciliationrepairsReadOutput") })); }

export function createFetchFinanceReconciliationrepairsPreview(baseUrl: string): OperationMethod<"finance.reconciliationrepairs.preview"> { return bindReconciliationrepairsPreview(new ApiClient(baseUrl, new FetchTransport())); }

function bindReconciliationrepairsPreview(client: OperationExecutor): OperationMethod<"finance.reconciliationrepairs.preview"> { return bindOperation(client, defineOperation({ ...{"id":"finance.reconciliationrepairs.preview","method":"POST","path":"/api/v1/finance/reconciliationrepairs/previews","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","FINANCE_POLICY_INVALID","FINANCE_REPAIR_CONFLICT","FINANCE_REPAIR_HASH_MISMATCH","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("FinanceReconciliationrepairsPreviewInput", [] as const, true), output: exactOperationOutput("FinanceReconciliationrepairsPreviewOutput") })); }

export function createFetchFinanceReconciliationrepairsSubmit(baseUrl: string): OperationMethod<"finance.reconciliationrepairs.submit"> { return bindReconciliationrepairsSubmit(new ApiClient(baseUrl, new FetchTransport())); }

function bindReconciliationrepairsSubmit(client: OperationExecutor): OperationMethod<"finance.reconciliationrepairs.submit"> { return bindOperation(client, defineOperation({ ...{"id":"finance.reconciliationrepairs.submit","method":"POST","path":"/api/v1/finance/reconciliationrepairs","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","FINANCE_POLICY_INVALID","FINANCE_REPAIR_ALREADY_DECIDED","FINANCE_REPAIR_CONFLICT","FINANCE_REPAIR_HASH_MISMATCH","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("FinanceReconciliationrepairsSubmitInput", [] as const, true), output: exactOperationOutput("FinanceReconciliationrepairsSubmitOutput") })); }

export function createFetchFinanceReconciliationrepairsDecide(baseUrl: string): OperationMethod<"finance.reconciliationrepairs.decide"> { return bindReconciliationrepairsDecide(new ApiClient(baseUrl, new FetchTransport())); }

function bindReconciliationrepairsDecide(client: OperationExecutor): OperationMethod<"finance.reconciliationrepairs.decide"> { return bindOperation(client, defineOperation({ ...{"id":"finance.reconciliationrepairs.decide","method":"POST","path":"/api/v1/finance/reconciliationrepairs/{repairid}/decisions","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","FINANCE_POLICY_INVALID","FINANCE_REPAIR_ALREADY_DECIDED","FINANCE_REPAIR_CONFLICT","FINANCE_REPAIR_HASH_MISMATCH","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("FinanceReconciliationrepairsDecideInput", ["repairid"] as const, true), output: exactOperationOutput("FinanceReconciliationrepairsDecideOutput") })); }

export function createFetchFinanceReconciliationrepairsReverse(baseUrl: string): OperationMethod<"finance.reconciliationrepairs.reverse"> { return bindReconciliationrepairsReverse(new ApiClient(baseUrl, new FetchTransport())); }

function bindReconciliationrepairsReverse(client: OperationExecutor): OperationMethod<"finance.reconciliationrepairs.reverse"> { return bindOperation(client, defineOperation({ ...{"id":"finance.reconciliationrepairs.reverse","method":"POST","path":"/api/v1/finance/reconciliationrepairs/{repairid}/reversals","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","FINANCE_POLICY_INVALID","FINANCE_REPAIR_ALREADY_DECIDED","FINANCE_REPAIR_CONFLICT","FINANCE_REPAIR_HASH_MISMATCH","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("FinanceReconciliationrepairsReverseInput", ["repairid"] as const, true), output: exactOperationOutput("FinanceReconciliationrepairsReverseOutput") })); }
