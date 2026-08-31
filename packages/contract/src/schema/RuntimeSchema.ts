import { array, boolean, literal, number, optional, strictObject, string } from 'zod/mini';

const checksum = strictObject({ checksum: string(), matches: boolean() });
const migration = strictObject({ head: string(), matches: boolean() });
const registries = strictObject({ operations: number(), events: number(), jobs: number(), checksum: string() });
const database = strictObject({
  writable: boolean(),
  migration: boolean(),
  contract: boolean(),
  role: boolean(),
  operations: number(),
  capabilities: number(),
  events: number(),
  invitationKeys: boolean(),
});
const extensions = strictObject({ registered: number(), healthy: number(), unhealthy: number(), checksum: string() });
const readiness = {
  healthy: boolean(),
  condition: literal(['ready', 'degraded', 'notready']),
  degraded: array(string()),
  configuration: checksum,
  contract: checksum,
  migration,
  registries,
  database,
  extensions,
} as const;
const queryMetric = strictObject({ workload: literal(['query', 'command', 'worker', 'migration']), count: number(), failures: number(), totalMilliseconds: number(), maximumMilliseconds: number() });

export const RUNTIME_QUERY_SCHEMAS = {
  RuntimeHealthLiveInput: strictObject({}),
  RuntimeHealthReadyInput: strictObject({}),
  RuntimeHealthStartupInput: strictObject({}),
  RuntimeHealthDependencyInput: strictObject({}),
} as const;

export const RUNTIME_OUTPUT_SCHEMAS = {
  RuntimeHealthLiveOutput: strictObject({ status: literal('live'), eventLoop: literal('responsive') }),
  RuntimeHealthReadyOutput: strictObject({ status: literal(['ready', 'unready']), ...readiness }),
  RuntimeHealthStartupOutput: strictObject({ status: literal(['started', 'blocked']), ...readiness }),
  RuntimeHealthDependencyOutput: strictObject({
    status: literal(['available', 'degraded']),
    queue: strictObject({ queued: number(), running: number(), deadletters: number(), oldest_seconds: number() }),
    cache: strictObject({ available: boolean(), reason: optional(string()) }),
    databaseQueries: array(queryMetric),
    readiness: strictObject(readiness),
  }),
} as const;
