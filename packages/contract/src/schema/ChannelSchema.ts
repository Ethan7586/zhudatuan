import { array, literal, null as nullSchema, number, optional, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, pageOutput, pageQuery, unsigned, version } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const nullableTime = union([isoUtc, nullSchema()]);
const jsonObject = record(string(), ContractJsonValueSchema);
const distributorState = literal(['draft', 'active', 'suspended', 'terminated']);
const distributor = strictObject({ id: string(), organization_id: string(), code: string(), name: string(), settlement_mode: string(), metadata: jsonObject, status: distributorState, created_at: isoUtc, updated_at: isoUtc });
const distributorRead = strictObject({ ...distributor.shape, tenant_count: unsigned });
const binding = strictObject({
  id: string(),
  distributor_id: string(),
  tenant_id: string(),
  state: literal(['draft', 'active', 'expired', 'terminated']),
  evidence: jsonObject,
  effective_at: isoUtc,
  expires_at: nullableTime,
  created_at: isoUtc,
  updated_at: isoUtc,
});
const quota = strictObject({ id: string(), scopeId: string(), capabilityId: string(), state: literal(['enabled', 'disabled']), quota: union([unsigned, nullSchema()]), effectiveAt: isoUtc, expiresAt: nullableTime, version });
const connectionState = literal(['draft', 'testing', 'enabled', 'degraded', 'disabled']);
const connectionControl = strictObject({
  id: string(),
  provider: string(),
  scope_id: string(),
  status: connectionState,
  region: string(),
  connection_timeout_ms: unsigned,
  response_timeout_ms: unsigned,
  total_deadline_ms: unsigned,
  max_concurrency: unsigned,
  requests_per_second: number(),
  max_attempts: unsigned,
  failure_threshold: unsigned,
  recovery_ms: unsigned,
  version,
});
const connection = strictObject({
  ...connectionControl.shape,
  contract_version: string(),
  created_at: isoUtc,
  updated_at: isoUtc,
  has_secret: literal([true, false]),
  capabilities: optional(array(string())),
  health_state: optional(union([literal(['healthy', 'degraded', 'unhealthy']), nullSchema()])),
  health_latency_ms: optional(union([unsigned, nullSchema()])),
  health_reason: optional(nullableText),
  checked_at: optional(nullableTime),
});
const sync = strictObject({
  id: string(),
  connection_id: string(),
  kind: literal(['catalog', 'price', 'stock', 'statement']),
  state: literal(['queued', 'running', 'completed', 'failed', 'cancelled']),
  cursor_value: nullableText,
  input_hash: string(),
  input: jsonObject,
  error_summary: array(ContractJsonValueSchema),
  watermark: nullableTime,
  pulled_count: unsigned,
  accepted_count: unsigned,
  rejected_count: unsigned,
  started_at: nullableTime,
  completed_at: nullableTime,
  version,
});
const providerOperation = strictObject({
  id: string(),
  provider: string(),
  kind: string(),
  internal_reference: string(),
  external_reference: nullableText,
  state: literal(['queued', 'submitted', 'processing', 'succeeded', 'failed', 'unknown']),
  response: union([ContractJsonValueSchema, nullSchema()]),
  created_at: isoUtc,
  updated_at: isoUtc,
});

export const CHANNEL_BODY_SCHEMAS = {
  ChannelDistributorsCreateInput: strictObject({ code: string(), name: string(), contact: optional(nullableText), timezone: optional(string()), settlementMode: string(), metadata: optional(jsonObject) }),
  ChannelDistributorsUpdateInput: strictObject({ name: optional(string()), contact: optional(nullableText), settlementMode: optional(string()), metadata: optional(jsonObject) }),
  ChannelDistributorsDisableInput: strictObject({}),
  ChannelBindingsManageInput: strictObject({
    distributor: string(),
    tenant: string(),
    state: literal(['draft', 'active', 'expired', 'terminated']),
    evidence: optional(jsonObject),
    effectiveAt: optional(isoUtc),
    expiresAt: optional(nullableTime),
  }),
  ChannelQuotasManageInput: strictObject({ capability: string(), state: literal(['enabled', 'disabled']), quota: union([unsigned, nullSchema()]), expiresAt: optional(nullableTime) }),
  ChannelConnectionsCreateInput: strictObject({ provider: string(), configuration: jsonObject, secretRef: optional(nullableText) }),
  ChannelConnectionsUpdateInput: strictObject({ provider: string(), configuration: jsonObject, secretRef: optional(nullableText) }),
  ChannelConnectionsTestInput: strictObject({}),
  ChannelConnectionsEnableInput: strictObject({}),
  ChannelConnectionsDisableInput: strictObject({}),
  ChannelWebhooksReceiveInput: strictObject({}),
  ChannelSyncrunsStartInput: strictObject({
    connection: string(),
    kind: literal(['catalog', 'price', 'stock', 'statement']),
    cursor: optional(nullableText),
    start: optional(string()),
    end: optional(string()),
    timezone: optional(string()),
    partner: optional(string()),
  }),
  ChannelSyncrunsCancelInput: strictObject({}),
  ChannelOperationsReplayInput: strictObject({}),
} as const;

export const CHANNEL_QUERY_SCHEMAS = {
  ChannelDistributorsReadInput: strictObject(pageQuery),
  ChannelConnectionsReadInput: strictObject(pageQuery),
  ChannelSyncrunsReadInput: strictObject(pageQuery),
  ChannelOperationsReadInput: strictObject(pageQuery),
} as const;

export const CHANNEL_OUTPUT_SCHEMAS = {
  ChannelDistributorsCreateOutput: distributor,
  ChannelDistributorsReadOutput: pageOutput(distributorRead),
  ChannelDistributorsUpdateOutput: distributor,
  ChannelDistributorsDisableOutput: distributor,
  ChannelBindingsManageOutput: binding,
  ChannelQuotasManageOutput: quota,
  ChannelConnectionsReadOutput: pageOutput(connection),
  ChannelConnectionsCreateOutput: connection,
  ChannelConnectionsUpdateOutput: connection,
  ChannelConnectionsTestOutput: strictObject({ ...connectionControl.shape, state: literal('testing') }),
  ChannelConnectionsEnableOutput: connectionControl,
  ChannelConnectionsDisableOutput: connectionControl,
  ChannelWebhooksReceiveOutput: strictObject({ webhook: string(), state: string(), replayed: literal([true, false]) }),
  ChannelSyncrunsStartOutput: sync,
  ChannelSyncrunsReadOutput: pageOutput(strictObject({ ...sync.shape, cursor_sort: string() })),
  ChannelSyncrunsCancelOutput: sync,
  ChannelOperationsReadOutput: pageOutput(providerOperation),
  ChannelOperationsReplayOutput: strictObject({ operation: string(), state: literal('queued') }),
} as const;
