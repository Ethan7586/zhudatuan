import { array, discriminatedUnion, literal, null as nullSchema, optional, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, pageQuery, unsigned, version } from './Primitives';

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
const target = strictObject({ kind: literal(['partner', 'product', 'category', 'region']), id: string() });
const material = strictObject({
  id: string(),
  kind: literal(['license', 'certificate', 'authorization', 'agreement', 'other']),
  reference: string(),
  sha256: string(),
});
const qualificationCase = strictObject({
  id: string(),
  title: string(),
  subject_kind: literal(['partner', 'product', 'category', 'region']),
  subject_id: string(),
  state: literal(['draft', 'verified', 'published', 'revoked', 'expired']),
  version,
  effective_at: isoUtc,
  expires_at: isoUtc,
  reviewed_at: union([isoUtc, nullSchema()]),
  published_at: union([isoUtc, nullSchema()]),
  revoked_at: union([isoUtc, nullSchema()]),
  revoke_reason: union([string(), nullSchema()]),
  evidence_count: unsigned,
  applicability: array(target),
});
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
  QualificationQualificationsPublishInput: strictObject({ title: string(), subject: target, applicability: array(target), evidence: array(material), effectiveAt: optional(isoUtc), expiresAt: isoUtc }),
  QualificationQualificationsRevokeInput: strictObject({ reason: string() }),
  QualificationEvidenceuploadsCreateInput: strictObject({
    name: string(),
    kind: literal(['license', 'certificate', 'authorization', 'agreement', 'other']),
    contentType: literal(['image/jpeg', 'image/png', 'application/pdf']),
    sizeBytes: unsigned,
    sha256: string(),
  }),
} as const;
export const QUALIFICATION_OUTPUT_SCHEMAS = {
  QualificationCenterReadOutput: strictObject({ items: array(policy), count: unsigned, nextCursor: optional(string()), cases: array(qualificationCase) }),
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
  QualificationQualificationsPublishOutput: qualificationCase,
  QualificationQualificationsRevokeOutput: qualificationCase,
  QualificationEvidenceuploadsCreateOutput: strictObject({
    evidenceId: string(),
    kind: literal(['license', 'certificate', 'authorization', 'agreement', 'other']),
    objectId: string(),
    sha256: string(),
    upload: strictObject({ url: string(), method: literal('PUT'), headers: record(string(), string()), expiresAt: isoUtc }),
  }),
} as const;
