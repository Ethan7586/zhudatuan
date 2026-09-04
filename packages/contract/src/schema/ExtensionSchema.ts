import { array, literal, null as nullSchema, number, strictObject, string, union } from 'zod/mini';
import { PROVIDER_CAPABILITIES } from '../provider/Capability';
import { isoUtc, pageOutput, pageQuery, unsigned, version } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const nullableTime = union([isoUtc, nullSchema()]);
const dependency = strictObject({ id: string(), version: string(), capabilities: array(literal(PROVIDER_CAPABILITIES)) });
const manifest = strictObject({
  id: string(),
  name: string(),
  kind: literal('channel'),
  version: string(),
  apiVersion: string(),
  contractVersion: string(),
  dependencies: array(dependency),
  healthOperation: string(),
  capabilities: array(literal(PROVIDER_CAPABILITIES)),
  permissions: array(string()),
  configSchema: string(),
  eventSubscriptions: array(string()),
  secretRefs: array(string()),
  sandbox: strictObject({ supported: literal(true), mode: literal(['endpoint', 'local']), endpointRef: nullableText }),
  rateLimits: strictObject({ requestsPerSecond: number(), maxConcurrency: unsigned }),
  timeout: strictObject({ connectionMs: unsigned, responseMs: unsigned, totalMs: unsigned }),
  retryPolicy: strictObject({ maxAttempts: unsigned }),
  circuitPolicy: strictObject({ failureThreshold: unsigned, recoveryMs: unsigned }),
  webhookContract: nullableText,
  signature: string(),
});
const installation = strictObject({
  id: string(),
  extension_id: string(),
  extension_version: string(),
  scope_id: string(),
  status: literal(['disabled', 'testing', 'enabled', 'degraded']),
  manifest,
  configuration_version: version,
  version,
  installed_at: isoUtc,
  health_state: union([literal(['healthy', 'degraded', 'unavailable']), nullSchema()]),
  health_latency_ms: union([unsigned, nullSchema()]),
  health_reason: nullableText,
  checked_at: nullableTime,
});
export const EXTENSION_QUERY_SCHEMAS = { ExtensionInstallationsReadInput: strictObject(pageQuery) } as const;
export const EXTENSION_OUTPUT_SCHEMAS = { ExtensionInstallationsReadOutput: pageOutput(installation) } as const;
