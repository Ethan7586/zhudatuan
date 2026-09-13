import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const runDirectory = option('--run-directory');
const criteriaPath = option('--criteria');
const outputPath = option('--output');
const criteria = await readJson(criteriaPath);
const inputNames = criteria.required_input_artifacts;
const loaded = await Promise.all(inputNames.map(async (name) => [name, await optionalJson(join(runDirectory, name))]));
const inputs = Object.fromEntries(loaded);
const fiveWay = inputs['idempotency-five-way-results.json'];
const conflicts = inputs['idempotency-conflict-results.json'];
const interruptions = inputs['interruption-state-diffs.json'];
const recoveries = inputs['recovery-receipts.json'];
const isolation = inputs['nontarget-isolation-diff.json'];
const databaseRows = inputs['database-raw-rows.json'];
const providerRows = inputs['provider-receipts.json'];
const auditRows = inputs['audit-and-outbox-rows.json'];
const environment = inputs['environment.json'];

const missingItems = requiredEvidence(criteria, inputs);
const baseline = reconcile(criteria, { fiveWay, conflicts, interruptions, recoveries, isolation, databaseRows, providerRows, auditRows });
const negativeProbes = runNegativeProbes(criteria, { fiveWay, conflicts, interruptions, recoveries, isolation, databaseRows, providerRows, auditRows });
const thresholds = Object.freeze([
  threshold('required_raw_evidence_missing_count', 0, missingItems.length),
  threshold('operation_node_scenario_completeness_mismatch_count', 0, baseline.counts.scenario),
  threshold('authoritative_result_count_mismatch_count', 0, baseline.counts.authority),
  threshold('identical_response_business_id_mismatch_count', 0, baseline.counts.response),
  threshold('request_hash_or_idempotency_key_missing_count', 0, baseline.counts.identity),
  threshold('conflict_rejection_mismatch_count', 0, baseline.counts.conflictRejection),
  threshold('conflict_state_change_count', 0, baseline.counts.conflictChange),
  threshold('duplicate_business_provider_audit_or_outbox_side_effect_count', 0, baseline.counts.duplicate),
  threshold('interruption_recovery_scenario_completeness_mismatch_count', 0, baseline.counts.interruptionScenario),
  threshold('unclassified_partial_state_count', 0, baseline.counts.partial),
  threshold('retry_terminal_state_mismatch_count', 0, baseline.counts.terminal),
  threshold('provider_receipt_missing_or_duplicate_count', 0, baseline.counts.provider),
  threshold('non_target_node_change_count', 0, baseline.counts.nonTarget),
  threshold('negative_oracle_probe_miss_count', 0, negativeProbes.filter((entry) => !entry.detected).length),
]);
const contradiction = thresholds.some((entry) => entry.threshold_id !== 'required_raw_evidence_missing_count' && !entry.met);
const claimOutcome = missingItems.length > 0 ? 'UNKNOWN' : contradiction ? 'NOT MET' : 'MET';
const inputArtifacts = await Promise.all(
  [criteriaPath, ...inputNames.map((name) => join(runDirectory, name))].map(async (path) => {
    const bytes = await readFile(path).catch(() => null);
    return bytes === null ? Object.freeze({ path: basename(path), missing: true }) : Object.freeze({
      path: basename(path), sha256: `sha256:${sha256(bytes)}`, size_bytes: bytes.byteLength,
    });
  })
);
const output = Object.freeze({
  schema_version: 'e09-independent-recovery-recount-v1',
  oracle_id: criteria.independent_oracle.oracle_id,
  executed_at: new Date().toISOString(),
  reads_test_program_pass: false,
  input_artifacts: inputArtifacts,
  missing_items: missingItems,
  violations: baseline.violations,
  negative_probes: negativeProbes,
  recomputed_observations: baseline.observations,
  thresholds,
  claim_outcome: claimOutcome,
  environment_assurance: claimOutcome === 'MET' && environment?.kind === 'DEV' ? 'DEV VERIFIED' : 'NOT ESTABLISHED',
});
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' });

