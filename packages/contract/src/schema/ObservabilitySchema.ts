import { array, literal, null as nullSchema, number, optional, strictObject, string, union } from 'zod/mini';
import { isoUtc, pageQuery, unsigned } from './Primitives';
import { CLIENT_SURFACES } from '../Surface';

const nullableText = union([string(), nullSchema()]);
const nullableNumber = union([number(), nullSchema()]);
const scope = strictObject({ kind: string(), id: string(), tenant: optional(string()), path: array(strictObject({ kind: string(), id: string() })) });
const error = strictObject({
  scope,
  surface: literal(CLIENT_SURFACES),
  route: string(),
  operation: nullableText,
  release: string(),
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
  ObservabilityClienterrorsCreateInput: strictObject({ surface: literal(CLIENT_SURFACES), route: string(), operation: optional(nullableText), release: string(), message: string(), stack: optional(nullableText), componentStack: optional(nullableText) }),
} as const;
export const OBSERVABILITY_QUERY_SCHEMAS = {
  ObservabilityClienterrorsReadInput: strictObject(pageQuery),
  ObservabilityHealthoverviewReadInput: strictObject({}),
  ObservabilitySloReadInput: strictObject({}),
} as const;
export const OBSERVABILITY_OUTPUT_SCHEMAS = {
  ObservabilityClienterrorsCreateOutput: strictObject({ faultCode: string(), fingerprint: string(), occurrences: unsigned }),
  ObservabilityClienterrorsReadOutput: strictObject({ items: array(error), count: unsigned }),
  ObservabilityHealthoverviewReadOutput: strictObject({
    generatedAt: isoUtc,
    condition: literal(['healthy', 'degraded']),
    degraded: array(string()),
    dependencies: array(strictObject({ name: string(), state: literal(['healthy', 'unhealthy']), durationMs: number(), observedAt: isoUtc, traceId: nullableText })),
    queues: array(strictObject({ name: string(), state: literal(['idle', 'active', 'backlogged']), depth: unsigned, observedAt: isoUtc })),
    providers: array(strictObject({ name: string(), state: literal(['healthy', 'degraded']), operation: nullableText, observedAt: isoUtc, traceId: nullableText })),
    serviceLevels: strictObject({ healthy: unsigned, atRisk: unsigned, breaching: unsigned, noData: unsigned }),
    release: strictObject({ version: string(), contract: string(), configuration: string(), schema: string(), startedAt: isoUtc }),
  }),
  ObservabilitySloReadOutput: strictObject({
    generatedAt: isoUtc,
    windowSeconds: unsigned,
    items: array(strictObject({ id: string(), title: string(), indicator: string(), owner: string(), target: number(), current: nullableNumber, unit: literal(['percent', 'milliseconds', 'seconds']), windowSeconds: unsigned, severity: literal(['warning', 'critical']), runbook: string(), status: literal(['healthy', 'atrisk', 'breaching', 'nodata']), burnRate: nullableNumber, errorBudgetRemainingPercent: nullableNumber, total: unsigned })),
    count: unsigned,
  }),
} as const;
