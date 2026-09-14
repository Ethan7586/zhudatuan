import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { OperationCatalog, type OperationId } from '@shop/contract';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import { ExecutionKernel, currentWriteTx, operationRequestHash } from '../../../01_core_hexin/services/commerce/src/foundation/application/ExecutionKernel.ts';
import { appendOperationAudit } from '../../../01_core_hexin/services/commerce/src/foundation/application/ModuleOperations.ts';
import type { OperationRequest, OperationResult } from '../../../01_core_hexin/services/commerce/src/foundation/application/OperationHandler.ts';
import { TransactionRunner } from '../../../01_core_hexin/services/commerce/src/foundation/application/TransactionRunner.ts';
import { PgUnitOfWork } from '../../../01_core_hexin/services/commerce/src/foundation/infrastructure/PgUnitOfWork.ts';
import type { DatabasePool } from '../../../01_core_hexin/services/commerce/src/foundation/persistence/Pool.ts';
import type { DatabaseWorkload } from '../../../01_core_hexin/services/commerce/src/foundation/persistence/QueryMetrics.ts';
import type { AccessContext } from '../../../01_core_hexin/services/commerce/src/foundation/security/AccessContext.ts';
import { RecordAudit } from '../../../01_core_hexin/services/commerce/src/modules/audit/03_application_yingyong/command/RecordAudit.ts';
import { PgAuditRepository } from '../../../01_core_hexin/services/commerce/src/modules/audit/04_adapters_shixian/persistence/PgAuditRepository.ts';

interface CriteriaNode {
  readonly node_id: string;
  readonly label: string;
  readonly sovereignty_tier: 'hosted' | 'sovereign';
}

interface CriteriaOperation {
  readonly label: string;
  readonly operation_id: OperationId;
  readonly business_fact_kind: string;
}

interface Criteria {
  readonly criteria_id: string;
  readonly node_matrix: readonly CriteriaNode[];
  readonly operation_matrix: readonly CriteriaOperation[];
  readonly concurrency: number;
  readonly interruption_points: readonly InterruptionPoint[];
  readonly target_recovery_node: string;
}

type InterruptionPoint = 'after_identity' | 'after_configuration' | 'after_outbox' | 'during_provider_apply';

interface Scenario {
  readonly scenario_id: string;
  readonly case_kind: 'five_way' | 'interruption' | 'isolation';
  readonly node: CriteriaNode;
  readonly operation: CriteriaOperation;
  readonly idempotency_key: string;
}

interface ExecutionOptions {
  readonly interrupt_at?: Exclude<InterruptionPoint, 'during_provider_apply'>;
}

interface ScenarioSnapshot {
  readonly idempotency: readonly Record<string, unknown>[];
  readonly business_facts: readonly Record<string, unknown>[];
  readonly checkpoints: readonly Record<string, unknown>[];
  readonly runtime_outbox: readonly Record<string, unknown>[];
  readonly audit_records: readonly Record<string, unknown>[];
  readonly provider_commands: readonly Record<string, unknown>[];
  readonly provider_resources: readonly Record<string, unknown>[];
  readonly provider_receipts: readonly Record<string, unknown>[];
  readonly provider_attempts: readonly Record<string, unknown>[];
}

const databaseUrl = option('--database-url');
const criteriaPath = resolve(option('--criteria'));
const outputDirectory = resolve(option('--output-directory'));
const criteria = JSON.parse(await readFile(criteriaPath, 'utf8')) as Criteria;
assertCriteria(criteria);

const postgres = new Pool({ connectionString: databaseUrl, max: 30, connectionTimeoutMillis: 5_000, statement_timeout: 120_000 });
const databasePool = fixtureDatabasePool(postgres);
const transaction = new TransactionRunner(new PgUnitOfWork(databasePool));
const audit = new RecordAudit(new PgAuditRepository());
const kernel = new ExecutionKernel(audit, appendOperationAudit);
const actionExecutions = new Map<string, number>();

