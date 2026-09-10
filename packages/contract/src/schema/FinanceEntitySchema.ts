import { array, boolean, literal, maxLength, minLength, null as nullSchema, optional, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { currency, expectedVersion, id, integer, isoUtc, unsigned, version } from './Primitives';

export const entry = strictObject({ account: string(), debitMinor: unsigned, creditMinor: unsigned, currency, memo: string() });
export const policy = strictObject({
  id: id<'financepolicy'>(),
  name: string(),
  status: literal(['draft', 'active', 'retired']),
  trigger: string(),
  entries: array(entry),
  effectiveAt: isoUtc,
  expiresAt: union([isoUtc, nullSchema()]),
  version,
});
export const difference = strictObject({ id: id<'reconciliationdifference'>(), kind: string(), expectedMinor: integer, actualMinor: integer, deltaMinor: integer, currency });
export const repairStatus = literal(['draft', 'submitted', 'approved', 'rejected', 'reversed']);
export const nullableText = union([string(), nullSchema()]);
export const nullableTime = union([isoUtc, nullSchema()]);
export const repairReason = string().check(minLength(2), maxLength(1_000));
export const repairHash = string().check(minLength(64), maxLength(64));
export const repair = strictObject({
  id: id<'reconciliationrepair'>(),
  statementId: id<'statement'>(),
  status: repairStatus,
  sourceHash: repairHash,
  sourceJournalId: id<'journal'>(),
  sourceJournalHash: repairHash,
  previewHash: repairHash,
  differences: array(difference),
  entries: array(entry),
  makerId: id<'membership'>(),
  checkerId: union([id<'membership'>(), nullSchema()]),
  approvalInstanceId: union([id<'approvalinstance'>(), nullSchema()]),
  approvalAmountMinor: union([unsigned, nullSchema()]),
  sourceReversalJournalId: union([id<'journal'>(), nullSchema()]),
  replacementJournalId: union([id<'journal'>(), nullSchema()]),
  rollbackJournalId: union([id<'journal'>(), nullSchema()]),
  reason: repairReason,
  decisionReason: nullableText,
  reverseReason: nullableText,
  reversedBy: union([id<'membership'>(), nullSchema()]),
  decidedAt: nullableTime,
  reversedAt: nullableTime,
  version,
  createdAt: isoUtc,
  updatedAt: isoUtc,
});
export const policyDraft = {
  policyId: optional(id<'financepolicy'>()),
  targetStatus: optional(literal(['active', 'retired'])),
  name: string(),
  trigger: string(),
  entries: array(entry),
  effectiveAt: isoUtc,
  expiresAt: optional(union([isoUtc, nullSchema()])),
} as const;
export const repairDraft = { statementId: id<'statement'>(), sourceJournalId: id<'journal'>(), sourceHash: repairHash, entries: array(entry), reason: repairReason, expectedVersion } as const;
export const facet = strictObject({ value: string(), label: string(), count: unsigned });
export const providerFacet = strictObject({ ...facet.shape, available: boolean() });
export const facetGroup = strictObject({ items: array(facet), reason: nullableText });
export const providerFacetGroup = strictObject({ items: array(providerFacet), reason: nullableText });
export const auditReference = string().check(minLength(1), maxLength(200));
export const auditFact = strictObject({
  id: string(),
  kind: literal(['journal', 'entry', 'statement', 'reconciliation', 'settlement', 'withdrawal', 'invoice', 'repair']),
  label: string(),
  business_reference: string(),
  state: nullableText,
  amount_minor: union([integer, nullSchema()]),
  currency: union([currency, nullSchema()]),
  occurred_at: nullableTime,
  version: union([version, nullSchema()]),
});
export const auditEvent = strictObject({
  id: string(),
  type: string(),
  event_version: version,
  aggregate_type: string(),
  aggregate_id: string(),
  state: literal(['pending', 'published', 'failed']),
  occurred_at: isoUtc,
  trace_id: string(),
});
export const auditEvidence = strictObject({
  id: string(),
  kind: literal(['command', 'access']),
  action: string(),
  resource_type: string(),
  resource_id: nullableText,
  actor_id: nullableText,
  actor_type: string(),
  before_hash: nullableText,
  after_hash: nullableText,
  record_hash: string(),
  evidence: ContractJsonValueSchema,
  occurred_at: isoUtc,
  trace_id: string(),
});
export const overview = strictObject({ currency, balance_minor: integer, liability_minor: integer, income_minor: integer, expense_minor: integer, cash_minor: integer, journal_count: unsigned, watermark: nullableTime });
export const ledgerEntry = strictObject({ id: string(), side: literal(['debit', 'credit']), amount_minor: unsigned, code: string(), currency, reference_type: string(), reference_id: string(), description: string(), posted_at: isoUtc });
export const statement = strictObject({
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
export const reconciliationItem = strictObject({
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
export const reconciliation = strictObject({
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
export const reconciliationRead = strictObject({ ...reconciliation.shape, item_counts: record(string(), unsigned), items: array(reconciliationItem) });
export const resolvedItem = strictObject({
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
