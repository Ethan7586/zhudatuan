import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const runDirectory = resolve(option('--run-directory'));
const criteriaPath = resolve(option('--criteria'));
const outputPath = resolve(option('--output'));
const criteria = await requiredJson(criteriaPath, 'locked criteria');
const raw = {};
const inputArtifacts = [];
const loadMissing = [];

for (const name of criteria?.required_input_artifacts ?? []) {
  const path = join(runDirectory, name);
  try {
    const bytes = await readFile(path);
    raw[name] = name.endsWith('.jsonl') ? parseJsonLines(bytes.toString('utf8')) : JSON.parse(bytes.toString('utf8'));
    inputArtifacts.push(Object.freeze({ path: name, sha256: `sha256:${sha256(bytes)}`, size_bytes: bytes.byteLength }));
  } catch (cause) {
    loadMissing.push(`${name}: ${errorMessage(cause)}`);
  }
}

const baseline = recount(criteria, raw);
baseline.missing_items.push(...loadMissing);
const negativeProbes = runNegativeProbes(criteria, raw, baseline.metrics);
const negativeProbeMissCount = negativeProbes.filter((entry) => !entry.detected).length;
const thresholds = createThresholds(criteria, baseline.metrics, baseline.missing_items.length, negativeProbeMissCount);
const unmet = thresholds.filter((entry) => !entry.met);
const claimOutcome = baseline.missing_items.length > 0 ? 'UNKNOWN' : unmet.length > 0 ? 'NOT MET' : 'MET';
const output = Object.freeze({
  schema_version: 'e03-independent-recount-v1',
  oracle_id: 'E2-ORACLE-E03-TRUTH-TABLE',
  executed_at: new Date().toISOString(),
  criteria_id: criteria?.criteria_id ?? null,
  reads_test_program_pass: false,
  input_artifacts: inputArtifacts,
  metrics: Object.freeze({ ...baseline.metrics, required_raw_evidence_missing_count: baseline.missing_items.length,
    negative_oracle_probe_miss_count: negativeProbeMissCount }),
  thresholds,
  missing_items: baseline.missing_items,
  contradictions: baseline.contradictions,
  negative_probes: negativeProbes,
  claim_outcome: claimOutcome,
  environment_assurance: claimOutcome === 'MET' ? 'DEV VERIFIED' : 'NOT ESTABLISHED',
  review_assurance: 'NOT REVIEWED',
});
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' });