try {
  await createFixtureSchema(postgres);
  const fiveWayResults = [];
  const conflictResults = [];
  const interruptionDiffs = [];
  const recoveryReceipts = [];

  for (const node of criteria.node_matrix) {
    for (const operation of criteria.operation_matrix) {
      const scenario = makeScenario('five_way', node, operation);
      const acceptedRequest = requestFor(scenario, 'accepted');
      const acceptedHash = operationRequestHash(acceptedRequest);
      const requests = Array.from({ length: criteria.concurrency }, (_, index) => ({ index: index + 1, request: requestFor(scenario, 'accepted') }));
      const responses = await Promise.all(requests.map(({ request }) => executeScenario(scenario, request)));
      const provider = await applyProvider(scenario, false);
      const snapshot = await snapshotScenario(postgres, scenario);
      fiveWayResults.push(Object.freeze({
        scenario_id: scenario.scenario_id,
        node_id: node.node_id,
        node_label: node.label,
        sovereignty_tier: node.sovereignty_tier,
        operation_id: operation.operation_id,
        operation_label: operation.label,
        business_fact_kind: operation.business_fact_kind,
        idempotency_key: scenario.idempotency_key,
        request_hash: acceptedHash,
        deliveries: responses.map((response, index) => Object.freeze({
          delivery: index + 1,
          idempotency_key: scenario.idempotency_key,
          request_hash: operationRequestHash(requests[index]!.request),
          response_status: response.status,
          response_business_number: response.headers?.['x-business-number'] ?? null,
          response_body_sha256: digest(canonical(response.body ?? null)),
        })),
        action_execution_count: actionExecutions.get(scenario.scenario_id) ?? 0,
        authoritative_rows: summarizeSnapshot(snapshot),
        provider_receipt_id: provider.receipt_id,
      }));

      const before = snapshot;
      const conflictRequest = requestFor(scenario, 'conflicting');
      let rejection: string | null = null;
      try {
        await executeScenario(scenario, conflictRequest);
      } catch (cause) {
        rejection = errorMessage(cause);
      }
      const after = await snapshotScenario(postgres, scenario);
      conflictResults.push(Object.freeze({
        scenario_id: scenario.scenario_id,
        node_id: node.node_id,
        operation_id: operation.operation_id,
        idempotency_key: scenario.idempotency_key,
        accepted_request_hash: acceptedHash,
        conflicting_request_hash: operationRequestHash(conflictRequest),
        rejection,
        before_sha256: snapshotDigest(before),
        after_sha256: snapshotDigest(after),
        state_change_count: canonical(before) === canonical(after) ? 0 : 1,
        action_execution_count_after_conflict: actionExecutions.get(scenario.scenario_id) ?? 0,
      }));
    }
  }

  for (const node of criteria.node_matrix) {
    for (const operation of criteria.operation_matrix) {
      for (const point of criteria.interruption_points) {
        const scenario = makeScenario('interruption', node, operation, point);
        const request = requestFor(scenario, 'accepted');
        const before = await snapshotScenario(postgres, scenario);
        let failure: string | null = null;
        let firstResponse: OperationResult | null = null;
        try {
          firstResponse = await executeScenario(scenario, request, {
            ...(point === 'during_provider_apply' ? {} : { interrupt_at: point }),
          });
          await applyProvider(scenario, point === 'during_provider_apply');
        } catch (cause) {
          failure = errorMessage(cause);
        }
        const interrupted = await snapshotScenario(postgres, scenario);
        const classification = classifyInterrupted(point, interrupted);
        const retryResponse = await executeScenario(scenario, requestFor(scenario, 'accepted'));
        const recoveredProvider = await applyProvider(scenario, false);
        const terminal = await snapshotScenario(postgres, scenario);
        const providerAttempts = terminal.provider_attempts.length;
        interruptionDiffs.push(Object.freeze({
          scenario_id: scenario.scenario_id,
          node_id: node.node_id,
          operation_id: operation.operation_id,
          interruption_point: point,
          idempotency_key: scenario.idempotency_key,
          request_hash: operationRequestHash(request),
          injected_failure: failure,
          first_response_business_number: firstResponse?.headers?.['x-business-number'] ?? null,
          before_sha256: snapshotDigest(before),
          interrupted_sha256: snapshotDigest(interrupted),
          terminal_sha256: snapshotDigest(terminal),
          interrupted_classification: classification,
          interrupted_snapshot: interrupted,
          terminal_summary: summarizeSnapshot(terminal),
          retry_response_status: retryResponse.status,
          retry_business_number: retryResponse.headers?.['x-business-number'] ?? null,
        }));
        recoveryReceipts.push(Object.freeze({
          recovery_id: `recovery:${scenario.scenario_id}`,
          scenario_id: scenario.scenario_id,
          node_id: node.node_id,
          operation_id: operation.operation_id,
          interruption_point: point,
          interruption_classification: classification,
          resumed_from: point === 'during_provider_apply' ? 'provider_receipt' : 'clean_transaction_boundary',
          confirmed_steps_before_retry: point === 'during_provider_apply'
            ? ['business_transaction_committed', `provider_receipt:${recoveredProvider.receipt_id}`]
            : [],
          retry_business_number: retryResponse.headers?.['x-business-number'] ?? null,
          terminal_execution_state: value(terminal.idempotency[0], 'execution_state'),
          action_execution_count: actionExecutions.get(scenario.scenario_id) ?? 0,
          provider_apply_attempt_count: providerAttempts,
          provider_resource_count: terminal.provider_resources.length,
          provider_receipt_count: terminal.provider_receipts.length,
          provider_receipt_id: recoveredProvider.receipt_id,
          provider_receipt_reused_on_recovery: recoveredProvider.reused,
          provider_command_state: value(terminal.provider_commands[0], 'state'),
        }));
      }
    }
  }

  const targetNode = criteria.node_matrix.find((node) => node.node_id === criteria.target_recovery_node);
  if (!targetNode) throw new Error('E09_TARGET_RECOVERY_NODE_MISSING');
  const nonTargetNodes = criteria.node_matrix.filter((node) => node.node_id !== targetNode.node_id);
  const beforeIsolation = await snapshotNodes(postgres, criteria.node_matrix);
  const targetRecoveryReceipts = [];
  for (const operation of criteria.operation_matrix) {
    const scenario = makeScenario('isolation', targetNode, operation, 'during_provider_apply');
    const request = requestFor(scenario, 'accepted');
    let failure: string | null = null;
    try {
      await executeScenario(scenario, request);
      await applyProvider(scenario, true);
    } catch (cause) {
      failure = errorMessage(cause);
    }
    const interrupted = await snapshotScenario(postgres, scenario);
    const response = await executeScenario(scenario, requestFor(scenario, 'accepted'));
    const provider = await applyProvider(scenario, false);
    const terminal = await snapshotScenario(postgres, scenario);
    targetRecoveryReceipts.push(Object.freeze({
      scenario_id: scenario.scenario_id,
      operation_id: operation.operation_id,
      injected_failure: failure,
      interrupted_classification: classifyInterrupted('during_provider_apply', interrupted),
      retry_business_number: response.headers?.['x-business-number'] ?? null,
      provider_receipt_id: provider.receipt_id,
      provider_receipt_reused: provider.reused,
      terminal_summary: summarizeSnapshot(terminal),
    }));
  }
  const afterIsolation = await snapshotNodes(postgres, criteria.node_matrix);
  const isolationComparisons = criteria.node_matrix.map((node) => {
    const before = beforeIsolation.get(node.node_id)!;
    const after = afterIsolation.get(node.node_id)!;
    return Object.freeze({
      node_id: node.node_id,
      role: node.node_id === targetNode.node_id ? 'target' : 'non_target',
      before_sha256: snapshotDigest(before),
      after_sha256: snapshotDigest(after),
      changed: canonical(before) !== canonical(after),
      before_row_count: snapshotRowCount(before),
      after_row_count: snapshotRowCount(after),
    });
  });

  const capturedAt = new Date().toISOString();
  const rawRows = await allRawRows(postgres);
  const providerRows = Object.freeze({
    schema_version: 'e09-provider-receipts-v1',
    captured_at: capturedAt,
    provider_boundary: 'Local deterministic provider in a separately committed PostgreSQL transaction; no production or external provider was contacted.',
    idempotency_semantics: 'provider_key is unique; recovery reuses the existing resource and receipt before acknowledging the local command.',
    commands: rawRows.provider_commands,
    resources: rawRows.provider_resources,
    receipts: rawRows.provider_receipts,
    attempts: rawRows.provider_attempts,
  });
  const auditAndOutbox = Object.freeze({
    schema_version: 'e09-audit-and-outbox-rows-v1',
    captured_at: capturedAt,
    audit_records: rawRows.audit_records,
    runtime_outbox: rawRows.runtime_outbox,
  });
  const databaseRows = Object.freeze({
    schema_version: 'e09-database-raw-rows-v1',
    captured_at: capturedAt,
    runtime_idempotency: rawRows.idempotency,
    business_facts: rawRows.business_facts,
    durable_checkpoints: rawRows.checkpoints,
    provider_commands: rawRows.provider_commands,
  });
  const nonTargetIsolation = Object.freeze({
    schema_version: 'e09-nontarget-isolation-diff-v1',
    captured_at: capturedAt,
    target_node_id: targetNode.node_id,
    non_target_node_ids: nonTargetNodes.map((node) => node.node_id),
    before_snapshots: Object.fromEntries([...beforeIsolation.entries()]),
    after_snapshots: Object.fromEntries([...afterIsolation.entries()]),
    comparisons: isolationComparisons,
    target_recovery_receipts: targetRecoveryReceipts,
    non_target_change_count: isolationComparisons.filter((entry) => entry.role === 'non_target' && entry.changed).length,
  });

  await Promise.all([
    writeJson(join(outputDirectory, 'idempotency-five-way-results.json'), Object.freeze({
      schema_version: 'e09-idempotency-five-way-results-v1',
      captured_at: capturedAt,
      concurrency: criteria.concurrency,
      scenarios: fiveWayResults,
    })),
    writeJson(join(outputDirectory, 'idempotency-conflict-results.json'), Object.freeze({
      schema_version: 'e09-idempotency-conflict-results-v1',
      captured_at: capturedAt,
      scenarios: conflictResults,
    })),
    writeJson(join(outputDirectory, 'interruption-state-diffs.json'), Object.freeze({
      schema_version: 'e09-interruption-state-diffs-v1',
      captured_at: capturedAt,
      scenarios: interruptionDiffs,
    })),
    writeJson(join(outputDirectory, 'recovery-receipts.json'), Object.freeze({
      schema_version: 'e09-recovery-receipts-v1',
      captured_at: capturedAt,
      receipts: recoveryReceipts,
    })),
    writeJson(join(outputDirectory, 'nontarget-isolation-diff.json'), nonTargetIsolation),
    writeJson(join(outputDirectory, 'database-raw-rows.json'), databaseRows),
    writeJson(join(outputDirectory, 'provider-receipts.json'), providerRows),
    writeJson(join(outputDirectory, 'audit-and-outbox-rows.json'), auditAndOutbox),
  ]);

  process.stdout.write(`${JSON.stringify({
    five_way_scenarios: fiveWayResults.length,
    conflict_scenarios: conflictResults.length,
    interruption_scenarios: interruptionDiffs.length,
    recovery_receipts: recoveryReceipts.length,
    isolation_target_recoveries: targetRecoveryReceipts.length,
    non_target_change_count: nonTargetIsolation.non_target_change_count,
  })}\n`);
} finally {
  await databasePool.end();
}

