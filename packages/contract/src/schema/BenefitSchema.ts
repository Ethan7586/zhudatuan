import { array, literal, null as nullSchema, optional, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { currency, integer, isoUtc, pageOutput, pageQuery, unsigned, version } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const nullableTime = union([isoUtc, nullSchema()]);
const lotSummary = strictObject({ id: string(), batch: string(), totalMinor: unsigned, remainingMinor: unsigned, state: string(), effectiveAt: isoUtc, expiresAt: nullableTime });
const account = strictObject({
  id: string(),
  kind: literal(['welfare', 'meal', 'allowance']),
  currency,
  status: literal(['active', 'frozen', 'closed']),
  version,
  balance_minor: unsigned,
  frozen_minor: unsigned,
  available_minor: unsigned,
  lots: array(lotSummary),
});
const ledger = strictObject({ id: string(), account: string(), kind: string(), currency, amountMinor: integer, referenceType: string(), referenceId: string(), description: string(), occurredAt: isoUtc });
const planVersion = strictObject({ version, name: string(), kind: string(), currency, state: string(), changedBy: string(), changedAt: isoUtc });
const plan = strictObject({ id: string(), scope_id: string(), name: string(), kind: literal(['welfare', 'meal', 'allowance']), currency, state: literal(['draft', 'active', 'paused', 'retired']), version, versions: array(planVersion) });
const managedPlan = strictObject({ id: string(), name: string(), kind: literal(['welfare', 'meal', 'allowance']), currency, state: literal(['draft', 'active', 'paused', 'retired']), version });
const budget = strictObject({ id: string(), plan_id: string(), period: string(), total_minor: unsigned, granted_minor: unsigned, reserved_minor: unsigned, version });
const budgetRead = strictObject({ ...budget.shape, plan_name: string(), available_minor: unsigned });
const grant = strictObject({
  id: string(),
  plan_id: string(),
  budget_id: string(),
  state: string(),
  requested_by: string(),
  approved_by: nullableText,
  requested_count: unsigned,
  amount_minor: unsigned,
  reason: string(),
  created_at: isoUtc,
  updated_at: isoUtc,
  plan_version: union([version, nullSchema()]),
  effective_at: nullableTime,
  expires_at: nullableTime,
  timezone: nullableText,
  snapshot_hash: nullableText,
  pause_reason: nullableText,
});
const grantDecision = strictObject({ sequence: unsigned, decision: literal(['approved', 'rejected']), actor: string(), reason: string(), evidence: ContractJsonValueSchema, occurredAt: isoUtc });
const grantAction = strictObject({ action: literal(['pause', 'resume', 'cancel', 'revoke']), actor: string(), reason: string(), evidence: ContractJsonValueSchema, occurredAt: isoUtc });
const grantRead = strictObject({ ...grant.shape, plan_name: string(), period: string(), item_counts: record(string(), unsigned), decisions: array(grantDecision), actions: array(grantAction) });
const movement = strictObject({ id: string(), kind: string(), amountMinor: unsigned, referenceType: string(), referenceId: string(), source: nullableText, occurredAt: isoUtc });
const lot = strictObject({
  id: string(),
  account_id: string(),
  batch_id: string(),
  member_id: string(),
  total_minor: unsigned,
  remaining_minor: unsigned,
  state: string(),
  effective_at: isoUtc,
  expires_at: nullableTime,
  origin: string(),
  version,
  kind: string(),
  currency,
  scope_id: string(),
  movements: array(movement),
});

export const BENEFIT_BODY_SCHEMAS = {
  BenefitPlansManageInput: strictObject({ name: string(), kind: literal(['welfare', 'meal', 'allowance']), currency, state: literal(['draft', 'active', 'paused', 'retired']) }),
  BenefitBudgetsManageInput: strictObject({ plan: string(), period: string(), totalMinor: unsigned }),
  BenefitGrantsCreateInput: strictObject({ plan: string(), budget: string(), members: array(string()), amountMinor: unsigned, effectiveAt: optional(isoUtc), expiresAt: isoUtc, timezone: string(), reason: string() }),
  BenefitGrantsDecideInput: strictObject({ decision: literal(['approved', 'rejected']), reason: string(), evidence: optional(ContractJsonValueSchema) }),
  BenefitGrantsControlInput: strictObject({ action: literal(['pause', 'resume', 'cancel']), reason: string(), evidence: optional(ContractJsonValueSchema) }),
  BenefitGrantsRevokeInput: strictObject({ reason: string(), evidence: optional(ContractJsonValueSchema) }),
} as const;
export const BENEFIT_QUERY_SCHEMAS = {
  BenefitAccountsReadInput: strictObject(pageQuery),
  BenefitLedgersReadInput: strictObject(pageQuery),
  BenefitPlansReadInput: strictObject(pageQuery),
  BenefitBudgetsReadInput: strictObject(pageQuery),
  BenefitGrantsReadInput: strictObject(pageQuery),
  BenefitLotsReadInput: strictObject(pageQuery),
} as const;
export const BENEFIT_OUTPUT_SCHEMAS = {
  BenefitAccountsReadOutput: pageOutput(account),
  BenefitLedgersReadOutput: pageOutput(ledger),
  BenefitPlansReadOutput: pageOutput(plan),
  BenefitPlansManageOutput: managedPlan,
  BenefitBudgetsReadOutput: pageOutput(budgetRead),
  BenefitBudgetsManageOutput: budget,
  BenefitGrantsCreateOutput: grant,
  BenefitGrantsDecideOutput: grant,
  BenefitGrantsReadOutput: pageOutput(grantRead),
  BenefitGrantsControlOutput: union([grant, strictObject({ id: string(), budget_id: string() })]),
  BenefitGrantsRevokeOutput: grant,
  BenefitLotsReadOutput: pageOutput(lot),
} as const;
