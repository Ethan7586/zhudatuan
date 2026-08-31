import { array, boolean, literal, null as nullSchema, optional, strictObject, string, union } from 'zod/mini';
import { importRead } from './ImportSchema';
import { ContractJsonValueSchema } from './JsonSchema';
import { currency, isoUtc, pageOutput, pageQuery, unsigned, version } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const nullableTime = union([isoUtc, nullSchema()]);
const allocationSummary = strictObject({ scope: string(), quantity: unsigned, used: unsigned, available: unsigned, version });
const importProblem = strictObject({ row: unsigned, code: string() });
const library = strictObject({
  id: string(),
  scope_id: string(),
  code_prefix: string(),
  next_sequence: unsigned,
  provider: nullableText,
  mode: literal(['generated', 'imported']),
  status: literal(['draft', 'ready', 'depleted', 'disabled']),
  version,
  import_state: nullableText,
  total_count: union([unsigned, nullSchema()]),
  success_count: union([unsigned, nullSchema()]),
  failure_count: union([unsigned, nullSchema()]),
  allocations: array(allocationSummary),
  errors: array(importProblem),
});
const createdLibrary = strictObject({
  id: string(),
  scope_id: string(),
  code_prefix: string(),
  next_sequence: unsigned,
  provider: nullableText,
  mode: literal(['generated', 'imported']),
  status: literal(['draft', 'ready']),
  version,
  import: optional(string()),
});
const allocation = strictObject({ id: string(), cardpool_id: string(), scope_id: string(), quantity: unsigned, used_count: unsigned, available: unsigned, version });
const programVersion = strictObject({ version, valueMinor: unsigned, validityDays: unsigned, approvalRequired: boolean(), status: string(), changedBy: string(), changedAt: isoUtc });
const program = strictObject({ id: string(), scope_id: string(), name: string(), value_minor: unsigned, currency, default_valid_days: unsigned, status: string(), approval_required: boolean(), version, versions: array(programVersion) });
const programSaved = strictObject({ id: string(), scope_id: string(), name: string(), value_minor: unsigned, default_valid_days: unsigned, currency, status: string(), approval_required: boolean(), version });
const approval = strictObject({ sequence: unsigned, decision: literal(['approved', 'rejected']), reason: string(), actor: string(), occurredAt: isoUtc });
const reserve = strictObject({
  id: string(),
  request_number: string(),
  scope_id: string(),
  program_id: string(),
  program_version: version,
  requested_count: unsigned,
  requested_minor: unsigned,
  reason: string(),
  state: string(),
  requested_by: string(),
  submitted_at: nullableTime,
  resolved_at: nullableTime,
  resolved_by: nullableText,
  created_at: isoUtc,
  updated_at: isoUtc,
});
const reserveRead = strictObject({
  id: string(),
  request_number: string(),
  program_id: string(),
  name: string(),
  requested_count: unsigned,
  program_version: version,
  requested_minor: unsigned,
  reason: string(),
  state: string(),
  requested_by: string(),
  submitted_at: nullableTime,
  resolved_by: nullableText,
  resolved_at: nullableTime,
  created_at: isoUtc,
  approvals: array(approval),
});
const issue = strictObject({
  id: string(),
  program_id: string(),
  program_version: version,
  cardpool_id: nullableText,
  reserve_request_id: nullableText,
  state: string(),
  requested_count: unsigned,
  issued_count: unsigned,
  created_at: isoUtc,
});
const issueRead = strictObject({ ...issue.shape, name: string() });
const statusBatch = strictObject({
  id: string(),
  scope_id: string(),
  action: literal(['activate', 'disable', 'extend', 'void']),
  expires_at: nullableTime,
  reason: string(),
  actor_id: string(),
  state: string(),
  requested_count: unsigned,
  succeeded_count: unsigned,
  failed_count: unsigned,
  created_at: isoUtc,
  updated_at: isoUtc,
});
const statusBatchRead = strictObject({
  id: string(),
  action: string(),
  expires_at: nullableTime,
  reason: string(),
  actor_id: string(),
  state: string(),
  requested_count: unsigned,
  succeeded_count: unsigned,
  failed_count: unsigned,
  created_at: isoUtc,
  updated_at: isoUtc,
});
const statusItem = strictObject({ batch_id: string(), voucher_id: string(), state: string(), previous_state: nullableText, next_state: nullableText, error_code: nullableText, updated_at: isoUtc });
const binding = strictObject({ id: string(), program_id: string(), name: string(), member_id: nullableText, initial_minor: unsigned, remaining_minor: unsigned, state: string(), expires_at: isoUtc, version, cursor_sort: isoUtc });
const redemption = strictObject({
  id: string(),
  voucher_id: string(),
  verification_id: string(),
  order_id: nullableText,
  amount_minor: unsigned,
  redeemed_at: isoUtc,
  reversed_at: nullableTime,
  version,
  program_id: string(),
  reversed_minor: unsigned,
  receipt_state: literal(['redeemed', 'partially_reversed', 'reversed']),
  last_reversed_at: nullableTime,
});
const history = strictObject({ voucher_id: string(), sequence: unsigned, previous_state: nullableText, next_state: string(), reason: string(), actor_id: string(), occurred_at: isoUtc, cursor_id: string() });
const reversed = strictObject({ id: string(), voucher_id: string(), amount_minor: unsigned, previous_state: string() });
const imported = strictObject({ cardpool_id: string(), ...importRead.shape });