function fixtureDatabasePool(pool: Pool): DatabasePool {
  const value: DatabasePool = {
    connect: () => pool.connect(),
    query: <R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>> =>
      pool.query<R>(text, values as unknown[] | undefined),
    workload: (_workload: DatabaseWorkload) => value,
    end: () => pool.end(),
  };
  return value;
}

function makeScenario(caseKind: Scenario['case_kind'], node: CriteriaNode, operation: CriteriaOperation, point?: InterruptionPoint): Scenario {
  const operationToken = operation.operation_id.replaceAll('.', '-');
  const pointToken = point ? `:${point}` : '';
  const scenarioId = `e09:${caseKind}:${node.label.toLowerCase()}:${operationToken}${pointToken}`;
  return Object.freeze({
    scenario_id: scenarioId,
    case_kind: caseKind,
    node,
    operation,
    idempotency_key: `idem:${digest(scenarioId).slice(0, 24)}`,
  });
}

function requestFor(scenario: Scenario, intent: 'accepted' | 'conflicting'): OperationRequest {
  const access = accessFor(scenario.node, scenario.scenario_id);
  const body = Object.freeze({ scenarioId: scenario.scenario_id, intent, value: intent === 'accepted' ? 1 : 2 });
  return Object.freeze({
    type: scenario.operation.operation_id,
    access,
    input: Object.freeze({
      path: Object.freeze({ scenario: scenario.scenario_id }),
      query: Object.freeze({}),
      headers: Object.freeze({ 'request-id': `request:${digest(`${scenario.scenario_id}:${intent}`).slice(0, 24)}` }),
      body,
      rawBody: JSON.stringify(body),
      deadline: Date.now() + 120_000,
      signal: new AbortController().signal,
      resource: scenario.scenario_id,
      idempotency: scenario.idempotency_key,
    }),
  });
}

