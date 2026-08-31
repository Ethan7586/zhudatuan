import { array, literal, null as nullSchema, optional, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, pageOutput, pageQuery, version } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const nullableTime = union([isoUtc, nullSchema()]);
const jsonObject = record(string(), ContractJsonValueSchema);
const action = strictObject({ type: literal(['link', 'product', 'category', 'collection', 'exchangeableproduct', 'micropage', 'marketingactivity']), target: string() });
const block = strictObject({ id: string(), component: literal(['hero', 'notice', 'shortcut', 'productcollection', 'richtext']), content: jsonObject, action: optional(action) });
const document = strictObject({ version: literal(2), application: string(), pages: array(strictObject({ id: string(), path: string(), blocks: array(block) })) });
const application = strictObject({
  id: string(),
  scope_id: string(),
  code: string(),
  public_slug: string(),
  name: string(),
  status: literal(['draft', 'active', 'disabled']),
  head_version_id: nullableText,
  created_at: isoUtc,
  updated_at: isoUtc,
  version,
});
const versionRecord = strictObject({
  id: string(),
  application_id: string(),
  sequence: version,
  schema_version: literal('2'),
  configuration: document,
  configuration_hash: string(),
  validation_state: literal(['pending', 'valid', 'invalid']),
  reason: string(),
  created_by: string(),
  created_at: isoUtc,
});
const history = strictObject({
  id: string(),
  sequence: version,
  schemaVersion: literal('2'),
  configuration: document,
  validationState: literal(['pending', 'valid', 'invalid']),
  reason: string(),
  createdAt: isoUtc,
  lifecycle: literal(['published', 'draft']),
});
const release = strictObject({ id: string(), application_id: string(), version_id: string(), state: literal(['scheduled', 'active', 'retired', 'failed']), effective_at: isoUtc, retired_at: nullableTime, published_by: string() });

export const EXPERIENCE_BODY_SCHEMAS = {
  ExperienceApplicationsCreateInput: strictObject({ code: string(), publicSlug: string(), name: string() }),
  ExperienceApplicationsCopyInput: strictObject({ code: string(), publicSlug: string(), name: string(), reason: string() }),
  ExperienceApplicationsUpdateInput: strictObject({ name: optional(string()), status: optional(literal(['draft', 'active', 'disabled'])) }),
  ExperienceVersionsSaveInput: strictObject({ schemaVersion: union([literal('2'), literal(2)]), configuration: document, reason: string() }),
  ExperienceVersionsValidateInput: strictObject({}),
  ExperienceVersionsPublishInput: strictObject({}),
  ExperienceVersionsRestoreInput: strictObject({ reason: string() }),
} as const;

export const EXPERIENCE_QUERY_SCHEMAS = {
  ExperienceApplicationsReadInput: strictObject({ ...pageQuery, application: optional(string()) }),
} as const;

export const EXPERIENCE_OUTPUT_SCHEMAS = {
  ExperienceApplicationsCreateOutput: application,
  ExperienceApplicationsCopyOutput: strictObject({ ...application.shape, versionId: string() }),
  ExperienceApplicationsReadOutput: pageOutput(
    strictObject({
      id: string(),
      scope_id: string(),
      code: string(),
      public_slug: string(),
      name: string(),
      status: literal(['draft', 'active', 'disabled']),
      version,
      created_at: isoUtc,
      updated_at: isoUtc,
      head_id: nullableText,
      head_sequence: union([version, nullSchema()]),
      head_schema_version: nullableText,
      head_configuration: union([document, nullSchema()]),
      head_validation_state: nullableText,
      head_reason: nullableText,
      head_created_at: nullableTime,
      published_id: nullableText,
      published_sequence: union([version, nullSchema()]),
      published_schema_version: nullableText,
      published_configuration: union([document, nullSchema()]),
      published_validation_state: nullableText,
      published_reason: nullableText,
      published_created_at: nullableTime,
      domain: nullableText,
      mall_id: nullableText,
      pool_id: nullableText,
      history: array(history),
    })
  ),
  ExperienceApplicationsUpdateOutput: application,
  ExperienceVersionsSaveOutput: versionRecord,
  ExperienceVersionsValidateOutput: strictObject({ id: string(), application_id: string(), validation_state: literal(['valid', 'invalid']) }),
  ExperienceVersionsPublishOutput: release,
  ExperienceVersionsRestoreOutput: versionRecord,
} as const;
