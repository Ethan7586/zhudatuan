import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { MembershipAccess, Scope } from '@shop/authz';
import { AccessPipeline } from '../../../01_core_hexin/services/commerce/src/foundation/security/AccessPipeline';
import type { NodeContextActor } from '../../../01_core_hexin/services/commerce/src/foundation/security/AccessContext';
import { NodeOperationAvailabilityResolver } from '../../../01_core_hexin/services/commerce/src/foundation/security/OperationAvailability';
import { createPool } from '../../../01_core_hexin/services/commerce/src/foundation/persistence/Pool';
import { PgDecisionSink } from '../../../01_core_hexin/services/commerce/src/modules/access/04_adapters_shixian/persistence/PgDecisionSink';

type Surface = 'page' | 'api' | 'task' | 'service';
type OperationKind = 'read' | 'write';

interface Criteria {
  readonly claim_id: string;
  readonly legacy_trace_id: string;
  readonly dimensions: readonly string[];
  readonly dimension_order: readonly Readonly<{ dimension: string; denial_reason: string }>[];
  readonly node_membership_matrix: readonly NodeSample[];
  readonly operation_matrix: readonly OperationSample[];
  readonly surfaces: readonly Surface[];
  readonly truth_table_threshold: Readonly<{
    row_count: number;
    raw_case_decision_count: number;
  }>;
}

interface NodeSample {
  readonly sample_id: string;
  readonly sovereignty_tier: 'hosted' | 'sovereign';
  readonly node_profile: 'operating_mall' | 'consumer';
  readonly signed_level: `L${number}`;
  readonly membership_client: 'storefront' | 'operator';
}

interface OperationSample {
  readonly kind: OperationKind;
  readonly operation: string;
  readonly permission: string;
  readonly side_effect_contract: string;
}

interface Dimensions {
  readonly feature_declared: boolean;
  readonly permission_allowed: boolean;
  readonly scope_allowed: boolean;
  readonly capability_available: boolean;
  readonly resource_ready: boolean;
}