function accessFor(node: CriteriaNode, scenarioId: string): AccessContext {
  const scopeId = scopeFor(node);
  const membershipId = membershipFor(node);
  const hosted = node.sovereignty_tier === 'hosted';
  const manifestDigest = `sha256:${digest(`manifest:${node.node_id}`)}` as const;
  const nodeContext = {
    line_id: 'line:e09',
    node_id: node.node_id,
    parent_node_id: hosted ? 'node:e09:sovereign-host' : null,
    signed_level: hosted ? 'L1' : 'L0',
    node_profile: 'operating_mall',
    mall_id: `mall:${node.node_id}`,
    host_node_id: hosted ? 'node:e09:sovereign-host' : null,
    host: `${node.label.toLowerCase()}.e09.local`,
    surface: 'console',
    host_binding: { host: `${node.label.toLowerCase()}.e09.local`, binding_ref: { ref: `domain:${node.node_id}`, version: '1' }, application_ref: 'app:console', surface_ref: 'surface:console' },
    scope: { ref: scopeId, version: '1' },
    realm: { ref: realmFor(node), version: '1' },
    manifest_digest: manifestDigest,
    manifest: {
      line_id: 'line:e09', node_id: node.node_id, parent_node_id: hosted ? 'node:e09:sovereign-host' : null,
      signed_level: hosted ? 'L1' : 'L0', node_profile: 'operating_mall', mall_id: `mall:${node.node_id}`,
      host_node_id: hosted ? 'node:e09:sovereign-host' : null, schema_version: 'sfl.node-manifest.v1',
      manifest_id: `manifest:${node.node_id}`, manifest_version: '1', manifest_digest: manifestDigest,
      generated_at: '2026-09-13T00:00:00.000Z', lifecycle_status: 'active', domain_bindings: [],
      brand_ref: { ref: 'brand:e09', version: '1' }, applications: [], surfaces: [], enabled_features: [],
      api_contract_refs: [], realm_ref: { ref: realmFor(node), version: '1' }, data_scope_ref: { ref: scopeId, version: '1' },
      resource_binding_set_ref: { ref: 'resources:e09', version: '1' }, secret_binding_set_ref: { ref: 'secrets:e09', version: '1' },
      payment_binding_refs: [], callback_binding_refs: [], runtime_instance_id: `runtime:${node.node_id}`,
      runtime_config_ref: { ref: 'runtime-config:e09', version: '1' },
      release_pointer_ref: { ref: 'release:e09', version: '1', source_sha: '0'.repeat(40), build_id: 'build:e09', build_count: 1, immutable_artifact_digest: `sha256:${'0'.repeat(64)}` },
    },
  };
  return Object.freeze({
    actor: Object.freeze({
      id: actorFor(node), account: `account:${node.node_id}`, realm: realmFor(node), membershipClient: 'operator',
      governanceOrganization: `organization:${node.node_id}`, nodeContext, session: `session:${node.node_id}`,
      membership: membershipId, credentialVersion: 1, accessVersion: 1, target: 'console', assurance: Object.freeze({ level: 2 }),
    }),
    membership: Object.freeze({ id: membershipId, active: true, accessVersion: 1, denies: [], grants: [] }),
    scope: Object.freeze({ kind: 'tenant', id: scopeId, tenant: `tenant:${node.node_id}`, path: [] }),
    accessVersion: 1,
    capabilities: Object.freeze(['e09.critical-write']),
    assurance: Object.freeze({ level: 2 }),
    trace: `trace:${scenarioId}`,
  }) as AccessContext;
}

