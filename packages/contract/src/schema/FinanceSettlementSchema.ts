import { array, literal, null as nullSchema, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { currency, integer, isoUtc, unsigned, version } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const nullableTime = union([isoUtc, nullSchema()]);

const settlementLine = strictObject({ id: string(), sourceType: string(), sourceId: string(), amountMinor: unsigned, taxMinor: unsigned, state: string(), adjustmentOf: nullableText });
const split = strictObject({ id: string(), beneficiaryType: string(), beneficiaryId: string(), amountMinor: unsigned, basisPoints: unsigned, state: string() });
const adjustmentRead = strictObject({
  id: string(),
  line: string(),
  direction: string(),
  amountMinor: unsigned,
  taxMinor: unsigned,
  state: string(),
  requestedBy: string(),
  approvedBy: nullableText,
  reason: string(),
  evidence: ContractJsonValueSchema,
});

export const adjustment = strictObject({
  id: string(),
  settlement_id: string(),
  settlement_line_id: string(),
  scope_id: string(),
  direction: literal(['increase', 'decrease']),
  amount_minor: unsigned,
  tax_minor: unsigned,
  state: literal(['pending', 'approved', 'rejected']),
  requested_by: string(),
  approved_by: nullableText,
  reason: string(),
  evidence: ContractJsonValueSchema,
  created_at: isoUtc,
  decided_at: nullableTime,
  version,
});

export const settlement = strictObject({
  id: string(),
  partner_id: string(),
  period: string(),
  reconciliation_id: string(),
  amount_minor: integer,
  currency,
  state: string(),
  scope_id: string(),
  requested_by: nullableText,
  approved_by: nullableText,
  frozen_at: nullableTime,
  approved_at: nullableTime,
  paid_at: nullableTime,
  evidence: ContractJsonValueSchema,
  version,
  gross_minor: integer,
  fee_minor: integer,
  invoice_basis: string(),
});

export const settlementRead = strictObject({ ...settlement.shape, lines: array(settlementLine), splits: array(split), adjustments: array(adjustmentRead) });

export const withdrawal = strictObject({
  id: string(),
  scope_id: string(),
  settlement_id: string(),
  amount_minor: unsigned,
  currency,
  destination_ref: string(),
  state: string(),
  requested_by: string(),
  approved_by: nullableText,
  reason: string(),
  evidence: ContractJsonValueSchema,
  provider_reference: nullableText,
  created_at: isoUtc,
  updated_at: isoUtc,
  paid_at: nullableTime,
  version,
});

export const hold = strictObject({
  id: string(),
  scope_id: string(),
  account_id: string(),
  owner_type: string(),
  owner_id: string(),
  amount_minor: unsigned,
  state: string(),
  expires_at: isoUtc,
  created_at: isoUtc,
  updated_at: isoUtc,
  code: string(),
  currency,
});

export const period = strictObject({
  scope_id: string(),
  period: string(),
  state: string(),
  closed_at: nullableTime,
  closed_by: nullableText,
  close_id: nullableText,
  close_state: nullableText,
  source_hash: nullableText,
  requested_by: nullableText,
  approved_by: nullableText,
  reason: nullableText,
  evidence: union([ContractJsonValueSchema, nullSchema()]),
  debit_minor: union([unsigned, nullSchema()]),
  credit_minor: union([unsigned, nullSchema()]),
  statement_state: nullableText,
});

export const periodClose = strictObject({
  id: string(),
  scope_id: string(),
  period: string(),
  state: string(),
  source_hash: string(),
  requested_by: string(),
  approved_by: nullableText,
  reason: string(),
  evidence: ContractJsonValueSchema,
  requested_at: isoUtc,
  decided_at: nullableTime,
  version,
});

export const backfill = strictObject({
  id: string(),
  scope_id: string(),
  source_hash: string(),
  target_hash: string(),
  source_count: unsigned,
  target_count: unsigned,
  source_minor: integer,
  target_minor: integer,
  state: string(),
  prepared_by: string(),
  signed_by: nullableText,
  evidence: ContractJsonValueSchema,
  prepared_at: isoUtc,
  signed_at: nullableTime,
});

export const legacyPolicy = strictObject({ id: string(), scope_id: string(), kind: string(), rule: ContractJsonValueSchema, state: literal(['draft', 'active', 'retired']), version });

export const exportResult = strictObject({
  id: string(),
  scope: string(),
  report: literal('finance.statement'),
  filter: ContractJsonValueSchema,
  state: literal('queued'),
  cursor: nullSchema(),
  recordCount: literal(0),
  objectReference: nullSchema(),
  objectHash: nullSchema(),
  objectSize: nullSchema(),
  scanState: nullSchema(),
  expiresAt: nullSchema(),
  createdAt: isoUtc,
  generatedAt: nullSchema(),
});