interface DatabaseClient {
  query(text: string, values?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

interface ProviderCall {
  readonly correlation_id: string;
  readonly sample_id: string;
  readonly operation_kind: OperationKind;
  readonly operation: string;
  readonly provider: string;
  readonly receipt_id: string;
  readonly called_at: string;
}

const surfaceRoutes = new Map<string, Surface>([
  ['/page/probe', 'page'],
  ['/api/probe', 'api'],
  ['/task/probe', 'task'],
  ['/service/probe', 'service'],
]);

export async function executeE03Authorization(
  database: DatabaseClient,
  databaseUrl: string,
  criteria: Criteria,
  runToken: string,
  outputDirectory: string,
) {
  assertCriteria(criteria);
  const principalId = `principal:e03:shared:${runToken}`;
  const contexts = createContexts(criteria, runToken, principalId);
  const expectedRows = createExpectedRows(criteria);
  const providerCalls: ProviderCall[] = [];
  const decisionPool = createPool(databaseUrl, 'api');
  const decisionSink = new PgDecisionSink(decisionPool);

  const fixtureBefore = await snapshotRun(database, runToken);
  await seedReadAssets(database, contexts.samples, runToken);
  const beforeMatrix = await snapshotRun(database, runToken);
  const server = createProbeServer({ database, criteria, contexts, providerCalls, decisionSink, runToken });
  const endpoint = await listen(server);
  const observedRows = [];
  const effectRecords = [];

  try {
    for (const expected of expectedRows) {
      const surfaceObservations = [];
      for (const surface of criteria.surfaces) {
        const cases = [];
        for (const sample of contexts.samples) {
          for (const operation of contexts.operations) {
            const correlationId = correlation(runToken, expected.mask, surface, sample.sample_id, operation.kind);
            const before = await snapshotCorrelation(database, providerCalls, correlationId);
            const requestUrl = new URL(`${endpoint}/${surface}/probe`);
            requestUrl.searchParams.set('sample', sample.sample_id);
            requestUrl.searchParams.set('operation', operation.kind);
            requestUrl.searchParams.set('mask', String(expected.mask));
            requestUrl.searchParams.set('correlation_id', correlationId);
            const response = await fetch(requestUrl, { method: 'POST' });
            const body = await response.json() as Record<string, unknown>;
            const after = await snapshotCorrelation(database, providerCalls, correlationId);
            effectRecords.push(Object.freeze({
              correlation_id: correlationId,
              row_id: expected.row_id,
              surface,
              sample_id: sample.sample_id,
              operation_kind: operation.kind,
              before,
              after,
              delta: effectDelta(before, after),
            }));
            cases.push(Object.freeze({
              correlation_id: correlationId,
              sample_id: sample.sample_id,
              operation_kind: operation.kind,
              request: Object.freeze({
                method: 'POST',
                path: `/${surface}/probe`,
                dimensions: expected.inputs,
              }),
              response: Object.freeze({ http_status: response.status, ...body }),
            }));
          }
        }
        surfaceObservations.push(Object.freeze({ surface, cases: Object.freeze(cases) }));
      }
      observedRows.push(Object.freeze({
        row_id: expected.row_id,
        mask: expected.mask,
        inputs: expected.inputs,
        surfaces: Object.freeze(surfaceObservations),
      }));
    }
  } finally {
    await close(server);
    await decisionPool.end();
  }

  const afterMatrix = await snapshotRun(database, runToken);
  const decisions = (await database.query(`select actor_id,operation,resource_id,scope_id,decision,reason,trace_id,policy_version,decided_at
    from access.decisionaudit where trace_id like $1 order by trace_id`, [`e03:${runToken}:%`])).rows;
  const capturedAt = new Date().toISOString();
  const contextArtifact = Object.freeze({
    schema_version: 'e03-authorization-contexts-v1',
    captured_at: capturedAt,
    engine: 'AccessPipeline + NodeOperationAvailabilityResolver + PgDecisionSink',
    shared_principal_id: principalId,
    samples: contexts.samples,
    operations: contexts.operations,
    surfaces: criteria.surfaces,
  });
  const expectedArtifact = Object.freeze({
    schema_version: 'e03-truth-table-expected-v1',
    captured_at: capturedAt,
    dimensions: criteria.dimensions,
    dimension_order: criteria.dimension_order,
    rows: expectedRows,
  });
  const observedArtifact = Object.freeze({
    schema_version: 'e03-truth-table-observed-v1',
    captured_at: capturedAt,
    transport: Object.freeze({ kind: 'loopback-http', endpoint, routes: Object.fromEntries(surfaceRoutes) }),
    rows: observedRows,
  });
  const effectsArtifact = Object.freeze({
    schema_version: 'e03-side-effect-diffs-v1',
    captured_at: capturedAt,
    direct_sources: Object.freeze([
      'ordering.orderrecord correlation_id',
      'runtime.outbox trace_id',
      "runtime.job payload->>'correlation_id'",
      'separate deterministic Provider call log',
    ]),
    fixture_before: fixtureBefore,
    established_before_matrix: beforeMatrix,
    after_matrix: afterMatrix,
    observations: effectRecords,
  });
  const providerArtifact = Object.freeze({
    schema_version: 'e03-provider-call-log-v1',
    captured_at: capturedAt,
    provider: 'e03-deterministic-trusted-provider',
    real_external_provider_contacted: false,
    calls: providerCalls,
  });

  await Promise.all([
    writeJson(join(outputDirectory, 'authorization-contexts.json'), contextArtifact),
    writeJson(join(outputDirectory, 'truth-table-expected.json'), expectedArtifact),
    writeJson(join(outputDirectory, 'truth-table-observed.json'), observedArtifact),
    writeFile(join(outputDirectory, 'authorization-decisions.jsonl'), decisions.map((entry) => JSON.stringify(entry)).join('\n') + '\n', { flag: 'wx' }),
    writeJson(join(outputDirectory, 'side-effect-diffs.json'), effectsArtifact),
    writeJson(join(outputDirectory, 'provider-call-log.json'), providerArtifact),
  ]);

  return Object.freeze({
    truth_table_row_count: expectedRows.length,
    surface_observation_count: observedRows.length * criteria.surfaces.length,
    raw_case_decision_count: observedRows.length * criteria.surfaces.length * contexts.samples.length * contexts.operations.length,
    decision_audit_count: decisions.length,
    provider_call_count: providerCalls.length,
    run_token: runToken,
  });
}

function createProbeServer(input: {
  database: DatabaseClient;
  criteria: Criteria;
  contexts: ReturnType<typeof createContexts>;
  providerCalls: ProviderCall[];
  decisionSink: PgDecisionSink;
  runToken: string;
}): Server {
  const samples = new Map(input.contexts.samples.map((sample) => [sample.sample_id, sample]));
  const operations = new Map(input.contexts.operations.map((operation) => [operation.kind, operation]));
  return createServer(async (request, response) => {
    try {
      if (request.method !== 'POST') return json(response, 405, { error: 'METHOD_NOT_ALLOWED' });
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const surface = surfaceRoutes.get(url.pathname);
      if (!surface) return json(response, 404, { error: 'ROUTE_NOT_FOUND' });
      const sample = samples.get(requiredQuery(url, 'sample'));
      const operation = operations.get(requiredQuery(url, 'operation') as OperationKind);
      const mask = Number(requiredQuery(url, 'mask'));
      const correlationId = requiredQuery(url, 'correlation_id');
      if (!sample || !operation || !Number.isInteger(mask) || mask < 0 || mask >= 32) {
        return json(response, 400, { error: 'PROBE_INPUT_INVALID' });
      }
      const expectedCorrelation = correlation(input.runToken, mask, surface, sample.sample_id, operation.kind);
      if (correlationId !== expectedCorrelation) return json(response, 400, { error: 'CORRELATION_ID_INVALID' });
      const result = await executeProbe({ ...input, surface, sample, operation, mask, correlationId });
      return json(response, result.available ? 200 : 403, result);
    } catch (cause) {
      return json(response, 500, { available: false, reason: errorCode(cause), error: serializeError(cause) });
    }
  });
}

async function executeProbe(input: {
  database: DatabaseClient;
  criteria: Criteria;
  contexts: ReturnType<typeof createContexts>;
  providerCalls: ProviderCall[];
  decisionSink: PgDecisionSink;
  runToken: string;
  surface: Surface;
  sample: ReturnType<typeof createContexts>['samples'][number];
  operation: ReturnType<typeof createContexts>['operations'][number];
  mask: number;
  correlationId: string;
}) {
  const dimensions = dimensionsForMask(input.criteria, input.mask);
  const scope = input.sample.scope;
  const actor = createActor(input.sample, dimensions);
  const membership: MembershipAccess = Object.freeze({
    id: actor.membership,
    active: true,
    accessVersion: actor.accessVersion,
    denies: Object.freeze([]),
    grants: dimensions.permission_allowed
      ? Object.freeze([Object.freeze({
        scope,
        permissions: Object.freeze([input.operation.permission]),
        effective: '2026-01-01T00:00:00.000Z',
        expires: null,
      })])
      : Object.freeze([]),
  });
  const availability = new NodeOperationAvailabilityResolver({
    async ready() { return dimensions.resource_ready; },
  });
  const pipeline = new AccessPipeline(
    { async resolve() { return actor; } },
    { async resolve() { return membership; } },
    { async resolve() { return actor.accessVersion; } },
    { async resolve() { return dimensions.scope_allowed ? scope : input.sample.denied_scope; } },
    { async resolve() { return dimensions.capability_available ? Object.freeze([input.operation.operation]) : Object.freeze([]); } },
    availability,
    { now: () => new Date('2026-09-14T00:00:00.000Z') },
    { async evaluate() { return Object.freeze({ outcome: 'allow' as const, safeReason: 'policy' as const, decision: null }); } },
    input.decisionSink,
  );

  try {
    await pipeline.authorize({ 'x-trace-id': input.correlationId }, input.operation.operation, input.operation.permission,
      input.sample.asset_id);
  } catch (cause) {
    return Object.freeze({
      schema_version: 'e03-surface-response-v1',
      correlation_id: input.correlationId,
      surface: input.surface,
      sample_id: input.sample.sample_id,
      operation_kind: input.operation.kind,
      available: false,
      reason: errorCode(cause),
      action: Object.freeze({ invoked: false }),
    });
  }

  const action = await executeAllowedAction(input);
  return Object.freeze({
    schema_version: 'e03-surface-response-v1',
    correlation_id: input.correlationId,
    surface: input.surface,
    sample_id: input.sample.sample_id,
    operation_kind: input.operation.kind,
    available: true,
    reason: 'POLICY_ALLOWED',
    action,
  });
}

async function executeAllowedAction(input: {
  database: DatabaseClient;
  providerCalls: ProviderCall[];
  runToken: string;
  surface: Surface;
  sample: ReturnType<typeof createContexts>['samples'][number];
  operation: ReturnType<typeof createContexts>['operations'][number];
  correlationId: string;
}) {
  if (input.surface === 'page') {
    return Object.freeze({ invoked: true, presentation: input.operation.kind === 'read' ? 'visible' : 'actionable' });
  }
  if (input.surface === 'api' && input.operation.kind === 'read') {
    const rows = (await input.database.query(`select id,scope_id,member_id,mall_id,version,evidence
      from ordering.orderrecord where id=$1 and scope_id=$2`, [input.sample.asset_id, input.sample.scope.id])).rows;
    return Object.freeze({ invoked: true, read_row_count: rows.length, rows });
  }
  if (input.surface === 'api') {
    const id = `order:${input.correlationId}`;
    await input.database.query(`insert into ordering.orderrecord(
      id,order_number,scope_id,member_id,mall_id,checkout_id,currency,total_minor,payment_state,
      fulfillment_state,aftersale_state,lifecycle_state,evidence,created_at,updated_at,version,
      correlation_id,operating_node_id,operating_line_id,participant_node_id,participant_membership_id,
      participant_realm_id,participant_account_id,participant_snapshot
    ) values($1,$2,$3,$4,$3,$5,'CNY',0,'unpaid','unallocated','none','created',$6,
      clock_timestamp(),clock_timestamp(),1,$7,$8,$9,$8,$4,$10,$11,$12)`, [
      id,
      `E03-${input.runToken}-${randomUUID()}`,
      input.sample.scope.id,
      input.sample.membership_id,
      `checkout:${input.correlationId}`,
      { fixture: 'E03', operation: input.operation.operation },
      input.correlationId,
      input.sample.node_id,
      input.sample.line_id,
      input.sample.realm_id,
      input.sample.account_id,
      { sample_id: input.sample.sample_id, synthetic: true },
    ]);
    await input.database.query(`insert into runtime.outbox(
      id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at
    ) values($1,'order.placed',1,'ordering.orderrecord',$2,$3,$4,$5,clock_timestamp(),clock_timestamp())`, [
      `outbox:${input.correlationId}`, id, input.sample.scope.id,
      { fixture: 'E03', correlation_id: input.correlationId }, input.correlationId,
    ]);
    return Object.freeze({ invoked: true, business_write_id: id, outbox_id: `outbox:${input.correlationId}` });
  }
  if (input.surface === 'task' && input.operation.kind === 'read') {
    return Object.freeze({ invoked: true, task_execution: 'completed-without-write' });
  }
  if (input.surface === 'task') {
    const id = `job:${input.correlationId}`;
    await input.database.query(`insert into runtime.job(
      id,kind,owner,scope_id,payload,state,available_at,created_at,updated_at
    ) values($1,'e03-authorization-probe','member',$2,$3,'queued',clock_timestamp(),clock_timestamp(),clock_timestamp())`, [
      id, input.sample.scope.id, { fixture: 'E03', correlation_id: input.correlationId },
    ]);
    return Object.freeze({ invoked: true, task_enqueue_id: id });
  }
  const call = Object.freeze({
    correlation_id: input.correlationId,
    sample_id: input.sample.sample_id,
    operation_kind: input.operation.kind,
    operation: input.operation.operation,
    provider: 'e03-deterministic-trusted-provider',
    receipt_id: `provider-receipt:${input.correlationId}`,
    called_at: new Date().toISOString(),
  });
  input.providerCalls.push(call);
  return Object.freeze({ invoked: true, provider: call.provider, receipt_id: call.receipt_id });
}

function createContexts(criteria: Criteria, runToken: string, principalId: string) {
  const samples = criteria.node_membership_matrix.map((entry, index) => {
    const scope: Scope = Object.freeze({ kind: 'owner', id: `member:e03:${runToken}:${index + 1}`, path: Object.freeze([]) });
    const deniedScope: Scope = Object.freeze({ kind: 'owner', id: `member:e03:denied:${runToken}:${index + 1}`, path: Object.freeze([]) });
    return Object.freeze({
      ...entry,
      principal_id: principalId,
      account_id: `account:e03:${runToken}:${index + 1}`,
      realm_id: `realm:e03:${runToken}:${index + 1}`,
      membership_id: `membership:e03:${runToken}:${index + 1}`,
      node_id: `node:e03:${entry.sample_id}:${runToken}`,
      line_id: `line:e03:${entry.sample_id}:${runToken}`,
      host_sovereign_node_id: entry.sovereignty_tier === 'sovereign'
        ? `node:e03:${entry.sample_id}:${runToken}`
        : `node:e03:host:${runToken}`,
      scope,
      denied_scope: deniedScope,
      asset_id: `order:e03:${runToken}:read:${entry.sample_id}`,
    });
  });
  return Object.freeze({
    shared_principal_id: principalId,
    samples: Object.freeze(samples),
    operations: Object.freeze(criteria.operation_matrix.map((entry) => Object.freeze({ ...entry }))),
  });
}

function createActor(sample: ReturnType<typeof createContexts>['samples'][number], dimensions: Dimensions): NodeContextActor {
  const nodeId = sample.node_id;
  return Object.freeze({
    id: sample.principal_id,
    account: sample.account_id,
    realm: sample.realm_id,
    membershipClient: sample.membership_client,
    governanceOrganization: `organization:${sample.sample_id}:${sample.membership_id}`,
    nodeContext: Object.freeze({
      host: `${sample.sample_id}.e03.invalid`,
      surface: 'storefront',
      line_id: sample.line_id,
      node_id: nodeId,
      parent_node_id: sample.sovereignty_tier === 'sovereign' ? null : sample.host_sovereign_node_id,
      signed_level: sample.signed_level,
      node_profile: sample.node_profile,
      mall_id: sample.node_profile === 'operating_mall' ? `mall:${sample.sample_id}` : null,
      host_node_id: sample.sovereignty_tier === 'sovereign' ? null : sample.host_sovereign_node_id,
      host_binding: Object.freeze({ host: `${sample.sample_id}.e03.invalid`, binding_ref: { ref: 'binding:e03', version: '1' }, application_ref: 'application:e03', surface_ref: 'surface:storefront' }),
      scope: Object.freeze({ ref: sample.scope.id, version: '1' }),
      realm: Object.freeze({ ref: sample.realm_id, version: '1' }),
      manifest_digest: `sha256:${'0'.repeat(64)}`,
      manifest: Object.freeze({
        lifecycle_status: 'active',
        enabled_features: dimensions.feature_declared
          ? Object.freeze([Object.freeze({ ref: 'feature:identity', version: '1' })])
          : Object.freeze([]),
        resource_binding_set_ref: Object.freeze({ ref: `resource-binding:${nodeId}`, version: '1' }),
        runtime_config_ref: Object.freeze({ ref: `runtime:${nodeId}`, version: '1' }),
        release_pointer_ref: Object.freeze({ ref: `/e03/${nodeId}/current`, version: '1' }),
      }),
    } as never),
    session: `session:e03:${sample.sample_id}`,
    membership: sample.membership_id,
    credentialVersion: 1,
    accessVersion: 1,
    target: 'storefront',
    assurance: Object.freeze({ level: 1 }),
  });
}

async function seedReadAssets(database: DatabaseClient, samples: ReturnType<typeof createContexts>['samples'], runToken: string) {
  for (const sample of samples) {
    await database.query(`insert into ordering.orderrecord(
      id,order_number,scope_id,member_id,mall_id,checkout_id,currency,total_minor,payment_state,
      fulfillment_state,aftersale_state,lifecycle_state,evidence,created_at,updated_at,version,
      correlation_id,operating_node_id,operating_line_id,participant_node_id,participant_membership_id,
      participant_realm_id,participant_account_id,participant_snapshot
    ) values($1,$2,$3,$4,$3,$5,'CNY',0,'unpaid','unallocated','none','created',$6,
      clock_timestamp(),clock_timestamp(),1,$7,$8,$9,$8,$4,$10,$11,$12)`, [
      sample.asset_id,
      `E03-READ-${runToken}-${sample.sample_id}`,
      sample.scope.id,
      sample.membership_id,
      `checkout:e03:${runToken}:read:${sample.sample_id}`,
      { fixture: 'E03', purpose: 'side-effect-free-read' },
      `e03:${runToken}:fixture:${sample.sample_id}`,
      sample.node_id,
      sample.line_id,
      sample.realm_id,
      sample.account_id,
      { sample_id: sample.sample_id, synthetic: true },
    ]);
  }
}

function createExpectedRows(criteria: Criteria) {
  return Object.freeze(Array.from({ length: 32 }, (_, mask) => {
    const inputs = dimensionsForMask(criteria, mask);
    const expectedAllowed = Object.values(inputs).every(Boolean);
    const unmet = criteria.dimension_order.find((entry) => !inputs[entry.dimension as keyof Dimensions]);
    return Object.freeze({
      row_id: `TT-${String(mask).padStart(2, '0')}`,
      mask,
      inputs,
      expected_allowed: expectedAllowed,
      expected_reason: expectedAllowed ? 'POLICY_ALLOWED' : unmet?.denial_reason ?? 'AUTHORIZATION_FAILED',
    });
  }));
}

function dimensionsForMask(criteria: Criteria, mask: number): Dimensions {
  const values = Object.fromEntries(criteria.dimensions.map((dimension, index) => [dimension, Boolean(mask & (1 << index))]));
  return Object.freeze(values) as unknown as Dimensions;
}

async function snapshotCorrelation(database: DatabaseClient, providerCalls: readonly ProviderCall[], correlationId: string) {
  const [business, outbox, tasks, decisions] = await Promise.all([
    database.query(`select id,scope_id,member_id,mall_id,version,correlation_id,evidence
      from ordering.orderrecord where correlation_id=$1 order by id`, [correlationId]),
    database.query(`select id,event_type,aggregate_type,aggregate_id,scope_id,trace_id,payload
      from runtime.outbox where trace_id=$1 order by id`, [correlationId]),
    database.query(`select id,kind,owner,scope_id,state,payload
      from runtime.job where payload->>'correlation_id'=$1 order by id`, [correlationId]),
    database.query(`select actor_id,operation,scope_id,decision,reason,trace_id
      from access.decisionaudit where trace_id=$1 order by id`, [correlationId]),
  ]);
  return Object.freeze({
    business_rows: business.rows,
    outbox_rows: outbox.rows,
    task_rows: tasks.rows,
    decision_rows: decisions.rows,
    provider_calls: providerCalls.filter((entry) => entry.correlation_id === correlationId),
  });
}

function effectDelta(before: Awaited<ReturnType<typeof snapshotCorrelation>>, after: Awaited<ReturnType<typeof snapshotCorrelation>>) {
  return Object.freeze({
    business_write_count: after.business_rows.length - before.business_rows.length,
    outbox_append_count: after.outbox_rows.length - before.outbox_rows.length,
    task_enqueue_count: after.task_rows.length - before.task_rows.length,
    decision_append_count: after.decision_rows.length - before.decision_rows.length,
    provider_call_count: after.provider_calls.length - before.provider_calls.length,
  });
}

async function snapshotRun(database: DatabaseClient, runToken: string) {
  const [business, outbox, tasks, decisions] = await Promise.all([
    database.query(`select id,scope_id,member_id,mall_id,version,correlation_id,evidence
      from ordering.orderrecord where id like $1 order by id`, [`order:e03:${runToken}:%`]),
    database.query(`select id,event_type,aggregate_type,aggregate_id,scope_id,trace_id,payload
      from runtime.outbox where trace_id like $1 order by id`, [`e03:${runToken}:%`]),
    database.query(`select id,kind,owner,scope_id,state,payload
      from runtime.job where payload->>'correlation_id' like $1 order by id`, [`e03:${runToken}:%`]),
    database.query(`select actor_id,operation,scope_id,decision,reason,trace_id
      from access.decisionaudit where trace_id like $1 order by trace_id`, [`e03:${runToken}:%`]),
  ]);
  return Object.freeze({ business_rows: business.rows, outbox_rows: outbox.rows, task_rows: tasks.rows, decision_rows: decisions.rows });
}

function correlation(runToken: string, mask: number, surface: Surface, sampleId: string, operationKind: OperationKind): string {
  return `e03:${runToken}:tt-${String(mask).padStart(2, '0')}:${surface}:${sampleId}:${operationKind}`;
}

function assertCriteria(criteria: Criteria): void {
  if (criteria.claim_id !== 'E2-AUTH-001' || criteria.legacy_trace_id !== 'E03') throw new Error('E03_CRITERIA_IDENTITY_INVALID');
  if (criteria.dimensions.length !== 5 || criteria.truth_table_threshold.row_count !== 32
    || criteria.node_membership_matrix.length !== 3 || criteria.operation_matrix.length !== 2
    || criteria.surfaces.length !== 4 || criteria.truth_table_threshold.raw_case_decision_count !== 768) {
    throw new Error('E03_CRITERIA_MATRIX_INVALID');
  }
}

function requiredQuery(url: URL, name: string): string {
  const value = url.searchParams.get(name);
  if (!value) throw new Error(`${name.toUpperCase()}_MISSING`);
  return value;
}

function errorCode(cause: unknown): string {
  if (typeof cause === 'object' && cause !== null && 'code' in cause && typeof cause.code === 'string') return cause.code;
  return cause instanceof Error ? cause.message : 'AUTHORIZATION_FAILED';
}

function serializeError(cause: unknown) {
  return cause instanceof Error
    ? Object.freeze({ name: cause.name, message: cause.message })
    : Object.freeze({ name: 'UnknownError', message: String(cause) });
}

function json(response: import('node:http').ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(`${JSON.stringify(body)}\n`);
}

function listen(server: Server): Promise<string> {
  return new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('E03_HTTP_ADDRESS_INVALID'));
      resolveListen(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
}

function writeJson(path: string, value: unknown) {
  return writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}