async function executeScenario(scenario: Scenario, request: OperationRequest, options: ExecutionOptions = {}): Promise<OperationResult> {
  const access = request.access!;
  const operation = OperationCatalog.get(request.type);
  return kernel.execute(request, operation.module, transaction, {
    tenant: access.scope.tenant ?? '',
    membership: access.membership.id,
    scope: access.scope.id,
    actor: access.actor.id,
    trace: access.trace,
    workload: 'command',
    serializationKeys: [`e09:${scenario.scenario_id}`],
  }, async (activeRequest, database) => {
    actionExecutions.set(scenario.scenario_id, (actionExecutions.get(scenario.scenario_id) ?? 0) + 1);
    const businessNumber = currentWriteTx(activeRequest).id;
    const requestHash = operationRequestHash(activeRequest);
    await database.query(`insert into e09.checkpoint(scenario_id,node_id,operation_id,step,business_number)
      values($1,$2,$3,'identity',$4)`, [scenario.scenario_id, scenario.node.node_id, scenario.operation.operation_id, businessNumber]);
    if (options.interrupt_at === 'after_identity') throw new Error(`E09_INJECTED_INTERRUPTION:after_identity:${scenario.scenario_id}`);
    await database.query(`insert into e09.checkpoint(scenario_id,node_id,operation_id,step,business_number)
      values($1,$2,$3,'configuration',$4)`, [scenario.scenario_id, scenario.node.node_id, scenario.operation.operation_id, businessNumber]);
    if (options.interrupt_at === 'after_configuration') throw new Error(`E09_INJECTED_INTERRUPTION:after_configuration:${scenario.scenario_id}`);
    await database.query(`insert into e09.business_fact(
      scenario_id,case_kind,node_id,operation_id,fact_kind,idempotency_key,request_hash,business_number,state_version,payload
    ) values($1,$2,$3,$4,$5,$6,$7,$8,1,$9::jsonb)`, [scenario.scenario_id, scenario.case_kind, scenario.node.node_id,
      scenario.operation.operation_id, scenario.operation.business_fact_kind, scenario.idempotency_key, requestHash, businessNumber,
      JSON.stringify({ scenarioId: scenario.scenario_id, operationId: scenario.operation.operation_id, nodeId: scenario.node.node_id })]);
    await database.query(`insert into e09.provider_command(
      scenario_id,node_id,operation_id,business_number,provider_key,request_hash,state
    ) values($1,$2,$3,$4,$5,$6,'pending')`, [scenario.scenario_id, scenario.node.node_id, scenario.operation.operation_id,
      businessNumber, providerKey(scenario), requestHash]);
    await database.query(`insert into runtime.outbox(
      id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at
    ) values($1,'e09.business.prepared',1,$2,$3,$4,$5::jsonb,$6,clock_timestamp(),clock_timestamp())`, [
      `event:e09:prepared:${digest(scenario.scenario_id).slice(0, 32)}`, scenario.operation.business_fact_kind, businessNumber,
      scopeFor(scenario.node), JSON.stringify({ scenarioId: scenario.scenario_id, operation: scenario.operation.operation_id,
        businessNumber, requestHash, semanticKey: `prepared:${scenario.scenario_id}` }), `trace:${scenario.scenario_id}`,
    ]);
    if (options.interrupt_at === 'after_outbox') throw new Error(`E09_INJECTED_INTERRUPTION:after_outbox:${scenario.scenario_id}`);
    return Object.freeze({ status: 201, body: Object.freeze({
      entity_id: `${scenario.operation.business_fact_kind}:${businessNumber}`,
      operation_id: scenario.operation.operation_id,
      node_id: scenario.node.node_id,
      state_version: 1,
    }) });
  }, (_request, result) => result);
}