export const VOUCHER_BODY_SCHEMAS = {
  VoucherCardlibrariesAllocateInput: strictObject({ scope: string(), count: unsigned }),
  VoucherProgramsManageInput: strictObject({ name: string(), valueMinor: unsigned, validityDays: unsigned, status: literal(['draft', 'active', 'paused', 'retired']), approvalRequired: optional(boolean()) }),
  VoucherReservesRequestInput: strictObject({ program: string(), count: unsigned, reason: string() }),
  VoucherReservesDecideInput: strictObject({ decision: literal(['approved', 'rejected']), reason: string(), evidence: optional(ContractJsonValueSchema) }),
  VoucherBatchesIssueInput: strictObject({ program: string(), cardpool: string(), count: unsigned, reserve: optional(string()) }),
  VoucherBatchesRetryInput: strictObject({}),
  VoucherStatusBatchInput: strictObject({ ids: array(string()), action: literal(['activate', 'disable', 'extend', 'void']), reason: string(), expiresAt: optional(isoUtc) }),
  VoucherBindingsManageInput: strictObject({ member: string(), reason: string() }),
  VoucherRedemptionsReverseInput: strictObject({ reason: string() }),
} as const;
export const VOUCHER_QUERY_SCHEMAS = {
  VoucherCardlibrariesReadInput: strictObject(pageQuery),
  VoucherImportsReadInput: strictObject({}),
  VoucherProgramsReadInput: strictObject(pageQuery),
  VoucherReservesReadInput: strictObject(pageQuery),
  VoucherBatchesReadInput: strictObject(pageQuery),
  VoucherStatusbatchesReadInput: strictObject({ ...pageQuery, batch: optional(string()) }),
  VoucherBindingsReadInput: strictObject(pageQuery),
  VoucherRedemptionsReadInput: strictObject(pageQuery),
  VoucherHistoryReadInput: strictObject(pageQuery),
} as const;
export const VOUCHER_OUTPUT_SCHEMAS = {
  VoucherCardlibrariesReadOutput: pageOutput(library),
  VoucherCardlibrariesCreateOutput: createdLibrary,
  VoucherCardlibrariesAllocateOutput: allocation,
  VoucherImportsReadOutput: imported,
  VoucherProgramsReadOutput: pageOutput(program),
  VoucherProgramsManageOutput: programSaved,
  VoucherReservesReadOutput: pageOutput(reserveRead),
  VoucherReservesRequestOutput: reserve,
  VoucherReservesDecideOutput: strictObject({ id: string(), requested_by: string() }),
  VoucherBatchesReadOutput: pageOutput(issueRead),
  VoucherBatchesIssueOutput: issue,
  VoucherBatchesRetryOutput: issue,
  VoucherStatusBatchOutput: statusBatch,
  VoucherStatusbatchesReadOutput: union([pageOutput(statusBatchRead), pageOutput(statusItem)]),
  VoucherBindingsReadOutput: pageOutput(binding),
  VoucherBindingsManageOutput: strictObject({ id: string(), state: literal('active'), version }),
  VoucherRedemptionsReadOutput: pageOutput(redemption),
  VoucherHistoryReadOutput: pageOutput(history),
  VoucherRedemptionsReverseOutput: reversed,
} as const;
