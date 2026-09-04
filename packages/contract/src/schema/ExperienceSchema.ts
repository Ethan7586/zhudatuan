import { array, discriminatedUnion, literal, null as nullSchema, optional, record, regex, strictObject, string, union } from 'zod/mini';
import { STOREFRONT_ENTRY_URL_PATTERN, STOREFRONT_HANDLE_PATTERN } from '../StorefrontEntry';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, pageOutput, pageQuery, version } from './Primitives';

const nullableTime = union([isoUtc, nullSchema()]);
const jsonObject = record(string(), ContractJsonValueSchema);
const action = strictObject({ type: literal(['link', 'product', 'category', 'collection', 'exchangeableproduct', 'micropage', 'marketingactivity']), target: string() });
const block = strictObject({ id: string(), component: literal(['hero', 'notice', 'shortcut', 'productcollection', 'richtext']), content: jsonObject, action: optional(action) });
const theme = strictObject({ preset: literal(['shop', 'market', 'governance']), primaryColor: string(), accentColor: string(), logoObjectRef: union([string(), nullSchema()]), faviconObjectRef: union([string(), nullSchema()]) });
const domain = strictObject({
  mode: literal(['platform', 'custom', 'unknown']),
  address: union([string(), nullSchema()]),
  state: literal(['ready', 'pending', 'invalid', 'disabled', 'unknown']),
});
const navigation = strictObject({ id: string(), label: string(), page: string() });
const document = strictObject({ version: literal(2), application: string(), theme, navigation: array(navigation), assets: array(string()), pages: array(strictObject({ id: string(), path: string(), blocks: array(block) })) });
const validationIssue = strictObject({ code: string(), path: string(), message: string() });
const versionRecord = strictObject({
  id: string(),
  application_id: string(),
  sequence: version,
  schema_version: literal('2'),
  configuration: document,
  configuration_hash: string(),
  validation_state: literal(['pending', 'valid', 'invalid']),
  validation_issues: array(validationIssue),
  reason: string(),
  created_by: string(),
  created_at: isoUtc,
});
const history = strictObject({
  id: string(),
  sequence: version,
  schemaVersion: literal('2'),
  validationState: literal(['pending', 'valid', 'invalid']),
  reason: string(),
  createdAt: isoUtc,
  lifecycle: literal(['published', 'draft']),
});
const release = strictObject({
  id: string(),
  application_id: string(),
  version_id: string(),
  pool_id: string(),
  state: literal(['scheduled', 'active', 'retired', 'failed']),
  effective_at: isoUtc,
  retired_at: nullableTime,
  published_by: string(),
});
const handle = string().check(regex(STOREFRONT_HANDLE_PATTERN));
const publicUrl = string().check(regex(STOREFRONT_ENTRY_URL_PATTERN));
const contentHash = string().check(regex(/^[0-9a-f]{64}$/));
const unavailableEntry = (state: 'unpublished' | 'disabled') => strictObject({ handle, url: publicUrl, state: literal(state) });
const entry = discriminatedUnion('state', [
  strictObject({ handle, url: publicUrl, state: literal('ready'), releaseId: string(), releaseVersion: string(), contentHash }),
  unavailableEntry('unpublished'),
  unavailableEntry('disabled'),
  strictObject({ handle, url: publicUrl, state: literal('invalid'), requestId: string() }),
]);
const summary = strictObject({
  id: string(),
  mallId: string(),
  mallName: union([string(), nullSchema()]),
  brandName: union([string(), nullSchema()]),
  code: string(),
  publicSlug: handle,
  name: string(),
  status: literal(['draft', 'active', 'disabled']),
  version,
  headSequence: union([version, nullSchema()]),
  publishedSequence: union([version, nullSchema()]),
  theme: union([theme, nullSchema()]),
  domain,
  entry,
  updatedAt: isoUtc,
});

export const EXPERIENCE_BODY_SCHEMAS = {
  ExperienceApplicationsCreateInput: strictObject({ mallId: string() }),
  ExperienceApplicationsCopyInput: strictObject({ targetMallId: string(), reason: string() }),
  ExperienceApplicationsUpdateInput: strictObject({ name: optional(string()), status: optional(literal(['draft', 'active', 'disabled'])) }),
  ExperienceVersionsSaveInput: strictObject({ schemaVersion: union([literal('2'), literal(2)]), configuration: document, reason: string() }),
  ExperienceVersionsValidateInput: strictObject({}),
  ExperienceVersionsPublishInput: strictObject({}),
  ExperienceVersionsRestoreInput: strictObject({ reason: string() }),
} as const;

export const EXPERIENCE_QUERY_SCHEMAS = {
  ExperienceApplicationsReadInput: strictObject({ ...pageQuery, application: optional(string()) }),
  ExperienceApplicationDetailReadInput: strictObject({}),
  ExperiencePublishedReadInput: strictObject({ mall: string(), channel: literal(['web', 'miniapp', 'store']), locale: string() }),
} as const;

export const EXPERIENCE_OUTPUT_SCHEMAS = {
  ExperienceApplicationsCreateOutput: summary,
  ExperienceApplicationsCopyOutput: strictObject({ ...summary.shape, versionId: string() }),
  ExperienceApplicationsReadOutput: pageOutput(summary),
  ExperienceApplicationDetailReadOutput: strictObject({
    ...summary.shape,
    head: union([versionRecord, nullSchema()]),
    published: union([versionRecord, nullSchema()]),
    history: array(history),
  }),
  ExperienceApplicationsUpdateOutput: summary,
  ExperienceVersionsSaveOutput: versionRecord,
  ExperienceVersionsValidateOutput: strictObject({ id: string(), application_id: string(), validation_state: literal(['valid', 'invalid']), issues: array(validationIssue) }),
  ExperienceVersionsPublishOutput: release,
  ExperienceVersionsRestoreOutput: versionRecord,
  ExperiencePublishedReadOutput: strictObject({
    application: string(),
    mall: string(),
    pool: string(),
    release: string(),
    version: string(),
    hash: contentHash,
    document,
    effectiveAt: isoUtc,
    objectKey: string(),
    channel: literal(['web', 'miniapp', 'store']),
    locale: string(),
    etag: string(),
  }),
} as const;