async function applyProvider(scenario: Scenario, interruptAfterApply: boolean): Promise<Readonly<{ receipt_id: string; reused: boolean }>> {
  const command = await postgres.query<{ provider_key: string; business_number: string; request_hash: string }>(
    'select provider_key,business_number,request_hash from e09.provider_command where scenario_id=$1', [scenario.scenario_id]);
  const row = command.rows[0];
  if (!row) throw new Error(`E09_PROVIDER_COMMAND_MISSING:${scenario.scenario_id}`);
  const client = await postgres.connect();
  let receiptId = '';
  let reused = false;
  try {
    await client.query('begin');
    const resourceId = `provider-resource:${digest(row.provider_key).slice(0, 24)}`;
    const insertedResource = await client.query(`insert into e09.provider_resource(
      provider_key,scenario_id,node_id,operation_id,resource_id,request_hash
    ) values($1,$2,$3,$4,$5,$6) on conflict(provider_key) do nothing`, [row.provider_key, scenario.scenario_id,
      scenario.node.node_id, scenario.operation.operation_id, resourceId, row.request_hash]);
    receiptId = `provider-receipt:${digest(row.provider_key).slice(0, 24)}`;
    const insertedReceipt = await client.query(`insert into e09.provider_receipt(
      receipt_id,provider_key,scenario_id,node_id,operation_id,business_number,resource_id,request_hash
    ) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(provider_key) do nothing`, [receiptId, row.provider_key,
      scenario.scenario_id, scenario.node.node_id, scenario.operation.operation_id, row.business_number, resourceId, row.request_hash]);
    const selected = await client.query<{ receipt_id: string }>(
      'select receipt_id from e09.provider_receipt where provider_key=$1', [row.provider_key]);
    receiptId = selected.rows[0]?.receipt_id ?? '';
    reused = insertedResource.rowCount === 0 && insertedReceipt.rowCount === 0;
    await client.query(`insert into e09.provider_attempt(scenario_id,provider_key,outcome,interrupted_after_apply)
      values($1,$2,$3,$4)`, [scenario.scenario_id, row.provider_key, reused ? 'reused' : 'created', interruptAfterApply]);
    await client.query('commit');
  } catch (cause) {
    await client.query('rollback');
    throw cause;
  } finally {
    client.release();
  }
  if (!receiptId) throw new Error(`E09_PROVIDER_RECEIPT_MISSING:${scenario.scenario_id}`);
  if (interruptAfterApply) throw new Error(`E09_INJECTED_INTERRUPTION:during_provider_apply:${scenario.scenario_id}`);
  await postgres.query(`update e09.provider_command set state='completed',receipt_id=$2,completed_at=clock_timestamp(),attempts=attempts+1
    where scenario_id=$1`, [scenario.scenario_id, receiptId]);
  return Object.freeze({ receipt_id: receiptId, reused });
}

async function snapshotScenario(database: Pool, scenario: Scenario): Promise<ScenarioSnapshot> {
  const scopedKey = `${scenario.operation.operation_id}|${realmFor(scenario.node)}|${scenario.node.node_id}|${membershipFor(scenario.node)}|${scenario.idempotency_key}`;
  const [idempotency, business, checkpoints, outbox, audits, commands, resources, receipts, attempts] = await Promise.all([
    rows(database, `select scope,actor_id,key,request_hash,state,response,operation_id,business_number,execution_state,realm_id,node_id,
      membership_id,operation_hash,completed_at from runtime.idempotency where scope=$1 and actor_id=$2 and key=$3 order by key`,
    [scopeFor(scenario.node), actorFor(scenario.node), scopedKey]),
    rows(database, 'select * from e09.business_fact where scenario_id=$1 order by business_number', [scenario.scenario_id]),
    rows(database, 'select * from e09.checkpoint where scenario_id=$1 order by step', [scenario.scenario_id]),
    rows(database, `select id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at,
      published_at,failed_at,error_code from runtime.outbox where scope_id=$1 and(
        payload->>'scenarioId'=$2 or aggregate_id in(select business_number from e09.business_fact where scenario_id=$2)
      ) order by event_type,id`, [scopeFor(scenario.node), scenario.scenario_id]),
    rows(database, `select id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,evidence,trace_id,
      previous_hash,record_hash,recorded_at from audit.record where scope_id=$1 and resource_id=$2 order by recorded_at,id`,
    [scopeFor(scenario.node), scenario.scenario_id]),
    rows(database, 'select * from e09.provider_command where scenario_id=$1 order by provider_key', [scenario.scenario_id]),
    rows(database, `select resource.* from e09.provider_resource resource join e09.provider_command command using(provider_key)
      where command.scenario_id=$1 order by resource.provider_key`, [scenario.scenario_id]),
    rows(database, 'select * from e09.provider_receipt where scenario_id=$1 order by receipt_id', [scenario.scenario_id]),
    rows(database, 'select * from e09.provider_attempt where scenario_id=$1 order by attempt_id', [scenario.scenario_id]),
  ]);
  return Object.freeze({ idempotency, business_facts: business, checkpoints, runtime_outbox: outbox, audit_records: audits,
    provider_commands: commands, provider_resources: resources, provider_receipts: receipts, provider_attempts: attempts });
}

