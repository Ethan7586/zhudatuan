import { array, literal, null as nullSchema, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, pageOutput, pageQuery, version } from './Primitives';

const policy = strictObject({ id: string(), name: string(), status: string(), active_version: version, updated_at: isoUtc, rule: union([ContractJsonValueSchema, nullSchema()]), published_at: union([isoUtc, nullSchema()]) });
const decision = strictObject({ policy_id: string(), policy_version: version, decision: literal(['eligible', 'ineligible']) });

export const QUALIFICATION_QUERY_SCHEMAS = { QualificationCenterReadInput: strictObject(pageQuery) } as const;
export const QUALIFICATION_BODY_SCHEMAS = {
  QualificationDecisionsPreviewInput: strictObject({ member: string(), resource: string() }),
  QualificationPoliciesManageInput: strictObject({ name: string(), rule: ContractJsonValueSchema }),
} as const;
export const QUALIFICATION_OUTPUT_SCHEMAS = {
  QualificationCenterReadOutput: pageOutput(policy),
  QualificationDecisionsPreviewOutput: strictObject({ decisions: array(decision) }),
  QualificationPoliciesManageOutput: strictObject({ id: string(), scope_id: string(), name: string(), status: literal('published'), active_version: version, created_at: isoUtc, updated_at: isoUtc, rule_hash: string() }),
} as const;
