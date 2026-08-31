import { array, discriminatedUnion, literal, null as nullSchema, number, optional, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, pageOutput, pageQuery, unsigned, version } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const nullableTime = union([isoUtc, nullSchema()]);
const nullableNumber = union([number(), nullSchema()]);
const nullableVersion = union([version, nullSchema()]);
const jsonObject = record(string(), ContractJsonValueSchema);
const nullableJson = union([ContractJsonValueSchema, nullSchema()]);
const rule = strictObject({
  blockedActors: optional(array(string())),
  denyOperations: optional(array(string())),
  reviewOperations: optional(array(string())),
  challengeOperations: optional(array(string())),
  maximumAmountMinor: optional(union([unsigned, nullSchema()])),
  reviewAmountMinor: optional(union([unsigned, nullSchema()])),
  velocity: optional(strictObject({ windowSeconds: unsigned, maximum: unsigned, outcome: literal(['challenge', 'review', 'deny']) })),
  scores: optional(array(strictObject({ signal: string(), minimum: unsigned, points: unsigned }))),
  thresholds: optional(strictObject({ challenge: unsigned, review: unsigned, deny: unsigned })),
});
const center = strictObject({
  id: string(),
  kind: literal(['policy', 'case']),
  name: nullableText,
  status: nullableText,
  active_version: nullableVersion,
  baseline_version: nullableVersion,
  rollout_percent: nullableNumber,
  rule_hash: nullableText,
  rule: nullableJson,
  candidate_version: nullableVersion,
  candidate_rollout: nullableNumber,
  candidate_hash: nullableText,
  candidate_rule: nullableJson,
  replay_state: nullableText,
  sample_count: nullableNumber,
  changed_count: nullableNumber,
  false_positive_rate: nullableNumber,
  preview: nullableJson,
  decision_id: nullableText,
  outcome: nullableText,
  safe_reason: nullableText,
  actor_id: nullableText,
  score: nullableNumber,
  evidence: nullableJson,
  created_at: nullableTime,
});
const policySaved = strictObject({
  id: string(),
  scope_id: string(),
  name: string(),
  status: literal(['draft', 'active']),
  active_version: nullableVersion,
  candidate_version: version,
  rule_hash: string(),
  rollout_percent: unsigned,
  replay_state: literal('queued'),
});
const policyActivated = strictObject({
  id: string(),
  scope_id: string(),
  name: string(),
  active_version: version,
  status: literal('active'),
  baseline_version: nullableVersion,
  updated_at: isoUtc,
  next_version: version,
  rollout_percent: unsigned,
  rule_hash: string(),
});
const policyRetired = strictObject({ id: string(), scope_id: string(), name: string(), active_version: nullableVersion, status: literal('retired'), baseline_version: nullableVersion, updated_at: isoUtc, next_version: version });
const reviewedCase = strictObject({
  id: string(),
  decision_id: string(),
  state: literal(['open', 'reviewing', 'cleared', 'confirmed', 'closed']),
  assigned_to: nullableText,
  created_at: isoUtc,
  closed_at: nullableTime,
  scope_id: string(),
  outcome: literal(['review', 'deny']),
  safe_reason: literal(['policy', 'amount', 'velocity', 'signal', 'list']),
  reviewed_by: string(),
  review_reason: string(),
  review_evidence: jsonObject,
  reviewed_at: isoUtc,
  resolution: union([literal(['cleared', 'confirmed']), nullSchema()]),
});

export const RISK_BODY_SCHEMAS = {
  RiskPoliciesManageInput: discriminatedUnion('action', [
    strictObject({ action: literal('save'), name: string(), rule, rolloutPercent: optional(unsigned) }),
    strictObject({ action: literal('activate'), version, rolloutPercent: optional(unsigned) }),
    strictObject({ action: literal('retire') }),
  ]),
  RiskCasesReviewInput: strictObject({ action: literal(['accept', 'clear', 'confirm', 'close']), reason: string(), evidence: optional(jsonObject) }),
} as const;
export const RISK_QUERY_SCHEMAS = { RiskCenterReadInput: strictObject(pageQuery) } as const;
export const RISK_OUTPUT_SCHEMAS = {
  RiskCenterReadOutput: pageOutput(center),
  RiskPoliciesManageOutput: union([policySaved, policyActivated, policyRetired]),
  RiskCasesReviewOutput: reviewedCase,
} as const;