async function snapshotNodes(database: Pool, nodes: readonly CriteriaNode[]): Promise<Map<string, ScenarioSnapshot>> {
  return new Map(await Promise.all(nodes.map(async (node) => {
    const scope = scopeFor(node);
    const [idempotency, business, checkpoints, outbox, audits, commands, resources, receipts, attempts] = await Promise.all([
      rows(database, `select scope,actor_id,key,request_hash,state,response,operation_id,business_number,execution_state,realm_id,node_id,
        membership_id,operation_hash,completed_at from runtime.idempotency where node_id=$1 order by key`, [node.node_id]),
      rows(database, 'select * from e09.business_fact where node_id=$1 order by scenario_id', [node.node_id]),
      rows(database, 'select * from e09.checkpoint where node_id=$1 order by scenario_id,step', [node.node_id]),
      rows(database, `select id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at,
        published_at,failed_at,error_code from runtime.outbox where scope_id=$1 order by event_type,id`, [scope]),
      rows(database, `select id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,evidence,trace_id,
        previous_hash,record_hash,recorded_at from audit.record where scope_id=$1 order by recorded_at,id`, [scope]),
      rows(database, 'select * from e09.provider_command where node_id=$1 order by scenario_id', [node.node_id]),
      rows(database, 'select * from e09.provider_resource where node_id=$1 order by scenario_id', [node.node_id]),
      rows(database, 'select * from e09.provider_receipt where node_id=$1 order by scenario_id', [node.node_id]),
      rows(database, `select attempt.* from e09.provider_attempt attempt join e09.provider_command command using(scenario_id)
        where command.node_id=$1 order by attempt.attempt_id`, [node.node_id]),
    ]);
    return [node.node_id, Object.freeze({ idempotency, business_facts: business, checkpoints, runtime_outbox: outbox,
      audit_records: audits, provider_commands: commands, provider_resources: resources, provider_receipts: receipts,
      provider_attempts: attempts })] as const;
  })));
}

async function allRawRows(database: Pool) {
  const [idempotency, business, checkpoints, outbox, audits, commands, resources, receipts, attempts] = await Promise.all([
    rows(database, `select scope,actor_id,key,request_hash,state,response,operation_id,business_number,execution_state,realm_id,node_id,
      membership_id,operation_hash,completed_at from runtime.idempotency where scope like 'e09:%' order by node_id,operation_id,key`),
    rows(database, 'select * from e09.business_fact order by node_id,operation_id,scenario_id'),
    rows(database, 'select * from e09.checkpoint order by node_id,operation_id,scenario_id,step'),
    rows(database, `select id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at,
      published_at,failed_at,error_code from runtime.outbox where scope_id like 'e09:%' order by scope_id,event_type,id`),
    rows(database, `select id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,evidence,trace_id,
      previous_hash,record_hash,recorded_at from audit.record where scope_id like 'e09:%' order by scope_id,recorded_at,id`),
    rows(database, 'select * from e09.provider_command order by node_id,operation_id,scenario_id'),
    rows(database, 'select * from e09.provider_resource order by node_id,operation_id,scenario_id'),
    rows(database, 'select * from e09.provider_receipt order by node_id,operation_id,scenario_id'),
    rows(database, 'select * from e09.provider_attempt order by attempt_id'),
  ]);
  return Object.freeze({ idempotency, business_facts: business, checkpoints, runtime_outbox: outbox, audit_records: audits,
    provider_commands: commands, provider_resources: resources, provider_receipts: receipts, provider_attempts: attempts });
}

function classifyInterrupted(point: InterruptionPoint, snapshot: ScenarioSnapshot): string {
  if (point !== 'during_provider_apply' && snapshotRowCount(snapshot) === 0) return 'clean_transactional_rollback';
  if (point === 'during_provider_apply'
    && snapshot.business_facts.length === 1
    && snapshot.idempotency.length === 1
    && value(snapshot.idempotency[0], 'execution_state') === 'completed'
    && snapshot.audit_records.length === 1
    && snapshot.runtime_outbox.length === 2
    && snapshot.provider_commands.length === 1
    && value(snapshot.provider_commands[0], 'state') === 'pending'
    && snapshot.provider_resources.length === 1
    && snapshot.provider_receipts.length === 1) return 'provider_applied_local_pending';
  return 'unclassified_partial_state';
}

function summarizeSnapshot(snapshot: ScenarioSnapshot) {
  return Object.freeze({
    idempotency: snapshot.idempotency.length,
    business_facts: snapshot.business_facts.length,
    checkpoints: snapshot.checkpoints.length,
    runtime_outbox: snapshot.runtime_outbox.length,
    audit_records: snapshot.audit_records.length,
    provider_commands: snapshot.provider_commands.length,
    provider_resources: snapshot.provider_resources.length,
    provider_receipts: snapshot.provider_receipts.length,
    provider_attempts: snapshot.provider_attempts.length,
    execution_state: value(snapshot.idempotency[0], 'execution_state'),
    provider_command_state: value(snapshot.provider_commands[0], 'state'),
  });
}

