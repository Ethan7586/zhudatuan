import { array, discriminatedUnion, literal, null as nullSchema, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, pageOutput, pageQuery, version } from './Primitives';

const policyVersion = strictObject({ version, rule_hash: string(), published_at: union([isoUtc, nullSchema()]), created_by: string() });
const policy = strictObject({
  id: string(),
  name: string(),
  status: literal(['draft', 'published', 'retired']),
  active_version: union([version, nullSchema()]),
  updated_at: isoUtc,
  rule: union([ContractJsonValueSchema, nullSchema()]),
  rule_hash: union([string(), nullSchema()]),
  published_at: union([isoUtc, nullSchema()]),
  versions: array(policyVersion),
});
const decision = strictObject({ policy_id: string(), policy_version: version, decision: literal(['eligible', 'ineligible']) });
const impact = strictObject({
  action: literal(['publish', 'rollback']),
  policy_id: string(),
  current_version: union([version, nullSchema()]),
  next_version: version,
  source_version: union([version, nullSchema()]),
  current_hash: union([string(), nullSchema()]),
  proposed_hash: string(),
  changed_fields: array(string()),
  potential_profiles: version,
  resource_count: version,
  subject_count: version,
  limit_count: version,
});

export const QUALIFICATION_QUERY_SCHEMAS = { QualificationCenterReadInput: strictObject(pageQuery) } as const;
export const QUALIFICATION_BODY_SCHEMAS = {
  QualificationDecisionsPreviewInput: discriminatedUnion('kind', [
    strictObject({ kind: literal('decision'), member: string(), resource: string() }),
    strictObject({ kind: literal('publish'), policy: string(), name: string(), rule: ContractJsonValueSchema }),
    strictObject({ kind: literal('rollback'), policy: string(), version }),
  ]),
  QualificationPoliciesManageInput: discriminatedUnion('action', [strictObject({ action: literal('publish'), name: string(), rule: ContractJsonValueSchema }), strictObject({ action: literal('rollback'), version })]),
} as const;
export const QUALIFICATION_OUTPUT_SCHEMAS = {
  QualificationCenterReadOutput: pageOutput(policy),
  QualificationDecisionsPreviewOutput: discriminatedUnion('kind', [strictObject({ kind: literal('decision'), decisions: array(decision) }), strictObject({ kind: literal('policy'), impact })]),
  QualificationPoliciesManageOutput: strictObject({
    id: string(),
    scope_id: string(),
    name: string(),
    status: literal('published'),
    active_version: version,
    created_at: isoUtc,
    updated_at: isoUtc,
    rule_hash: string(),
    action: literal(['publish', 'rollback']),
    source_version: union([version, nullSchema()]),
  }),
} as const;