function requiredEvidence(criteriaValue, values) {
  const missing = [];
  for (const name of criteriaValue.required_input_artifacts) {
    if (!values[name] || typeof values[name] !== 'object') missing.push(`artifact:${name}`);
  }
  requireArray(values['idempotency-five-way-results.json']?.scenarios, 'five-way scenarios', missing, true);
  requireArray(values['idempotency-conflict-results.json']?.scenarios, 'conflict scenarios', missing, true);
  requireArray(values['interruption-state-diffs.json']?.scenarios, 'interruption scenarios', missing, true);
  requireArray(values['recovery-receipts.json']?.receipts, 'recovery receipts', missing, true);
  requireArray(values['nontarget-isolation-diff.json']?.comparisons, 'target/non-target comparisons', missing, true);
  requireArray(values['nontarget-isolation-diff.json']?.target_recovery_receipts, 'target recovery receipts', missing, true);
  for (const field of ['runtime_idempotency', 'business_facts', 'durable_checkpoints', 'provider_commands']) {
    requireArray(values['database-raw-rows.json']?.[field], `database ${field}`, missing, true);
  }
  for (const field of ['commands', 'resources', 'receipts', 'attempts']) {
    requireArray(values['provider-receipts.json']?.[field], `provider ${field}`, missing, true);
  }
  for (const field of ['audit_records', 'runtime_outbox']) {
    requireArray(values['audit-and-outbox-rows.json']?.[field], `audit/outbox ${field}`, missing, true);
  }
  for (const field of ['kind', 'environment_id', 'description', 'owner', 'isolation', 'production_impact', 'runtime', 'source_control']) {
    requireValue(values['environment.json']?.[field], `environment ${field}`, missing);
  }

  for (const scenario of array(values['idempotency-five-way-results.json']?.scenarios)) {
    for (const field of ['scenario_id', 'node_id', 'operation_id', 'idempotency_key', 'request_hash']) {
      requireValue(scenario[field], `${scenario.scenario_id ?? 'five-way'} ${field}`, missing);
    }
    requireArray(scenario.deliveries, `${scenario.scenario_id ?? 'five-way'} deliveries`, missing, true);
    for (const delivery of array(scenario.deliveries)) {
      for (const field of ['idempotency_key', 'request_hash', 'response_business_number']) {
        requireValue(delivery[field], `${scenario.scenario_id ?? 'five-way'} delivery ${field}`, missing);
      }
    }
  }
  for (const scenario of array(values['idempotency-conflict-results.json']?.scenarios)) {
    for (const field of ['scenario_id', 'node_id', 'operation_id', 'idempotency_key', 'accepted_request_hash',
      'conflicting_request_hash', 'rejection', 'before_sha256', 'after_sha256']) {
      requireValue(scenario[field], `${scenario.scenario_id ?? 'conflict'} ${field}`, missing);
    }
  }
  for (const scenario of array(values['interruption-state-diffs.json']?.scenarios)) {
    for (const field of ['scenario_id', 'node_id', 'operation_id', 'interruption_point', 'idempotency_key', 'request_hash',
      'injected_failure', 'interrupted_classification', 'interrupted_snapshot', 'terminal_summary', 'retry_business_number']) {
      requireValue(scenario[field], `${scenario.scenario_id ?? 'interruption'} ${field}`, missing);
    }
  }
  for (const receipt of array(values['recovery-receipts.json']?.receipts)) {
    for (const field of ['recovery_id', 'scenario_id', 'node_id', 'operation_id', 'interruption_point',
      'interruption_classification', 'resumed_from', 'retry_business_number', 'terminal_execution_state', 'provider_receipt_id']) {
      requireValue(receipt[field], `${receipt.scenario_id ?? 'recovery'} ${field}`, missing);
    }
  }
  return missing;
}