function recount(criteriaValue, artifacts) {
  const missing = [];
  const contradictions = [];
  const expectedArtifact = artifacts['truth-table-expected.json'];
  const observedArtifact = artifacts['truth-table-observed.json'];
  const contexts = artifacts['authorization-contexts.json'];
  const decisions = array(artifacts['authorization-decisions.jsonl']);
  const effectsArtifact = artifacts['side-effect-diffs.json'];
  const providerArtifact = artifacts['provider-call-log.json'];
  const environment = artifacts['environment.json'];
  const expectedRows = generateExpectedRows(criteriaValue);
  const samples = array(contexts?.samples);
  const operations = array(contexts?.operations);
  const surfaces = array(criteriaValue?.surfaces);
  const observedRows = array(observedArtifact?.rows);
  const effects = array(effectsArtifact?.observations);
  const providerCalls = array(providerArtifact?.calls);

  requireValue(criteriaValue?.claim_id === 'E2-AUTH-001' && criteriaValue?.legacy_trace_id === 'E03',
    'recognized prelocked E03 criteria', missing);
  requireValue(array(criteriaValue?.dimensions).length === 5, 'five ordered dimensions', missing);
  requireValue(expectedRows.length === 32, '32 independently generated expected rows', missing);
  requireValue(array(expectedArtifact?.rows).length === 32, '32-row expected artifact', missing);
  requireValue(observedRows.length === 32, '32-row observed artifact', missing);
  requireValue(samples.length === 3, 'three node/Membership contexts', missing);
  requireValue(operations.length === 2, 'read and write Operations', missing);
  requireValue(surfaces.length === 4, 'four authorization surfaces', missing);
  requireValue(typeof environment?.kind === 'string', 'environment classification', missing);

  let expectedArtifactMismatch = 0;
  const suppliedExpected = new Map(array(expectedArtifact?.rows).map((row) => [row?.row_id, row]));
  for (const expected of expectedRows) {
    const supplied = suppliedExpected.get(expected.row_id);
    if (!supplied || supplied.mask !== expected.mask || !sameJson(supplied.inputs, expected.inputs)
      || supplied.expected_allowed !== expected.expected_allowed || supplied.expected_reason !== expected.expected_reason) {
      expectedArtifactMismatch += 1;
    }
  }

  let contextMismatch = 0;
  if (contexts?.shared_principal_id === undefined || new Set(samples.map((entry) => entry?.principal_id)).size !== 1
    || samples.some((entry) => entry?.principal_id !== contexts?.shared_principal_id)
    || new Set(samples.map((entry) => entry?.membership_id)).size !== 3) contextMismatch += 1;
  for (const expectedSample of array(criteriaValue?.node_membership_matrix)) {
    const actual = samples.find((entry) => entry?.sample_id === expectedSample?.sample_id);
    if (!actual || ['sovereignty_tier', 'node_profile', 'signed_level', 'membership_client']
      .some((field) => actual[field] !== expectedSample[field])) contextMismatch += 1;
  }
  for (const expectedOperation of array(criteriaValue?.operation_matrix)) {
    const actual = operations.find((entry) => entry?.kind === expectedOperation?.kind);
    if (!actual || actual.operation !== expectedOperation.operation || actual.permission !== expectedOperation.permission) contextMismatch += 1;
  }

  const observedByRow = groupBy(observedRows, (entry) => entry?.row_id);
  const decisionByTrace = groupBy(decisions, (entry) => entry?.trace_id);
  const effectByTrace = groupBy(effects, (entry) => entry?.correlation_id);
  const providerByTrace = groupBy(providerCalls, (entry) => entry?.correlation_id);
  const correlations = new Set();
  let rawCaseDecisionCount = 0;
  let allTrueAllowCount = 0;
  let deniedCaseCount = 0;
  let decisionMismatchCount = 0;
  let denialReasonMismatchCount = 0;
  let missingCorrelationCount = 0;
  let crossSurfaceInconsistencyCount = 0;
  let surfaceRowCountMismatchCount = 0;
  let decisionAuditMismatchCount = 0;
  let decisionAllowedCount = 0;
  let decisionDeniedCount = 0;
  let positiveSurfaceBehaviorMismatchCount = 0;
  const deniedEffects = { business_write_count: 0, outbox_append_count: 0, task_enqueue_count: 0, provider_call_count: 0 };

  for (const surface of surfaces) {
    const count = observedRows.filter((row) => array(row?.surfaces).some((entry) => entry?.surface === surface)).length;
    if (count !== 32) surfaceRowCountMismatchCount += Math.abs(32 - count) || 1;
  }

  for (const expected of expectedRows) {
    const rowMatches = observedByRow.get(expected.row_id) ?? [];
    if (rowMatches.length !== 1) {
      missing.push(`one observed row for ${expected.row_id}`);
      continue;
    }
    const row = rowMatches[0];
    if (row.mask !== expected.mask || !sameJson(row.inputs, expected.inputs)) decisionMismatchCount += 1;
    const perCombination = new Map();
    for (const surface of surfaces) {
      const surfaceMatches = array(row.surfaces).filter((entry) => entry?.surface === surface);
      if (surfaceMatches.length !== 1) {
        missing.push(`${expected.row_id} ${surface} observation`);
        continue;
      }
      const cases = array(surfaceMatches[0]?.cases);
      for (const sample of samples) {
        for (const operation of operations) {
          const matches = cases.filter((entry) => entry?.sample_id === sample?.sample_id
            && entry?.operation_kind === operation?.kind);
          if (matches.length !== 1) {
            missing.push(`${expected.row_id} ${surface} ${sample?.sample_id ?? 'sample?'} ${operation?.kind ?? 'operation?'} case`);
            continue;
          }
          const item = matches[0];
          rawCaseDecisionCount += 1;
          const trace = typeof item?.correlation_id === 'string' ? item.correlation_id : '';
          if (!trace || correlations.has(trace) || item?.response?.correlation_id !== trace) missingCorrelationCount += 1;
          if (trace) correlations.add(trace);
          const available = item?.response?.available === true;
          const reason = item?.response?.reason;
          const status = Number(item?.response?.http_status);
          if (available) allTrueAllowCount += 1;
          else deniedCaseCount += 1;
          if (available !== expected.expected_allowed || status !== (expected.expected_allowed ? 200 : 403)) decisionMismatchCount += 1;
          if (reason !== expected.expected_reason) denialReasonMismatchCount += 1;
          const combination = `${expected.row_id}:${sample?.sample_id}:${operation?.kind}`;
          const values = perCombination.get(combination) ?? [];
          values.push(`${available}:${reason}`);
          perCombination.set(combination, values);

          const decisionRows = decisionByTrace.get(trace) ?? [];
          if (decisionRows.length !== 1) {
            decisionAuditMismatchCount += 1;
          } else {
            const decision = decisionRows[0];
            if (decision?.decision === 'allow') decisionAllowedCount += 1;
            if (decision?.decision === 'deny') decisionDeniedCount += 1;
            if (decision?.operation !== operation?.operation
              || decision?.decision !== (expected.expected_allowed ? 'allow' : 'deny')
              || decision?.reason !== expected.expected_reason) decisionAuditMismatchCount += 1;
          }

          const effectRows = effectByTrace.get(trace) ?? [];
          if (effectRows.length !== 1) {
            missing.push(`one direct side-effect diff for ${trace || 'missing correlation'}`);
          } else {
            const effect = effectRows[0];
            if (Number(effect?.delta?.decision_append_count) !== 1) decisionAuditMismatchCount += 1;
            if (!expected.expected_allowed) {
              for (const key of Object.keys(deniedEffects)) deniedEffects[key] += numeric(effect?.delta?.[key]);
            } else if (!positiveEffectMatches(surface, operation?.kind, effect?.delta)) {
              positiveSurfaceBehaviorMismatchCount += 1;
            }
          }
          if (expected.expected_allowed && !positiveResponseMatches(surface, operation?.kind, item?.response?.action)) {
            positiveSurfaceBehaviorMismatchCount += 1;
          }
          const providerRows = providerByTrace.get(trace) ?? [];
          const expectedProviderCount = expected.expected_allowed && surface === 'service' ? 1 : 0;
          if (providerRows.length !== expectedProviderCount) {
            if (!expected.expected_allowed) deniedEffects.provider_call_count += providerRows.length;
            else positiveSurfaceBehaviorMismatchCount += 1;
          }
        }
      }
      if (cases.length !== samples.length * operations.length) missing.push(`${expected.row_id} ${surface} exact six-case set`);
    }
    for (const values of perCombination.values()) if (new Set(values).size !== 1 || values.length !== 4) crossSurfaceInconsistencyCount += 1;
  }

  const expectedCorrelations = 32 * surfaces.length * samples.length * operations.length;
  if (correlations.size !== expectedCorrelations) missingCorrelationCount += Math.abs(expectedCorrelations - correlations.size);
  const duplicateDecisionCount = decisions.length - decisionByTrace.size;
  const duplicateEffectCount = effects.length - effectByTrace.size;
  if (duplicateDecisionCount > 0) decisionAuditMismatchCount += duplicateDecisionCount;
  if (duplicateEffectCount > 0) missingCorrelationCount += duplicateEffectCount;

  let globalDatabaseSnapshotMismatchCount = 0;
  const fixtureBefore = effectsArtifact?.fixture_before;
  const established = effectsArtifact?.established_before_matrix;
  const after = effectsArtifact?.after_matrix;
  if (array(fixtureBefore?.business_rows).length !== 0 || array(fixtureBefore?.outbox_rows).length !== 0
    || array(fixtureBefore?.task_rows).length !== 0 || array(fixtureBefore?.decision_rows).length !== 0) globalDatabaseSnapshotMismatchCount += 1;
  if (array(established?.business_rows).length !== 3 || array(established?.outbox_rows).length !== 0
    || array(established?.task_rows).length !== 0 || array(established?.decision_rows).length !== 0) globalDatabaseSnapshotMismatchCount += 1;
  if (array(after?.business_rows).length !== 6 || array(after?.outbox_rows).length !== 3
    || array(after?.task_rows).length !== 3 || array(after?.decision_rows).length !== 768) globalDatabaseSnapshotMismatchCount += 1;
  if (providerCalls.length !== 6) globalDatabaseSnapshotMismatchCount += 1;

  const environmentMismatchCount = environment?.kind === 'DEV'
    && (environment?.formal_execution === false || environment?.source_control?.tree_state === 'CLEAN')
    && Number(environment?.runtime?.migration_count) > 0
    && environment?.real_customer_data === false
    && environment?.production_impact?.startsWith('None') ? 0 : 1;

  const metrics = {
    expected_truth_table_row_count: expectedRows.length,
    expected_artifact_mismatch_count: expectedArtifactMismatch,
    observed_truth_table_row_count: observedRows.length,
    surface_row_count_mismatch_count: surfaceRowCountMismatchCount,
    node_membership_context_count: samples.length,
    operation_count: operations.length,
    context_mismatch_count: contextMismatch,
    raw_case_decision_count: rawCaseDecisionCount,
    observed_allow_count: allTrueAllowCount,
    observed_deny_count: deniedCaseCount,
    expected_observed_mismatch_count: decisionMismatchCount,
    cross_surface_inconsistency_count: crossSurfaceInconsistencyCount,
    denial_reason_mismatch_count: denialReasonMismatchCount,
    missing_or_duplicate_correlation_count: missingCorrelationCount,
    decision_audit_count: decisions.length,
    decision_audit_allowed_count: decisionAllowedCount,
    decision_audit_denied_count: decisionDeniedCount,
    decision_audit_mismatch_count: decisionAuditMismatchCount,
    denied_business_write_count: deniedEffects.business_write_count,
    denied_outbox_append_count: deniedEffects.outbox_append_count,
    denied_task_enqueue_count: deniedEffects.task_enqueue_count,
    denied_provider_call_count: deniedEffects.provider_call_count,
    positive_surface_behavior_mismatch_count: positiveSurfaceBehaviorMismatchCount,
    global_database_snapshot_mismatch_count: globalDatabaseSnapshotMismatchCount,
    environment_mismatch_count: environmentMismatchCount,
  };
  for (const [key, value] of Object.entries(metrics)) if (value !== expectedMetric(criteriaValue, key)) {
    contradictions.push(`${key}: expected ${expectedMetric(criteriaValue, key)}, observed ${value}`);
  }
  return { metrics, missing_items: [...new Set(missing)], contradictions };
}

