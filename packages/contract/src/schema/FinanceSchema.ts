import { array, boolean, discriminatedUnion, literal, null as nullSchema, optional, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { currency, decision, expectedVersion, id, integer, isoUtc, pageOutput, pageQuery, unsigned, version } from './Primitives';
import { adjustment, backfill, exportResult, financePolicy, hold, period, periodClose, settlement, settlementRead, withdrawal } from './FinanceSettlementSchema';

const entry = strictObject({ account: string(), debitMinor: unsigned, creditMinor: unsigned, currency, memo: string() });
const policy = strictObject({
  id: id<'financepolicy'>(),
  name: string(),
  status: literal(['draft', 'active', 'retired']),
  trigger: string(),
  entries: array(entry),
  effectiveAt: isoUtc,
  expiresAt: union([isoUtc, nullSchema()]),
  version,
});
const difference = strictObject({ id: id<'reconciliationdifference'>(), kind: string(), expectedMinor: integer, actualMinor: integer, deltaMinor: integer, currency });
const repairStatus = literal(['draft', 'submitted', 'approved', 'rejected', 'reversed']);
const repair = strictObject({
  id: id<'reconciliationrepair'>(),
  statementId: id<'statement'>(),
  status: repairStatus,
  sourceHash: string(),
  previewHash: string(),
  differences: array(difference),
  entries: array(entry),
  makerId: id<'membership'>(),
  checkerId: union([id<'membership'>(), nullSchema()]),
  reason: string(),
  version,
  createdAt: isoUtc,
  updatedAt: isoUtc,
});
const policyDraft = { name: string(), trigger: string(), entries: array(entry), effectiveAt: isoUtc, expiresAt: optional(union([isoUtc, nullSchema()])) } as const;
const repairDraft = { statementId: id<'statement'>(), sourceHash: string(), entries: array(entry), reason: string(), expectedVersion } as const;
const nullableText = union([string(), nullSchema()]);
const nullableTime = union([isoUtc, nullSchema()]);
const overview = strictObject({ currency, balance_minor: integer, liability_minor: integer, income_minor: integer, expense_minor: integer, cash_minor: integer, journal_count: unsigned, watermark: nullableTime });
const ledgerEntry = strictObject({ id: string(), side: literal(['debit', 'credit']), amount_minor: unsigned, code: string(), currency, reference_type: string(), reference_id: string(), description: string(), posted_at: isoUtc });
const statement = strictObject({
  id: string(),
  scope_id: string(),
  period_start: string(),
  period_end: string(),
  currency,
  opening_minor: integer,
  debit_minor: unsigned,
  credit_minor: unsigned,
  closing_minor: integer,
  state: literal(['draft', 'final']),
  object_ref: nullableText,
  sha256: nullableText,
  generated_at: isoUtc,
});
const reconciliationItem = strictObject({
  id: string(),
  externalMinor: integer,
  internalMinor: integer,
  differenceMinor: integer,
  state: string(),
  reasonCode: nullableText,
  evidence: ContractJsonValueSchema,
  resolution: union([ContractJsonValueSchema, nullSchema()]),
  resolvedBy: nullableText,
  approvedBy: nullableText,
});
const reconciliation = strictObject({
  id: string(),
  scope_id: string(),
  provider: string(),
  partner_id: string(),
  period: string(),
  statement_ref: string(),
  statement_hash: string(),
  state: string(),
  debit_minor: integer,
  credit_minor: integer,
  difference_minor: integer,
  created_by: string(),
  approved_by: nullableText,
  evidence: ContractJsonValueSchema,
  updated_at: isoUtc,
  version,
});
const reconciliationRead = strictObject({ ...reconciliation.shape, item_counts: record(string(), unsigned), items: array(reconciliationItem) });
const resolvedItem = strictObject({
  id: string(),
  reconciliation_id: string(),
  statement_line_id: string(),
  scope_id: string(),
  internal_type: nullableText,
  internal_id: nullableText,
  external_minor: integer,
  internal_minor: integer,
  difference_minor: integer,
  state: string(),
  reason_code: nullableText,
  evidence: ContractJsonValueSchema,
  resolution: union([ContractJsonValueSchema, nullSchema()]),
  resolved_by: nullableText,
  approved_by: nullableText,
  resolved_at: nullableTime,
  approved_at: nullableTime,
  version,
});
export const FINANCE_QUERY_SCHEMAS = {
  FinanceOverviewReadInput: strictObject({}),
  FinanceEntriesReadInput: strictObject(pageQuery),
  FinanceStatementsReadInput: strictObject(pageQuery),
  FinanceReconciliationsReadInput: strictObject(pageQuery),
  FinanceSettlementsReadInput: strictObject(pageQuery),
  FinanceWithdrawalsReadInput: strictObject(pageQuery),
  FinanceHoldsReadInput: strictObject(pageQuery),
  FinancePeriodsReadInput: strictObject(pageQuery),
  FinanceBackfillsReadInput: strictObject(pageQuery),
  FinancePoliciesReadInput: strictObject({ ...pageQuery, status: optional(literal(['draft', 'active', 'retired'])) }),
  FinanceReconciliationrepairsReadInput: strictObject({ ...pageQuery, status: optional(repairStatus), statementId: optional(id<'statement'>()) }),
} as const;

export const FINANCE_BODY_SCHEMAS = {
  FinanceStatementsExportInput: strictObject({ periodStart: optional(string()), periodEnd: optional(string()), currency: optional(currency), state: optional(literal(['draft', 'final'])) }),
  FinanceReconciliationsManageInput: discriminatedUnion('action', [
    strictObject({ action: literal('retry'), reason: string(), evidence: optional(ContractJsonValueSchema) }),
    strictObject({ action: literal(['resolve', 'approveitem']), item: string(), reason: string(), evidence: optional(ContractJsonValueSchema) }),
    strictObject({ action: literal('approve'), reason: string(), evidence: optional(ContractJsonValueSchema) }),
  ]),
  FinanceSettlementsDecideInput: strictObject({ decision: literal(['approved', 'rejected']), reason: string(), evidence: optional(ContractJsonValueSchema) }),
  FinanceSettlementsAdjustInput: discriminatedUnion('action', [
    strictObject({ action: literal('request'), line: string(), direction: literal(['increase', 'decrease']), amountMinor: unsigned, taxMinor: optional(unsigned), reason: string(), evidence: optional(ContractJsonValueSchema) }),
    strictObject({ action: literal(['approve', 'reject']), adjustment: string(), reason: string(), evidence: optional(ContractJsonValueSchema) }),
  ]),
  FinanceWithdrawalsCreateInput: strictObject({ settlement: string(), amountMinor: unsigned, destinationRef: string(), reason: string(), evidence: optional(ContractJsonValueSchema) }),
  FinanceWithdrawalsDecideInput: strictObject({ decision: literal(['approved', 'rejected']), reason: string(), evidence: optional(ContractJsonValueSchema) }),
  FinanceWithdrawalsRecoverInput: strictObject({ reason: string(), evidence: optional(ContractJsonValueSchema) }),
  FinancePeriodsManageInput: strictObject({ action: literal(['request', 'approve', 'reject']), reason: string(), evidence: optional(ContractJsonValueSchema) }),
  FinanceBackfillsDecideInput: strictObject({ decision: literal(['approved', 'rejected']), reason: string(), evidence: optional(ContractJsonValueSchema) }),
  FinancePoliciesManageInput: strictObject({ kind: string(), rule: ContractJsonValueSchema }),
  FinancePoliciesPreviewInput: strictObject({ ...policyDraft, expectedVersion, sampleFrom: isoUtc, sampleTo: isoUtc }),
  FinanceReconciliationrepairsPreviewInput: strictObject(repairDraft),
  FinanceReconciliationrepairsSubmitInput: strictObject({ previewToken: string(), previewHash: string(), expectedVersion, reason: string() }),
  FinanceReconciliationrepairsDecideInput: strictObject({ decision, expectedVersion, reason: string() }),
  FinanceReconciliationrepairsReverseInput: strictObject({ expectedVersion, reason: string() }),
} as const;

export const FINANCE_OUTPUT_SCHEMAS = {
  FinanceOverviewReadOutput: strictObject({ items: array(overview) }),
  FinanceEntriesReadOutput: pageOutput(ledgerEntry),
  FinanceStatementsReadOutput: pageOutput(statement),
  FinanceStatementsExportOutput: exportResult,
  FinanceReconciliationsManageOutput: union([reconciliation, resolvedItem]),
  FinanceReconciliationsReadOutput: pageOutput(reconciliationRead),
  FinanceSettlementsReadOutput: pageOutput(settlementRead),
  FinanceSettlementsDecideOutput: settlement,
  FinanceSettlementsAdjustOutput: adjustment,
  FinanceWithdrawalsReadOutput: pageOutput(withdrawal),
  FinanceWithdrawalsCreateOutput: withdrawal,
  FinanceWithdrawalsDecideOutput: withdrawal,
  FinanceWithdrawalsRecoverOutput: withdrawal,
  FinanceHoldsReadOutput: pageOutput(hold),
  FinancePeriodsReadOutput: pageOutput(period),
  FinancePeriodsManageOutput: periodClose,
  FinanceBackfillsReadOutput: pageOutput(backfill),
  FinanceBackfillsDecideOutput: backfill,
  FinancePoliciesManageOutput: financePolicy,
  FinancePoliciesReadOutput: pageOutput(policy),
  FinancePoliciesPreviewOutput: strictObject({ policy, balanced: boolean(), affectedCount: unsigned, sampleEntries: array(entry), previewToken: string(), previewHash: string(), expiresAt: isoUtc }),
  FinanceReconciliationrepairsReadOutput: pageOutput(repair),
  FinanceReconciliationrepairsPreviewOutput: strictObject({ repair, balanced: boolean(), previewToken: string(), previewHash: string(), expiresAt: isoUtc }),
  FinanceReconciliationrepairsSubmitOutput: repair,
  FinanceReconciliationrepairsDecideOutput: repair,
  FinanceReconciliationrepairsReverseOutput: repair,
} as const;
