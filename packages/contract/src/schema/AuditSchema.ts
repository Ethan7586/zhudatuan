import { array, literal, null as nullSchema, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, pageQuery, unsigned } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const item = strictObject({
  id: string(),
  kind: literal(['command', 'access', 'archive']),
  scope_id: string(),
  actor_id: nullableText,
  actor_type: string(),
  action: string(),
  resource_type: string(),
  resource_id: nullableText,
  before_hash: nullableText,
  after_hash: nullableText,
  evidence: ContractJsonValueSchema,
  trace_id: string(),
  previous_hash: nullableText,
  record_hash: string(),
  occurred_at: isoUtc,
});
export const AUDIT_QUERY_SCHEMAS = { AuditRecordsReadInput: strictObject(pageQuery) } as const;
export const AUDIT_OUTPUT_SCHEMAS = { AuditRecordsReadOutput: strictObject({ items: array(item), count: unsigned, next: nullableText }) } as const;