function createThresholds(criteria, metrics, missingCount, mutationMissCount) {
  return [
    threshold('required_raw_evidence_missing_count', 0, missingCount),
    threshold('expected_truth_table_row_count', 32, metrics.expected_truth_table_row_count),
    threshold('expected_artifact_mismatch_count', 0, metrics.expected_artifact_mismatch_count),
    threshold('observed_truth_table_row_count', 32, metrics.observed_truth_table_row_count),
    threshold('surface_row_count_mismatch_count', 0, metrics.surface_row_count_mismatch_count),
    threshold('node_membership_context_count', 3, metrics.node_membership_context_count),
    threshold('operation_count', 2, metrics.operation_count),
    threshold('context_mismatch_count', 0, metrics.context_mismatch_count),
    threshold('raw_case_decision_count', criteria.truth_table_threshold.raw_case_decision_count, metrics.raw_case_decision_count),
    threshold('observed_allow_count', criteria.truth_table_threshold.all_true_raw_case_allow_count, metrics.observed_allow_count),
    threshold('observed_deny_count', criteria.truth_table_threshold.denied_raw_case_count, metrics.observed_deny_count),
    threshold('expected_observed_mismatch_count', 0, metrics.expected_observed_mismatch_count),
    threshold('cross_surface_inconsistency_count', 0, metrics.cross_surface_inconsistency_count),
    threshold('denial_reason_mismatch_count', 0, metrics.denial_reason_mismatch_count),
    threshold('missing_or_duplicate_correlation_count', 0, metrics.missing_or_duplicate_correlation_count),
    threshold('decision_audit_count', criteria.decision_audit_threshold.decision_count, metrics.decision_audit_count),
    threshold('decision_audit_allowed_count', criteria.decision_audit_threshold.allowed_count, metrics.decision_audit_allowed_count),
    threshold('decision_audit_denied_count', criteria.decision_audit_threshold.denied_count, metrics.decision_audit_denied_count),
    threshold('decision_audit_mismatch_count', 0, metrics.decision_audit_mismatch_count),
    threshold('denied_business_write_count', 0, metrics.denied_business_write_count),
    threshold('denied_outbox_append_count', 0, metrics.denied_outbox_append_count),
    threshold('denied_task_enqueue_count', 0, metrics.denied_task_enqueue_count),
    threshold('denied_provider_call_count', 0, metrics.denied_provider_call_count),
    threshold('positive_surface_behavior_mismatch_count', 0, metrics.positive_surface_behavior_mismatch_count),
    threshold('global_database_snapshot_mismatch_count', 0, metrics.global_database_snapshot_mismatch_count),
    threshold('environment_mismatch_count', 0, metrics.environment_mismatch_count),
    threshold('negative_oracle_probe_miss_count', 0, mutationMissCount),
  ];
}