function snapshotRowCount(snapshot: ScenarioSnapshot): number {
  return Object.values(snapshot).reduce((total, entries) => total + entries.length, 0);
}

function snapshotDigest(snapshot: ScenarioSnapshot): string {
  return `sha256:${digest(canonical(snapshot))}`;
}

function value(row: Record<string, unknown> | undefined, key: string): unknown {
  return row?.[key] ?? null;
}

async function rows(database: Pool, sql: string, values: readonly unknown[] = []): Promise<readonly Record<string, unknown>[]> {
  return (await database.query(sql, values as unknown[])).rows as Record<string, unknown>[];
}

async function createFixtureSchema(database: Pool): Promise<void> {
  await database.query(`insert into runtime.event(type,version,owner,schema_ref)
      values('e09.business.prepared',1,'e09-fixture','fixture://e09.business.prepared/v1')
      on conflict(type,version) do nothing;
    create schema e09;
    create table e09.business_fact(
      scenario_id text primary key,
      case_kind text not null,
      node_id text not null,
      operation_id text not null,
      fact_kind text not null,
      idempotency_key text not null,
      request_hash char(64) not null,
      business_number text not null unique,
      state_version integer not null check(state_version=1),
      payload jsonb not null,
      created_at timestamptz not null default clock_timestamp()
    );
    create table e09.checkpoint(
      scenario_id text not null,
      node_id text not null,
      operation_id text not null,
      step text not null check(step in('identity','configuration')),
      business_number text not null,
      confirmed_at timestamptz not null default clock_timestamp(),
      primary key(scenario_id,step)
    );
    create table e09.provider_command(
      scenario_id text primary key,
      node_id text not null,
      operation_id text not null,
      business_number text not null,
      provider_key text not null unique,
      request_hash char(64) not null,
      state text not null check(state in('pending','completed')),
      receipt_id text,
      attempts integer not null default 0,
      created_at timestamptz not null default clock_timestamp(),
      completed_at timestamptz
    );
    create table e09.provider_resource(
      provider_key text primary key,
      scenario_id text not null,
      node_id text not null,
      operation_id text not null,
      resource_id text not null unique,
      request_hash char(64) not null,
      applied_at timestamptz not null default clock_timestamp()
    );
    create table e09.provider_receipt(
      receipt_id text primary key,
      provider_key text not null unique,
      scenario_id text not null,
      node_id text not null,
      operation_id text not null,
      business_number text not null,
      resource_id text not null,
      request_hash char(64) not null,
      applied_at timestamptz not null default clock_timestamp()
    );
    create table e09.provider_attempt(
      attempt_id bigint generated always as identity primary key,
      scenario_id text not null,
      provider_key text not null,
      outcome text not null check(outcome in('created','reused')),
      interrupted_after_apply boolean not null,
      attempted_at timestamptz not null default clock_timestamp()
    );`);
}

function scopeFor(node: CriteriaNode): string {
  return `e09:${node.node_id}`;
}

function actorFor(node: CriteriaNode): string {
  return `actor:${node.node_id}`;
}

function realmFor(node: CriteriaNode): string {
  return `realm:${node.node_id}`;
}

function membershipFor(node: CriteriaNode): string {
  return `membership:${node.node_id}`;
}

function providerKey(scenario: Scenario): string {
  return `provider:${digest(scenario.scenario_id).slice(0, 32)}`;
}

function assertCriteria(value: Criteria): void {
  if (value.node_matrix.length !== 3 || value.operation_matrix.length !== 5 || value.concurrency !== 5
    || value.interruption_points.length !== 4) throw new Error('E09_CRITERIA_MATRIX_INVALID');
  for (const operation of value.operation_matrix) {
    const descriptor = OperationCatalog.get(operation.operation_id);
    if (descriptor.writePath !== 'transactional' || descriptor.idempotency !== 'required') {
      throw new Error(`E09_OPERATION_NOT_TRANSACTIONAL_IDEMPOTENT:${operation.operation_id}`);
    }
  }
}

function canonical(value_: unknown): string {
  if (Array.isArray(value_)) return `[${value_.map(canonical).join(',')}]`;
  if (value_ && typeof value_ === 'object') {
    if (value_ instanceof Date) return JSON.stringify(value_.toISOString());
    return `{${Object.entries(value_ as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value_) ?? 'null';
}

function digest(value_: string): string {
  return createHash('sha256').update(value_).digest('hex');
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value_ = index < 0 ? undefined : process.argv[index + 1];
  if (!value_ || value_.startsWith('--')) throw new Error(`E09_OPTION_VALUE_REQUIRED:${name}`);
  return value_;
}

function writeJson(path: string, value_: unknown): Promise<void> {
  return writeFile(path, `${JSON.stringify(value_, null, 2)}\n`, { flag: 'wx' });
}
