import { array, literal, null as nullSchema, optional, strictObject, string, union } from 'zod/mini';
import { isoUtc, pageQuery, unsigned } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const scope = strictObject({ kind: string(), id: string(), tenant: optional(string()), path: array(strictObject({ kind: string(), id: string() })) });
const error = strictObject({
  scope,
  surface: literal(['console', 'storefront', 'auth']),
  route: string(),
  message: string(),
  stack: nullableText,
  componentStack: nullableText,
  traceId: string(),
  actorId: string(),
  membershipId: string(),
  fingerprint: string(),
  faultCode: string(),
  occurrences: unsigned,
  firstSeenAt: isoUtc,
  lastSeenAt: isoUtc,
});
export const OBSERVABILITY_BODY_SCHEMAS = {
  ObservabilityClienterrorsCreateInput: strictObject({ surface: literal(['console', 'storefront', 'auth']), route: string(), message: string(), stack: optional(nullableText), componentStack: optional(nullableText) }),
} as const;
export const OBSERVABILITY_QUERY_SCHEMAS = { ObservabilityClienterrorsReadInput: strictObject(pageQuery) } as const;
export const OBSERVABILITY_OUTPUT_SCHEMAS = {
  ObservabilityClienterrorsCreateOutput: strictObject({ faultCode: string(), fingerprint: string(), occurrences: unsigned }),
  ObservabilityClienterrorsReadOutput: strictObject({ items: array(error), count: unsigned }),
} as const;