function expectedMetric(criteria, key) {
  const exact = {
    expected_truth_table_row_count: 32,
    expected_artifact_mismatch_count: 0,
    observed_truth_table_row_count: 32,
    surface_row_count_mismatch_count: 0,
    node_membership_context_count: 3,
    operation_count: 2,
    context_mismatch_count: 0,
    raw_case_decision_count: criteria?.truth_table_threshold?.raw_case_decision_count ?? 768,
    observed_allow_count: criteria?.truth_table_threshold?.all_true_raw_case_allow_count ?? 24,
    observed_deny_count: criteria?.truth_table_threshold?.denied_raw_case_count ?? 744,
    expected_observed_mismatch_count: 0,
    cross_surface_inconsistency_count: 0,
    denial_reason_mismatch_count: 0,
    missing_or_duplicate_correlation_count: 0,
    decision_audit_count: criteria?.decision_audit_threshold?.decision_count ?? 768,
    decision_audit_allowed_count: criteria?.decision_audit_threshold?.allowed_count ?? 24,
    decision_audit_denied_count: criteria?.decision_audit_threshold?.denied_count ?? 744,
    decision_audit_mismatch_count: 0,
    denied_business_write_count: 0,
    denied_outbox_append_count: 0,
    denied_task_enqueue_count: 0,
    denied_provider_call_count: 0,
    positive_surface_behavior_mismatch_count: 0,
    global_database_snapshot_mismatch_count: 0,
    environment_mismatch_count: 0,
  };
  return exact[key];
}

