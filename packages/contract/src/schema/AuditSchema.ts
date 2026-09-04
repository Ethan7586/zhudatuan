import { array, literal, null as nullSchema, optional, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, pageQuery, unsigned } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const item = strictObject({
  id: string(),
  kind: literal(['command', 'access', 'archive']),
  scope_id: string(),
  actor_id: nullableText,
  actor_type: string(),
  request_id: nullableText,
  operation: string(),
  subject_type: string(),
  subject_id: nullableText,
  object_type: string(),
  object_id: nullableText,
  outcome: literal(['succeeded', 'rejected', 'failed']),
  reason: string(),
  before_hash: nullableText,
  after_hash: nullableText,
  evidence: ContractJsonValueSchema,
  trace_id: nullableText,
  previous_hash: nullableText,
  record_hash: string(),
  occurred_at: isoUtc,
});
export const AUDIT_QUERY_SCHEMAS = { AuditRecordsReadInput: strictObject({ ...pageQuery, detail: optional(literal(['summary', 'evidence'])) }) } as const;
export const AUDIT_OUTPUT_SCHEMAS = { AuditRecordsReadOutput: strictObject({ items: array(item), count: unsigned, next: nullableText, watermark: isoUtc, detail: literal(['summary', 'evidence']) }) } as const;
