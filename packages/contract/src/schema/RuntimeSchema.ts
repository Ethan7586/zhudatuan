import { array, boolean, int, literal, null as nullSchema, number, optional, positive, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, pageOutput, pageQuery, unsigned, version } from './Primitives';
import { RUNTIME_IMPORT_OWNERS, RUNTIME_TASK_STATES, RUNTIME_TASK_TYPES } from '../Vocabulary';

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
const taskType = literal(RUNTIME_TASK_TYPES);
const taskState = literal(RUNTIME_TASK_STATES);
const task = strictObject({
  id: string(), type: taskType, owner: string(), kind: string(), title: string(), state: taskState,
  processed: unsigned, total: unsigned, succeeded: unsigned, failed: unsigned, retryableItems: unsigned,
  cancellable: boolean(), retryable: boolean(), version, createdAt: isoUtc, updatedAt: isoUtc,
  expiresAt: union([isoUtc, nullSchema()]), fileName: union([string(), nullSchema()]), downloadAvailable: boolean(),
  confirmationRequired: boolean(), previewHash: union([string(), nullSchema()]), columns: array(string()), validationErrors: unsigned,
});
const upload = strictObject({ url: string(), method: literal('PUT'), headers: record(string(), string()), expiresAt: isoUtc });

export const RUNTIME_QUERY_SCHEMAS = {
  RuntimeHealthLiveInput: strictObject({}),
  RuntimeHealthReadyInput: strictObject({}),
  RuntimeHealthStartupInput: strictObject({}),
  RuntimeHealthDependencyInput: strictObject({}),
  RuntimeJobsReadInput: strictObject({ ...pageQuery, type: optional(taskType), state: optional(taskState), owner: optional(string()) }),
  RuntimeImportsReadInput: strictObject({}),
  RuntimeExportsReadInput: strictObject({}),
} as const;

export const RUNTIME_BODY_SCHEMAS = {
  RuntimeJobsCancelInput: strictObject({ reason: string() }),
  RuntimeUploadsCreateInput: strictObject({ name: string(), contentType: literal(['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']), size: int().check(positive()), sha256: string() }),
  RuntimeImportsCreateInput: strictObject({ owner: literal(RUNTIME_IMPORT_OWNERS), kind: string(), objectRef: string(), sha256: string(), fileName: string(), metadata: optional(record(string(), ContractJsonValueSchema)) }),
  RuntimeImportsConfirmInput: strictObject({ previewHash: string() }),
  RuntimeImportsRetryInput: strictObject({ reason: string() }),
  RuntimeExportsCancelInput: strictObject({ reason: string() }),
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
  RuntimeJobsReadOutput: pageOutput(task),
  RuntimeJobsCancelOutput: task,
  RuntimeUploadsCreateOutput: strictObject({ reference: string(), path: string(), sha256: string(), size: unsigned, contentType: string(), retentionUntil: isoUtc, upload }),
  RuntimeImportsCreateOutput: task,
  RuntimeImportsReadOutput: task,
  RuntimeImportsConfirmOutput: task,
  RuntimeImportsRetryOutput: task,
  RuntimeExportsReadOutput: task,
  RuntimeExportsCancelOutput: task,
} as const;