function runNegativeProbes(criteria, artifacts, baselineMetrics) {
  const probes = [];
  const falseAllow = structuredClone(artifacts);
  const deniedCase = firstCase(falseAllow['truth-table-observed.json'], (entry) => entry?.response?.available === false);
  if (deniedCase) {
    deniedCase.response.available = true;
    deniedCase.response.reason = 'POLICY_ALLOWED';
    deniedCase.response.http_status = 200;
  }
  const falseAllowResult = recount(criteria, falseAllow).metrics;
  probes.push(Object.freeze({
    probe_id: 'false-allow',
    mutation: 'Flip one denied surface response to allowed.',
    detected: Boolean(deniedCase) && falseAllowResult.expected_observed_mismatch_count > baselineMetrics.expected_observed_mismatch_count,
  }));

  const wrongReason = structuredClone(artifacts);
  const reasonCase = firstCase(wrongReason['truth-table-observed.json'], (entry) => entry?.response?.available === false);
  if (reasonCase) reasonCase.response.reason = 'RESOURCE_NOT_READY';
  const wrongReasonResult = recount(criteria, wrongReason).metrics;
  probes.push(Object.freeze({
    probe_id: 'wrong-denial-reason',
    mutation: 'Replace one denied response reason with a non-authoritative later-factor reason.',
    detected: Boolean(reasonCase) && wrongReasonResult.denial_reason_mismatch_count > baselineMetrics.denial_reason_mismatch_count,
  }));

  const deniedProvider = structuredClone(artifacts);
  const deniedEffect = array(deniedProvider['side-effect-diffs.json']?.observations)
    .find((entry) => entry?.surface === 'service' && String(entry?.correlation_id).includes(':tt-00:'));
  if (deniedEffect) deniedEffect.delta.provider_call_count = 1;
  const deniedProviderResult = recount(criteria, deniedProvider).metrics;
  probes.push(Object.freeze({
    probe_id: 'denied-provider-effect',
    mutation: 'Inject one Provider-call delta into a denied service case.',
    detected: Boolean(deniedEffect) && deniedProviderResult.denied_provider_call_count > baselineMetrics.denied_provider_call_count,
  }));
  return Object.freeze(probes);
}