function reconcile(criteriaValue, values) {
  const counts = {
    scenario: 0, authority: 0, response: 0, identity: 0, conflictRejection: 0, conflictChange: 0,
    duplicate: 0, interruptionScenario: 0, partial: 0, terminal: 0, provider: 0, nonTarget: 0,
  };
  const violations = [];
  const add = (kind, code, detail, magnitude = 1) => {
    counts[kind] += magnitude;
    violations.push(Object.freeze({ code, detail }));
  };
  const fiveScenarios = array(values.fiveWay?.scenarios);
  const conflictScenarios = array(values.conflicts?.scenarios);
  const interruptionScenarios = array(values.interruptions?.scenarios);
  const recoveryReceipts = array(values.recoveries?.receipts);
  const expectedBase = criteriaValue.node_matrix.flatMap((node) => criteriaValue.operation_matrix
    .map((operation) => `${node.node_id}|${operation.operation_id}`));
  const actualFive = fiveScenarios.map((scenario) => `${scenario.node_id}|${scenario.operation_id}`);
  const actualConflicts = conflictScenarios.map((scenario) => `${scenario.node_id}|${scenario.operation_id}`);
  const baseMismatch = multisetMismatch(actualFive, expectedBase) + multisetMismatch(actualConflicts, expectedBase);
  if (baseMismatch > 0) add('scenario', 'BASE_SCENARIO_MATRIX_MISMATCH', { expected: expectedBase.length * 2,
    actual: actualFive.length + actualConflicts.length }, baseMismatch);

  const businessFacts = array(values.databaseRows?.business_facts);
  const idempotencyRows = array(values.databaseRows?.runtime_idempotency);
  const providerCommands = array(values.providerRows?.commands);
  const providerResources = array(values.providerRows?.resources);
  const providerReceipts = array(values.providerRows?.receipts);
  const audits = array(values.auditRows?.audit_records);
  const outbox = array(values.auditRows?.runtime_outbox);

  for (const scenario of fiveScenarios) {
    const deliveries = array(scenario.deliveries);
    if (!scenario.idempotency_key || !validHash(scenario.request_hash)) add('identity', 'FIVE_WAY_IDENTITY_MISSING', { scenario_id: scenario.scenario_id });
    for (const delivery of deliveries) {
      if (!delivery.idempotency_key || !validHash(delivery.request_hash)) add('identity', 'DELIVERY_IDENTITY_MISSING', { scenario_id: scenario.scenario_id, delivery: delivery.delivery });
    }
    const businessNumbers = deliveries.map((delivery) => delivery.response_business_number).filter(Boolean);
    if (deliveries.length !== criteriaValue.concurrency || new Set(deliveries.map((entry) => entry.request_hash)).size !== 1
      || new Set(deliveries.map((entry) => entry.idempotency_key)).size !== 1 || new Set(businessNumbers).size !== 1
      || businessNumbers.length !== criteriaValue.concurrency) {
      add('response', 'FIVE_WAY_RESPONSE_MISMATCH', { scenario_id: scenario.scenario_id, deliveries: deliveries.length,
        business_numbers: [...new Set(businessNumbers)] });
    }
    const facts = businessFacts.filter((row) => row.scenario_id === scenario.scenario_id);
    const idem = idempotencyRows.filter((row) => row.node_id === scenario.node_id && row.operation_id === scenario.operation_id
      && String(row.key ?? '').endsWith(`|${scenario.idempotency_key}`));
    const scenarioAudits = audits.filter((row) => row.resource_id === scenario.scenario_id);
    const number = businessNumbers[0];
    const completedEvents = outbox.filter((row) => row.event_type === 'runtime.operation.completed' && row.aggregate_id === number);
    const preparedEvents = outbox.filter((row) => row.event_type === 'e09.business.prepared' && row.payload?.scenarioId === scenario.scenario_id);
    if (facts.length !== 1 || idem.length !== 1 || scenarioAudits.length !== 1 || completedEvents.length !== 1
      || preparedEvents.length !== 1 || scenario.action_execution_count !== 1 || facts[0]?.business_number !== number
      || idem[0]?.business_number !== number || idem[0]?.execution_state !== 'completed') {
      add('authority', 'AUTHORITATIVE_RESULT_MISMATCH', { scenario_id: scenario.scenario_id, facts: facts.length,
        idempotency: idem.length, audit: scenarioAudits.length, completed_outbox: completedEvents.length,
        prepared_outbox: preparedEvents.length, actions: scenario.action_execution_count });
    }
  }

  for (const scenario of conflictScenarios) {
    if (!scenario.idempotency_key || !validHash(scenario.accepted_request_hash) || !validHash(scenario.conflicting_request_hash)) {
      add('identity', 'CONFLICT_IDENTITY_MISSING', { scenario_id: scenario.scenario_id });
    }
    if (scenario.accepted_request_hash === scenario.conflicting_request_hash || !String(scenario.rejection).includes('IDEMPOTENCY_KEY_REUSED')) {
      add('conflictRejection', 'CONFLICT_NOT_REJECTED', { scenario_id: scenario.scenario_id, rejection: scenario.rejection });
    }
    if (scenario.state_change_count !== 0 || scenario.before_sha256 !== scenario.after_sha256 || scenario.action_execution_count_after_conflict !== 1) {
      add('conflictChange', 'CONFLICT_CHANGED_ACCEPTED_STATE', { scenario_id: scenario.scenario_id,
        state_change_count: scenario.state_change_count, actions: scenario.action_execution_count_after_conflict });
    }
  }

  const expectedInterruptions = criteriaValue.node_matrix.flatMap((node) => criteriaValue.operation_matrix.flatMap((operation) =>
    criteriaValue.interruption_points.map((point) => `${node.node_id}|${operation.operation_id}|${point}`)));
  const actualInterruptions = interruptionScenarios.map((scenario) => `${scenario.node_id}|${scenario.operation_id}|${scenario.interruption_point}`);
  const actualRecoveries = recoveryReceipts.map((receipt) => `${receipt.node_id}|${receipt.operation_id}|${receipt.interruption_point}`);
  const interruptionMismatch = multisetMismatch(actualInterruptions, expectedInterruptions)
    + multisetMismatch(actualRecoveries, expectedInterruptions);
  if (interruptionMismatch > 0) add('interruptionScenario', 'INTERRUPTION_MATRIX_MISMATCH', {
    expected: expectedInterruptions.length * 2, actual: actualInterruptions.length + actualRecoveries.length,
  }, interruptionMismatch);

  const recoveryByScenario = new Map(recoveryReceipts.map((entry) => [entry.scenario_id, entry]));
  for (const scenario of interruptionScenarios) {
    if (!scenario.idempotency_key || !validHash(scenario.request_hash)) add('identity', 'INTERRUPTION_IDENTITY_MISSING', { scenario_id: scenario.scenario_id });
    if (scenario.interrupted_classification === 'unclassified_partial_state') add('partial', 'UNCLASSIFIED_PARTIAL_STATE', { scenario_id: scenario.scenario_id });
    const cleanExpected = scenario.interruption_point !== 'during_provider_apply';
    if ((cleanExpected && scenario.interrupted_classification !== 'clean_transactional_rollback')
      || (!cleanExpected && scenario.interrupted_classification !== 'provider_applied_local_pending')) {
      add('partial', 'INTERRUPTION_CLASSIFICATION_MISMATCH', { scenario_id: scenario.scenario_id,
        point: scenario.interruption_point, classification: scenario.interrupted_classification });
    }
    const summary = scenario.terminal_summary ?? {};
    const receipt = recoveryByScenario.get(scenario.scenario_id);
    const fact = businessFacts.find((row) => row.scenario_id === scenario.scenario_id);
    if (summary.idempotency !== 1 || summary.business_facts !== 1 || summary.checkpoints !== 2 || summary.runtime_outbox !== 2
      || summary.audit_records !== 1 || summary.provider_commands !== 1 || summary.provider_resources !== 1
      || summary.provider_receipts !== 1 || summary.execution_state !== 'completed' || summary.provider_command_state !== 'completed'
      || !scenario.retry_business_number || fact?.business_number !== scenario.retry_business_number
      || receipt?.terminal_execution_state !== 'completed' || receipt?.provider_command_state !== 'completed'
      || receipt?.retry_business_number !== scenario.retry_business_number) {
      add('terminal', 'RECOVERY_TERMINAL_MISMATCH', { scenario_id: scenario.scenario_id, summary, receipt: receipt ?? null });
    }
    if (scenario.interruption_point === 'during_provider_apply') {
      if (receipt?.action_execution_count !== 1 || receipt?.provider_apply_attempt_count !== 2
        || receipt?.provider_receipt_reused_on_recovery !== true || receipt?.resumed_from !== 'provider_receipt') {
        add('terminal', 'PROVIDER_RECOVERY_DID_NOT_RESUME', { scenario_id: scenario.scenario_id, receipt: receipt ?? null });
      }
    } else if (receipt?.action_execution_count !== 2 || receipt?.provider_apply_attempt_count !== 1
      || receipt?.resumed_from !== 'clean_transaction_boundary') {
      add('terminal', 'TRANSACTION_RETRY_DID_NOT_REEXECUTE_CLEANLY', { scenario_id: scenario.scenario_id, receipt: receipt ?? null });
    }
  }

  const allScenarioIds = businessFacts.map((row) => row.scenario_id);
  for (const scenarioId of new Set(allScenarioIds)) {
    const commandCount = providerCommands.filter((row) => row.scenario_id === scenarioId).length;
    const resourceCount = providerResources.filter((row) => row.scenario_id === scenarioId).length;
    const receiptCount = providerReceipts.filter((row) => row.scenario_id === scenarioId).length;
    if (commandCount !== 1 || resourceCount !== 1 || receiptCount !== 1) {
      add('provider', 'PROVIDER_RECEIPT_CARDINALITY', { scenario_id: scenarioId, commandCount, resourceCount, receiptCount },
        Math.abs(commandCount - 1) + Math.abs(resourceCount - 1) + Math.abs(receiptCount - 1));
    }
  }
  const expectedTerminalScenarioCount = expectedBase.length + expectedInterruptions.length + criteriaValue.operation_matrix.length;
  if (new Set(allScenarioIds).size !== expectedTerminalScenarioCount) {
    add('provider', 'TERMINAL_PROVIDER_SCENARIO_COUNT', { expected: expectedTerminalScenarioCount,
      actual: new Set(allScenarioIds).size }, Math.abs(new Set(allScenarioIds).size - expectedTerminalScenarioCount));
  }

  counts.duplicate += duplicateExcess(businessFacts, (row) => row.scenario_id)
    + duplicateExcess(providerResources, (row) => row.scenario_id)
    + duplicateExcess(providerReceipts, (row) => row.scenario_id)
    + duplicateExcess(audits, (row) => row.resource_id)
    + duplicateExcess(outbox.filter((row) => row.event_type === 'runtime.operation.completed'), (row) => `${row.event_type}|${row.aggregate_id}`)
    + duplicateExcess(outbox.filter((row) => row.event_type === 'e09.business.prepared'), (row) => row.payload?.semanticKey);
  if (counts.duplicate > 0) violations.push(Object.freeze({ code: 'DUPLICATE_SIDE_EFFECT', detail: { excess: counts.duplicate } }));

  const comparisons = array(values.isolation?.comparisons);
  const expectedComparisonNodes = criteriaValue.node_matrix.map((node) => node.node_id);
  const comparisonMismatch = multisetMismatch(comparisons.map((entry) => entry.node_id), expectedComparisonNodes);
  if (comparisonMismatch > 0) add('nonTarget', 'ISOLATION_NODE_MATRIX_MISMATCH', { expectedComparisonNodes }, comparisonMismatch);
  for (const comparison of comparisons.filter((entry) => entry.role === 'non_target')) {
    if (comparison.changed || comparison.before_sha256 !== comparison.after_sha256 || comparison.before_row_count !== comparison.after_row_count) {
      add('nonTarget', 'NON_TARGET_NODE_CHANGED', comparison);
    }
  }
  const targetComparison = comparisons.find((entry) => entry.node_id === criteriaValue.target_recovery_node && entry.role === 'target');
  if (!targetComparison || targetComparison.before_sha256 === targetComparison.after_sha256 || targetComparison.after_row_count <= targetComparison.before_row_count) {
    add('terminal', 'TARGET_RECOVERY_NOT_OBSERVED', { target: targetComparison ?? null });
  }
  const targetReceipts = array(values.isolation?.target_recovery_receipts);
  if (targetReceipts.length !== criteriaValue.operation_matrix.length
    || targetReceipts.some((entry) => entry.interrupted_classification !== 'provider_applied_local_pending'
      || entry.provider_receipt_reused !== true || !entry.retry_business_number)) {
    add('terminal', 'TARGET_RECOVERY_RECEIPT_MISMATCH', { expected: criteriaValue.operation_matrix.length, actual: targetReceipts.length });
  }

  return Object.freeze({
    counts: Object.freeze(counts),
    violations: Object.freeze(violations),
    observations: Object.freeze({
      five_way_scenario_count: fiveScenarios.length,
      concurrent_delivery_count: fiveScenarios.reduce((total, scenario) => total + array(scenario.deliveries).length, 0),
      conflict_scenario_count: conflictScenarios.length,
      interruption_scenario_count: interruptionScenarios.length,
      recovery_receipt_count: recoveryReceipts.length,
      terminal_business_fact_count: businessFacts.length,
      provider_receipt_count: providerReceipts.length,
      audit_record_count: audits.length,
      runtime_outbox_count: outbox.length,
      target_recovery_count: targetReceipts.length,
    }),
  });
}