function generateExpectedRows(criteria) {
  const dimensions = array(criteria?.dimensions);
  const order = array(criteria?.dimension_order);
  if (dimensions.length !== 5 || order.length !== 5) return [];
  return Array.from({ length: 32 }, (_, mask) => {
    const inputs = Object.fromEntries(dimensions.map((dimension, index) => [dimension, Boolean(mask & (1 << index))]));
    const expectedAllowed = dimensions.every((dimension) => inputs[dimension]);
    const unmet = order.find((entry) => !inputs[entry?.dimension]);
    return Object.freeze({
      row_id: `TT-${String(mask).padStart(2, '0')}`,
      mask,
      inputs,
      expected_allowed: expectedAllowed,
      expected_reason: expectedAllowed ? 'POLICY_ALLOWED' : unmet?.denial_reason ?? 'AUTHORIZATION_FAILED',
    });
  });
}

function positiveEffectMatches(surface, operationKind, delta) {
  const actual = {
    business_write_count: numeric(delta?.business_write_count),
    outbox_append_count: numeric(delta?.outbox_append_count),
    task_enqueue_count: numeric(delta?.task_enqueue_count),
    provider_call_count: numeric(delta?.provider_call_count),
    decision_append_count: numeric(delta?.decision_append_count),
  };
  const expected = { business_write_count: 0, outbox_append_count: 0, task_enqueue_count: 0,
    provider_call_count: 0, decision_append_count: 1 };
  if (surface === 'api' && operationKind === 'write') {
    expected.business_write_count = 1;
    expected.outbox_append_count = 1;
  }
  if (surface === 'task' && operationKind === 'write') expected.task_enqueue_count = 1;
  if (surface === 'service') expected.provider_call_count = 1;
  return sameJson(actual, expected);
}

function positiveResponseMatches(surface, operationKind, action) {
  if (action?.invoked !== true) return false;
  if (surface === 'page') return action.presentation === (operationKind === 'read' ? 'visible' : 'actionable');
  if (surface === 'api' && operationKind === 'read') return action.read_row_count === 1;
  if (surface === 'api') return typeof action.business_write_id === 'string' && typeof action.outbox_id === 'string';
  if (surface === 'task' && operationKind === 'read') return action.task_execution === 'completed-without-write';
  if (surface === 'task') return typeof action.task_enqueue_id === 'string';
  return typeof action.provider === 'string' && typeof action.receipt_id === 'string';
}

function firstCase(observed, predicate) {
  for (const row of array(observed?.rows)) {
    for (const surface of array(row?.surfaces)) {
      const found = array(surface?.cases).find(predicate);
      if (found) return found;
    }
  }
  return null;
}

function groupBy(values, key) {
  const grouped = new Map();
  for (const value of values) {
    const candidate = key(value);
    const existing = grouped.get(candidate) ?? [];
    existing.push(value);
    grouped.set(candidate, existing);
  }
  return grouped;
}

function threshold(thresholdId, expected, actual) {
  return Object.freeze({ threshold_id: thresholdId, expected, actual, met: actual === expected });
}

function requireValue(condition, label, missing) {
  if (!condition) missing.push(label);
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function requiredJson(path, label) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (cause) {
    throw new Error(`E03_${label.toUpperCase().replaceAll(' ', '_')}_UNREADABLE:${errorMessage(cause)}`);
  }
}

function parseJsonLines(value) {
  return value.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) throw new Error(`E03_OPTION_REQUIRED:${name}`);
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`E03_OPTION_VALUE_REQUIRED:${name}`);
  return value;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function errorMessage(cause) {
  return cause instanceof Error ? cause.message : String(cause);
}