function runNegativeProbes(criteriaValue, values) {
  const probes = [];
  const duplicate = structuredClone(values);
  const firstFact = array(duplicate.databaseRows?.business_facts)[0];
  if (firstFact) duplicate.databaseRows.business_facts.push({ ...firstFact, business_number: `${firstFact.business_number}:duplicate` });
  const duplicateResult = reconcile(criteriaValue, duplicate);
  probes.push(Object.freeze({ probe_id: 'duplicate-business-side-effect', mutation: 'Append a second business fact for one scenario.',
    detected: duplicateResult.counts.duplicate > 0 || duplicateResult.counts.authority > 0 }));

  const conflict = structuredClone(values);
  const firstConflict = array(conflict.conflicts?.scenarios)[0];
  if (firstConflict) {
    firstConflict.after_sha256 = `sha256:${'f'.repeat(64)}`;
    firstConflict.state_change_count = 1;
  }
  const conflictResult = reconcile(criteriaValue, conflict);
  probes.push(Object.freeze({ probe_id: 'conflict-overwrite', mutation: 'Change the accepted-state digest after a conflicting request.',
    detected: conflictResult.counts.conflictChange > 0 }));

  const partial = structuredClone(values);
  const firstInterruption = array(partial.interruptions?.scenarios)[0];
  if (firstInterruption) firstInterruption.interrupted_classification = 'unclassified_partial_state';
  const partialResult = reconcile(criteriaValue, partial);
  probes.push(Object.freeze({ probe_id: 'unclassified-partial-state', mutation: 'Relabel one interruption as an unclassified partial state.',
    detected: partialResult.counts.partial > 0 }));

  const isolation = structuredClone(values);
  const firstNonTarget = array(isolation.isolation?.comparisons).find((entry) => entry.role === 'non_target');
  if (firstNonTarget) {
    firstNonTarget.changed = true;
    firstNonTarget.after_sha256 = `sha256:${'e'.repeat(64)}`;
  }
  const isolationResult = reconcile(criteriaValue, isolation);
  probes.push(Object.freeze({ probe_id: 'non-target-state-change', mutation: 'Change one non-target node snapshot digest.',
    detected: isolationResult.counts.nonTarget > 0 }));
  return Object.freeze(probes);
}

function duplicateExcess(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = key(row);
    if (value !== undefined && value !== null) counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
  }
  return [...counts.values()].reduce((total, count) => total + Math.max(0, count - 1), 0);
}

function multisetMismatch(actual, expected) {
  const counts = new Map();
  for (const value of expected) counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
  for (const value of actual) counts.set(String(value), (counts.get(String(value)) ?? 0) - 1);
  return [...counts.values()].reduce((total, value) => total + Math.abs(value), 0);
}

function validHash(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function threshold(thresholdId, expected, actual) {
  return Object.freeze({ threshold_id: thresholdId, expected, actual, met: actual === expected });
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function requireArray(value, name, missing, nonempty) {
  if (!Array.isArray(value) || (nonempty && value.length === 0)) missing.push(name);
}

function requireValue(value, name, missing) {
  if (value === undefined || value === null || value === '') missing.push(name);
}

function optionalJson(path) {
  return readFile(path, 'utf8').then(JSON.parse).catch(() => null);
}

function readJson(path) {
  return readFile(path, 'utf8').then(JSON.parse);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function option(name) {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`E09_ORACLE_OPTION_REQUIRED:${name}`);
  return value;
}
