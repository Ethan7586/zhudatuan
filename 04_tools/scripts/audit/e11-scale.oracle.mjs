import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const runDirectory = option('--run-directory');
const criteriaPath = option('--criteria');
const outputPath = option('--output');
const inputNames = Object.freeze(['scale-input-manifest.json', 'scale-code-and-build-counts.json', 'scale-hosted-operation-counts.json', 'scale-context-resolution-metrics.json', 'scale-isolation-results.json', 'environment.json']);
const [criteria, manifest, codeAndBuild, hostedOperations, resolutionMetrics, isolationResults, environment] = await Promise.all([readJson(criteriaPath), ...inputNames.map((name) => readJson(join(runDirectory, name)))]);

const missingItems = requiredEvidence(criteria, manifest, codeAndBuild, hostedOperations, resolutionMetrics, isolationResults, environment);
const baseline = reconcile(criteria, manifest, codeAndBuild, hostedOperations, resolutionMetrics, isolationResults, environment);
const negativeProbes = runNegativeProbes(criteria, manifest, codeAndBuild, hostedOperations, resolutionMetrics, isolationResults, environment);
const thresholds = Object.freeze([
  threshold('required_raw_evidence_missing_count', 0, missingItems.length),
  threshold('scale_topology_scenario_completeness_mismatch_count', 0, baseline.counts.scenario),
  threshold('business_source_file_count_delta', 0, baseline.observations.source_file_count_delta),
  threshold('business_source_inventory_digest_change_count', 0, baseline.observations.source_digest_change_count),
  threshold('source_inventory_recount_mismatch_count', 0, baseline.counts.source),
  threshold('node_specific_business_source_file_count', 0, baseline.observations.node_specific_source_file_count),
  threshold('build_count', 1, baseline.observations.build_count),
  threshold('artifact_identity_count', 1, baseline.observations.artifact_identity_count),
  threshold('build_provenance_mismatch_count', 0, baseline.counts.build),
  threshold('node_specific_build_count', 0, baseline.observations.node_specific_build_count),
  threshold('hosted_per_node_infrastructure_action_total', 0, baseline.observations.infrastructure_action_total),
  threshold('hosted_per_node_infrastructure_action_scale_delta', 0, baseline.observations.infrastructure_action_scale_delta),
  threshold('context_scope_capability_and_control_mismatch_count', 0, baseline.counts.resolution),
  threshold('isolation_aggregate_mismatch_count', 0, baseline.counts.isolation),
  threshold('duplicate_node_and_cross_line_row_count', 0, baseline.observations.duplicate_and_cross_line_row_count),
  threshold('missing_or_malformed_latency_sample_count', 0, baseline.counts.latency),
  threshold('negative_oracle_probe_miss_count', 0, negativeProbes.filter((entry) => !entry.detected).length),
]);
const contradiction = thresholds.some((entry) => entry.threshold_id !== 'required_raw_evidence_missing_count' && !entry.met);
const claimOutcome = missingItems.length > 0 ? 'UNKNOWN' : contradiction ? 'NOT MET' : 'MET';
const inputArtifacts = await Promise.all(
  [criteriaPath, ...inputNames.map((name) => join(runDirectory, name))].map(async (path) => {
    const bytes = await readFile(path);
    return Object.freeze({ path: basename(path), sha256: `sha256:${sha256(bytes)}`, size_bytes: bytes.byteLength });
  })
);
const output = Object.freeze({
  schema_version: 'e11-independent-scale-recount-v1',
  oracle_id: criteria.independent_oracle.oracle_id,
  executed_at: new Date().toISOString(),
  reads_test_program_pass: false,
  input_artifacts: inputArtifacts,
  missing_items: missingItems,
  violations: baseline.violations,
  negative_probes: negativeProbes,
  latency_observations: baseline.latency,
  thresholds,
  claim_outcome: claimOutcome,
  environment_assurance: claimOutcome === 'MET' && environment.kind === 'DEV' ? 'DEV VERIFIED' : 'NOT ESTABLISHED',
});
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' });

function requiredEvidence(criteriaValue, manifestValue, codeValue, operationsValue, metricsValue, isolationValue, environmentValue) {
  const missing = [];
  const expectedIds = expectedScenarioIds(criteriaValue);
  requireValue(manifestValue.run_token, 'manifest run token', missing);
  requireArray(manifestValue.scenarios, 'manifest scenarios', missing, true);
  requireArray(codeValue.source_inventory_snapshots, 'source inventory snapshots', missing, true);
  requireArray(codeValue.build_invocations, 'build invocations', missing, true);
  requireArray(codeValue.artifacts, 'built artifacts', missing, true);
  requireArray(codeValue.scenario_artifact_assignments, 'scenario artifact assignments', missing, true);
  requireArray(codeValue.node_specific_builds, 'node-specific build ledger', missing, false);
  requireArray(operationsValue.scenarios, 'Hosted operation scenarios', missing, true);
  requireArray(operationsValue.per_node_infrastructure_events, 'Hosted per-node infrastructure event ledger', missing, false);
  requireArray(metricsValue.scenarios, 'context resolution scenarios', missing, true);
  requireArray(isolationValue.scenarios, 'isolation scenarios', missing, true);
  requireValue(codeValue.source_sha, 'source inventory and build source SHA', missing);
  for (const [value, name] of [
    [environmentValue.kind, 'environment kind'],
    [environmentValue.environment_id, 'environment identity'],
    [environmentValue.runtime?.postgres, 'PostgreSQL runtime version'],
    [environmentValue.runtime?.docker_image_id, 'PostgreSQL image identity'],
    [environmentValue.source_control?.sha, 'source commit SHA'],
    [environmentValue.source_control?.tree_state, 'source tree state'],
    [environmentValue.configuration_digest, 'configuration digest'],
  ])
    requireValue(value, name, missing);
  for (const build of array(codeValue.build_invocations)) {
    for (const field of ['invocation_id', 'scope', 'source_sha', 'started_at', 'completed_at', 'exit_code']) requireValue(build?.[field], `build invocation ${field}`, missing);
  }
  for (const artifact of array(codeValue.artifacts)) {
    for (const field of ['artifact_identity', 'target', 'source_sha', 'marker']) requireValue(artifact?.[field], `built artifact ${field}`, missing);
    requireArray(artifact?.files, 'built artifact file inventory', missing, true);
    for (const file of array(artifact?.files)) {
      for (const field of ['path', 'size_bytes', 'sha256']) requireValue(file?.[field], `built artifact file ${field}`, missing);
    }
  }
  for (const assignment of array(codeValue.scenario_artifact_assignments)) {
    requireValue(assignment?.scenario_id, 'artifact assignment scenario id', missing);
    requireValue(assignment?.artifact_identity, 'artifact assignment identity', missing);
  }

  const manifestScenarios = byScenario(manifestValue.scenarios);
  const operationScenarios = byScenario(operationsValue.scenarios);
  const metricScenarios = byScenario(metricsValue.scenarios);
  const isolationScenarios = byScenario(isolationValue.scenarios);
  for (const scenarioId of expectedIds) {
    const scenario = manifestScenarios.get(scenarioId);
    const operations = operationScenarios.get(scenarioId);
    const metrics = metricScenarios.get(scenarioId);
    const isolation = isolationScenarios.get(scenarioId);
    requireObject(scenario, `manifest scenario ${scenarioId}`, missing);
    requireObject(operations, `Hosted operation scenario ${scenarioId}`, missing);
    requireObject(metrics, `resolution scenario ${scenarioId}`, missing);
    requireObject(isolation, `isolation scenario ${scenarioId}`, missing);
    if (!scenario) continue;
    requireArray(scenario.fixture_roots, `${scenarioId} fixture roots`, missing, true);
    requireArray(scenario.sovereign_controls, `${scenarioId} sovereign controls`, missing, true);
    requireArray(scenario.generated_nodes, `${scenarioId} generated nodes`, missing, true);
    const expectedNodeCount = Number(scenario.node_count);
    if (array(scenario.generated_nodes).length < expectedNodeCount) missing.push(`${scenarioId} generated node descriptors`);
    if (array(scenario.sovereign_controls).length < criteriaValue.scale_matrix.sovereign_control_count_per_scenario) missing.push(`${scenarioId} sovereign controls`);
    for (const node of [...array(scenario.fixture_roots), ...array(scenario.sovereign_controls), ...array(scenario.generated_nodes)]) {
      for (const field of ['node_id', 'line_id', 'signed_level', 'sovereignty_tier', 'node_profile', 'realm_id', 'host_sovereign_node_id', 'status', 'relation_version']) {
        requireValue(node?.[field], `${scenarioId} node descriptor ${field}`, missing);
      }
      requireArray(node?.ancestors, `${scenarioId} node descriptor ancestors`, missing, false);
    }
    if (operations) {
      requireValue(operations.scale, `${scenarioId} Hosted operation scale`, missing);
      requireValue(operations.hosted_database_provision_call_count, `${scenarioId} Hosted database provision count`, missing);
      requireArray(operations.per_node_infrastructure_events, `${scenarioId} infrastructure events`, missing, false);
    }
    if (metrics) {
      requireArray(metrics.provisioning_samples, `${scenarioId} provisioning samples`, missing, true);
      requireArray(metrics.resolution_samples, `${scenarioId} resolution samples`, missing, true);
      requireArray(metrics.sovereign_control_samples, `${scenarioId} control samples`, missing, true);
      if (array(metrics.provisioning_samples).length < expectedNodeCount) missing.push(`${scenarioId} provisioning outputs`);
      if (array(metrics.resolution_samples).length < expectedNodeCount) missing.push(`${scenarioId} resolution outputs`);
      if (array(metrics.sovereign_control_samples).length < criteriaValue.scale_matrix.sovereign_control_count_per_scenario) missing.push(`${scenarioId} sovereign control outputs`);
      for (const sample of array(metrics.provisioning_samples)) {
        requireValue(sample?.node_id, `${scenarioId} provisioning sample node id`, missing);
        requireValue(sample?.elapsed_ms, `${scenarioId} ${sample?.node_id ?? 'unknown node'} provisioning latency`, missing);
        requireObject(sample?.result, `${scenarioId} ${sample?.node_id ?? 'unknown node'} provisioning result`, missing);
      }
      for (const sample of [...array(metrics.resolution_samples), ...array(metrics.sovereign_control_samples)]) {
        requireValue(sample?.node_id, `${scenarioId} resolution sample node id`, missing);
        requireValue(sample?.elapsed_ms, `${scenarioId} ${sample?.node_id ?? 'unknown node'} resolution latency`, missing);
        for (const field of ['context', 'scope_self', 'ancestors', 'capability']) {
          if (sample?.[field] === undefined || sample?.[field] === null) missing.push(`${scenarioId} ${sample?.node_id ?? 'unknown node'} ${field}`);
        }
      }
    }
    if (isolation) {
      requireObject(isolation.database_counts, `${scenarioId} database counts`, missing);
      for (const field of ['duplicate_node_ids', 'cross_line_closure_rows', 'cross_line_scope_rows', 'profile_counts']) {
        requireArray(isolation[field], `${scenarioId} ${field}`, missing, false);
      }
      for (const field of ['hosted_nodes', 'provisioning_rows', 'realm_rows', 'current_relation_rows', 'capability_rows', 'closure_rows']) {
        requireValue(isolation.database_counts?.[field], `${scenarioId} database count ${field}`, missing);
      }
      for (const field of ['distinct_line_count', 'maximum_signed_level', 'sovereign_control_count']) requireValue(isolation[field], `${scenarioId} isolation ${field}`, missing);
      requireValue(isolation.rollback_remaining_token_row_count, `${scenarioId} rollback recount`, missing);
    }
  }
  for (const scale of criteriaValue.scale_matrix.node_counts) {
    const snapshot = array(codeValue.source_inventory_snapshots).find((entry) => Number(entry.scale) === Number(scale));
    requireObject(snapshot, `source inventory at scale ${scale}`, missing);
    if (snapshot) {
      requireValue(snapshot.file_count, `source file count at scale ${scale}`, missing);
      requireValue(snapshot.inventory_digest, `source digest at scale ${scale}`, missing);
      requireArray(snapshot.entries, `source entries at scale ${scale}`, missing, true);
      for (const entry of array(snapshot.entries)) {
        for (const field of ['path', 'size_bytes', 'sha256']) requireValue(entry?.[field], `source entry ${field} at scale ${scale}`, missing);
      }
    }
  }
  return Object.freeze([...new Set(missing)].sort());
}

function reconcile(criteriaValue, manifestValue, codeValue, operationsValue, metricsValue, isolationValue, environmentValue) {
  const counts = { scenario: 0, source: 0, build: 0, resolution: 0, isolation: 0, latency: 0 };
  const violations = [];
  const add = (category, code, detail, weight = 1) => {
    counts[category] += Math.max(1, Math.abs(number(weight)));
    violations.push(Object.freeze({ category, code, detail }));
  };
  const expectedIds = expectedScenarioIds(criteriaValue);
  const expectedIdSet = new Set(expectedIds);
  for (const [name, ids] of [
    ['manifest', array(manifestValue.scenarios).map((entry) => entry.scenario_id)],
    ['artifact assignments', array(codeValue.scenario_artifact_assignments).map((entry) => entry.scenario_id)],
    ['Hosted operations', array(operationsValue.scenarios).map((entry) => entry.scenario_id)],
    ['resolution metrics', array(metricsValue.scenarios).map((entry) => entry.scenario_id)],
    ['isolation results', array(isolationValue.scenarios).map((entry) => entry.scenario_id)],
  ]) {
    const mismatch = multisetMismatch(ids, expectedIds);
    if (mismatch > 0) add('scenario', 'SCENARIO_SET_MISMATCH', { artifact: name, actual: ids, expected: expectedIds }, mismatch);
  }
  const snapshotScales = array(codeValue.source_inventory_snapshots).map((entry) => number(entry.scale));
  const scaleMismatch = multisetMismatch(snapshotScales, criteriaValue.scale_matrix.node_counts.map(Number));
  if (scaleMismatch > 0) add('scenario', 'SOURCE_SCALE_SET_MISMATCH', { actual: snapshotScales, expected: criteriaValue.scale_matrix.node_counts }, scaleMismatch);

  const snapshots = array(codeValue.source_inventory_snapshots);
  for (const snapshot of snapshots) {
    const entries = array(snapshot.entries);
    if (number(snapshot.file_count) !== entries.length) add('source', 'SOURCE_FILE_RECOUNT_MISMATCH', { scale: snapshot.scale, declared: snapshot.file_count, recounted: entries.length });
    const digest = `sha256:${inventoryDigest(entries)}`;
    if (snapshot.inventory_digest !== digest) add('source', 'SOURCE_INVENTORY_DIGEST_MISMATCH', { scale: snapshot.scale, declared: snapshot.inventory_digest, recounted: digest });
    const duplicatePaths = duplicateValues(entries.map((entry) => entry.path));
    if (duplicatePaths.length > 0) add('source', 'SOURCE_INVENTORY_DUPLICATE_PATH', { scale: snapshot.scale, paths: duplicatePaths }, duplicatePaths.length);
    for (const entry of entries) {
      if (!entry?.path || !validSha(entry.sha256) || !nonnegative(entry.size_bytes)) add('source', 'SOURCE_ENTRY_MALFORMED', { scale: snapshot.scale, entry });
    }
  }
  const sortedSnapshots = [...snapshots].sort((left, right) => number(left.scale) - number(right.scale));
  const smallest = sortedSnapshots.find((entry) => number(entry.scale) === Math.min(...criteriaValue.scale_matrix.node_counts.map(Number)));
  const largest = sortedSnapshots.find((entry) => number(entry.scale) === Math.max(...criteriaValue.scale_matrix.node_counts.map(Number)));
  const sourceFileCountDelta = smallest && largest ? Math.abs(number(largest.file_count) - number(smallest.file_count)) : 0;
  const baselineDigest = smallest?.inventory_digest;
  const sourceDigestChangeCount = baselineDigest ? snapshots.filter((entry) => entry.inventory_digest !== baselineDigest).length : 0;
  const generatedTokens = generatedIdentityTokens(manifestValue);
  const nodeSpecificPaths = [...new Set(snapshots.flatMap((snapshot) => array(snapshot.entries).map((entry) => entry.path)).filter((path) => generatedTokens.some((token) => path.includes(token))))];
  if (nodeSpecificPaths.length > 0) violations.push(Object.freeze({ category: 'source', code: 'GENERATED_NODE_SOURCE', detail: { paths: nodeSpecificPaths } }));

  const builds = array(codeValue.build_invocations);
  const artifacts = array(codeValue.artifacts);
  const artifactIdentities = [...new Set(artifacts.map((entry) => entry.artifact_identity).filter(Boolean))];
  const nodeSpecificBuildCount = builds.filter((entry) => entry.scope !== 'shared-runtime' || entry.assigned_node_id !== null).length + array(codeValue.node_specific_builds).length;
  if (codeValue.source_sha !== environmentSourceSha() || environmentValue.source_control?.tree_state !== 'CLEAN') {
    add('build', 'SOURCE_CONTROL_PROVENANCE_MISMATCH', {
      inventory_source_sha: codeValue.source_sha,
      environment_source_sha: environmentSourceSha(),
      tree_state: environmentValue.source_control?.tree_state,
    });
  }
  for (const build of builds) {
    if (build.exit_code !== 0 || build.source_sha !== environmentSourceSha() || build.scope !== 'shared-runtime') add('build', 'BUILD_PROVENANCE_MISMATCH', { build });
  }
  for (const artifact of artifacts) {
    const recounted = `sha256:${inventoryDigest(array(artifact.files))}`;
    if (artifact.artifact_identity !== recounted) add('build', 'ARTIFACT_IDENTITY_RECOUNT_MISMATCH', { declared: artifact.artifact_identity, recounted });
    for (const file of array(artifact.files)) {
      if (!file?.path || !validSha(file.sha256) || !nonnegative(file.size_bytes)) add('build', 'ARTIFACT_FILE_ENTRY_MALFORMED', { artifact_identity: artifact.artifact_identity, file });
    }
    if (artifact.target !== 'identity-api' || artifact.marker !== criteriaValue.shared_build.marker || artifact.source_sha !== environmentSourceSha()) {
      add('build', 'ARTIFACT_PROVENANCE_MISMATCH', { artifact_identity: artifact.artifact_identity, target: artifact.target, marker: artifact.marker, source_sha: artifact.source_sha });
    }
  }
  const artifactSet = new Set(artifactIdentities);
  for (const assignment of array(codeValue.scenario_artifact_assignments)) {
    if (!expectedIdSet.has(assignment.scenario_id) || !artifactSet.has(assignment.artifact_identity)) add('build', 'SCENARIO_ARTIFACT_ASSIGNMENT_MISMATCH', { assignment });
  }

  const infrastructureEvents = [...array(operationsValue.per_node_infrastructure_events), ...array(operationsValue.scenarios).flatMap((entry) => array(entry.per_node_infrastructure_events))];
  const infrastructureByScale = new Map(criteriaValue.scale_matrix.node_counts.map((scale) => [Number(scale), 0]));
  for (const scenario of array(operationsValue.scenarios)) {
    const eventCount = array(scenario.per_node_infrastructure_events).length;
    infrastructureByScale.set(number(scenario.scale), (infrastructureByScale.get(number(scenario.scale)) ?? 0) + eventCount);
    const expectedScenario = array(manifestValue.scenarios).find((entry) => entry.scenario_id === scenario.scenario_id);
    if (expectedScenario && number(scenario.hosted_database_provision_call_count) !== number(expectedScenario.node_count)) {
      add('scenario', 'DATABASE_PROVISION_CALL_COUNT_MISMATCH', { scenario_id: scenario.scenario_id, actual: scenario.hosted_database_provision_call_count, expected: expectedScenario.node_count });
    }
  }
  const infrastructureScaleCounts = [...infrastructureByScale.values()];
  const infrastructureScaleDelta = infrastructureScaleCounts.length > 0 ? Math.max(...infrastructureScaleCounts) - Math.min(...infrastructureScaleCounts) : 0;
  if (infrastructureEvents.length > 0) violations.push(Object.freeze({ category: 'infrastructure', code: 'INFRA_EVENT_COUNT', detail: { events: infrastructureEvents } }));

  const metricScenarios = byScenario(metricsValue.scenarios);
  const isolationScenarios = byScenario(isolationValue.scenarios);
  let duplicateAndCrossLineRows = 0;
  const latencySamples = [];
  for (const scenario of array(manifestValue.scenarios)) {
    const metrics = metricScenarios.get(scenario.scenario_id);
    const isolation = isolationScenarios.get(scenario.scenario_id);
    if (!metrics || !isolation) continue;
    validateTopology(scenario, add);
    compareSampleSet(scenario.generated_nodes, metrics.provisioning_samples, 'provisioning', add, latencySamples);
    compareSampleSet(scenario.generated_nodes, metrics.resolution_samples, 'resolution', add, latencySamples);
    compareSampleSet(scenario.sovereign_controls, metrics.sovereign_control_samples, 'control', add, latencySamples);
    validateIsolation(scenario, isolation, add);
    duplicateAndCrossLineRows += array(isolation.duplicate_node_ids).length + array(isolation.cross_line_closure_rows).length + array(isolation.cross_line_scope_rows).length;
  }
  for (const sample of latencySamples) {
    if (!nonnegative(sample.elapsed_ms)) add('latency', 'LATENCY_SAMPLE_MALFORMED', sample);
  }

  return Object.freeze({
    counts,
    violations,
    observations: {
      source_file_count_delta: sourceFileCountDelta,
      source_digest_change_count: sourceDigestChangeCount,
      node_specific_source_file_count: nodeSpecificPaths.length,
      build_count: builds.length,
      artifact_identity_count: artifactIdentities.length,
      node_specific_build_count: nodeSpecificBuildCount,
      infrastructure_action_total: infrastructureEvents.length,
      infrastructure_action_scale_delta: infrastructureScaleDelta,
      duplicate_and_cross_line_row_count: duplicateAndCrossLineRows,
    },
    latency: summarizeLatency(latencySamples),
  });

  function environmentSourceSha() {
    return environmentValue.source_control?.sha ?? null;
  }
}

function validateTopology(scenario, add) {
  const nodes = array(scenario.generated_nodes);
  if (nodes.length !== number(scenario.node_count))
    add('scenario', 'GENERATED_NODE_COUNT_MISMATCH', { scenario_id: scenario.scenario_id, actual: nodes.length, expected: scenario.node_count }, Math.abs(nodes.length - number(scenario.node_count)) || 1);
  if (array(scenario.sovereign_controls).length !== 3) add('resolution', 'SOVEREIGN_CONTROL_COUNT_MISMATCH', { scenario_id: scenario.scenario_id, actual: array(scenario.sovereign_controls).length, expected: 3 });
  const uniqueNodeIds = new Set(nodes.map((node) => node.node_id));
  if (uniqueNodeIds.size !== nodes.length) add('isolation', 'MANIFEST_DUPLICATE_NODE_ID', { scenario_id: scenario.scenario_id }, nodes.length - uniqueNodeIds.size);
  const expectedLineCount = scenario.topology_id === 'multi-line-horizontal' ? Math.min(3, nodes.length) : 1;
  const lineCount = new Set(nodes.map((node) => node.line_id)).size;
  if (lineCount !== expectedLineCount) add('resolution', 'TOPOLOGY_LINE_COUNT_MISMATCH', { scenario_id: scenario.scenario_id, actual: lineCount, expected: expectedLineCount });
  const expectedMaxLevel = scenario.topology_id === 'l0-l11-vertical-mixed' ? Math.min(11, nodes.length + 1) : 2;
  const maximumLevel = Math.max(...nodes.map((node) => number(String(node.signed_level).slice(1))));
  if (maximumLevel !== expectedMaxLevel) add('resolution', 'TOPOLOGY_LEVEL_MISMATCH', { scenario_id: scenario.scenario_id, actual: maximumLevel, expected: expectedMaxLevel });
}

function compareSampleSet(expectedNodes, samplesValue, kind, add, latencySamples) {
  const samples = array(samplesValue);
  const sampleMap = new Map();
  for (const sample of samples) {
    if (sampleMap.has(sample.node_id)) add(kind === 'provisioning' ? 'scenario' : 'resolution', 'DUPLICATE_SAMPLE', { kind, node_id: sample.node_id });
    sampleMap.set(sample.node_id, sample);
    latencySamples.push({ kind, node_id: sample.node_id, elapsed_ms: sample.elapsed_ms });
  }
  if (samples.length !== array(expectedNodes).length)
    add(kind === 'provisioning' ? 'scenario' : 'resolution', 'SAMPLE_COUNT_MISMATCH', { kind, actual: samples.length, expected: array(expectedNodes).length }, Math.abs(samples.length - array(expectedNodes).length) || 1);
  for (const expected of array(expectedNodes)) {
    const sample = sampleMap.get(expected.node_id);
    if (!sample) continue;
    if (kind === 'provisioning') compareProvisioning(expected, sample.result, add);
    else compareResolution(expected, sample, add);
  }
}

function compareProvisioning(expected, actual, add) {
  if (!actual) {
    add('resolution', 'PROVISION_RESULT_MISSING', { node_id: expected.node_id });
    return;
  }
  compareFields(expected, actual, ['line_id', 'node_id', 'sovereignty_tier', 'node_profile', 'realm_id', 'mall_id', 'status', 'parent_node_id', 'signed_level', 'host_sovereign_node_id', 'relation_version'], 'PROVISION_FIELD_MISMATCH', add);
  if (actual.original_parent_node_id !== expected.parent_node_id || actual.replayed !== false)
    add('resolution', 'PROVISION_FIELD_MISMATCH', { node_id: expected.node_id, original_parent_node_id: actual.original_parent_node_id, replayed: actual.replayed });
}

function compareResolution(expected, sample, add) {
  const context = sample.context;
  if (!context) add('resolution', 'CONTEXT_MISSING', { node_id: expected.node_id });
  else
    compareFields(
      expected,
      context,
      ['line_id', 'node_id', 'parent_node_id', 'signed_level', 'sovereignty_tier', 'node_profile', 'realm_id', 'mall_id', 'host_sovereign_node_id', 'relation_version', 'status'],
      'CONTEXT_FIELD_MISMATCH',
      add
    );
  const self = sample.scope_self;
  if (!self || self.line_id !== expected.line_id || self.node_id !== expected.node_id || number(self.distance) !== 0 || number(self.relation_version) !== 1 || self.status !== 'active') {
    add('resolution', 'SCOPE_SELF_MISMATCH', { node_id: expected.node_id, self });
  }
  const ancestors = array(sample.ancestors);
  if (ancestors.length !== expected.ancestors.length) add('resolution', 'ANCESTOR_COUNT_MISMATCH', { node_id: expected.node_id, actual: ancestors.length, expected: expected.ancestors.length });
  for (let index = 0; index < expected.ancestors.length; index += 1) {
    const ancestor = ancestors[index];
    if (!ancestor || ancestor.node_id !== expected.ancestors[index] || ancestor.line_id !== expected.line_id || number(ancestor.distance) !== index + 1 || number(ancestor.relation_version) !== 1 || ancestor.status !== 'active') {
      add('resolution', 'ANCESTOR_ROW_MISMATCH', { node_id: expected.node_id, index, ancestor, expected_node_id: expected.ancestors[index] });
    }
  }
  const capability = sample.capability;
  if (
    !capability ||
    capability.node_id !== expected.node_id ||
    capability.line_id !== expected.line_id ||
    number(capability.capability_version) !== 1 ||
    number(capability.relation_version) !== 1 ||
    capability.node_profile !== expected.node_profile ||
    capability.prior_node_profile !== expected.node_profile ||
    !sameArray(capability.capabilities, [expected.node_profile])
  ) {
    add('resolution', 'CAPABILITY_MISMATCH', { node_id: expected.node_id, capability, expected_profile: expected.node_profile });
  }
}

function validateIsolation(scenario, isolation, add) {
  const nodes = array(scenario.generated_nodes);
  const expectedClosureRows = nodes.reduce((total, node) => total + array(node.ancestors).length + 1, 0);
  const expectedCounts = {
    hosted_nodes: nodes.length,
    provisioning_rows: nodes.length,
    realm_rows: nodes.length,
    current_relation_rows: nodes.length,
    capability_rows: nodes.length,
    closure_rows: expectedClosureRows,
  };
  for (const [field, expected] of Object.entries(expectedCounts)) {
    if (number(isolation.database_counts?.[field]) !== expected) add('isolation', 'DATABASE_COUNT_MISMATCH', { scenario_id: scenario.scenario_id, field, actual: isolation.database_counts?.[field], expected });
  }
  const expectedLineCount = scenario.topology_id === 'multi-line-horizontal' ? Math.min(3, nodes.length) : 1;
  const expectedMaxLevel = scenario.topology_id === 'l0-l11-vertical-mixed' ? Math.min(11, nodes.length + 1) : 2;
  if (number(isolation.distinct_line_count) !== expectedLineCount) add('isolation', 'ISOLATION_LINE_COUNT_MISMATCH', { scenario_id: scenario.scenario_id, actual: isolation.distinct_line_count, expected: expectedLineCount });
  if (number(isolation.maximum_signed_level) !== expectedMaxLevel) add('isolation', 'ISOLATION_LEVEL_MISMATCH', { scenario_id: scenario.scenario_id, actual: isolation.maximum_signed_level, expected: expectedMaxLevel });
  if (number(isolation.sovereign_control_count) !== 3) add('isolation', 'ISOLATION_CONTROL_COUNT_MISMATCH', { scenario_id: scenario.scenario_id, actual: isolation.sovereign_control_count, expected: 3 });
  if (number(isolation.rollback_remaining_token_row_count) !== 0) add('isolation', 'ROLLBACK_RESIDUE', { scenario_id: scenario.scenario_id, actual: isolation.rollback_remaining_token_row_count });
  const expectedProfiles = new Map();
  for (const node of nodes) expectedProfiles.set(node.node_profile, (expectedProfiles.get(node.node_profile) ?? 0) + 1);
  const actualProfiles = new Map(array(isolation.profile_counts).map((entry) => [entry.node_profile, number(entry.row_count)]));
  if (!sameMap(expectedProfiles, actualProfiles)) add('isolation', 'PROFILE_COUNT_MISMATCH', { scenario_id: scenario.scenario_id, actual: Object.fromEntries(actualProfiles), expected: Object.fromEntries(expectedProfiles) });
}

function runNegativeProbes(criteriaValue, manifestValue, codeValue, operationsValue, metricsValue, isolationValue, environmentValue) {
  const sourceMutation = structuredClone(codeValue);
  const sourceSnapshot = sourceMutation.source_inventory_snapshots[0];
  sourceSnapshot.entries.push({
    path: `01_core_hexin/generated/${manifestValue.run_token}/node-specific.ts`,
    size_bytes: 1,
    sha256: `sha256:${'0'.repeat(64)}`,
  });
  sourceSnapshot.file_count = sourceSnapshot.entries.length;
  sourceSnapshot.inventory_digest = `sha256:${inventoryDigest(sourceSnapshot.entries)}`;

  const growthCode = structuredClone(codeValue);
  growthCode.build_invocations.push({
    invocation_id: 'mutated-node-build',
    scope: 'node-specific',
    assigned_node_id: manifestValue.scenarios[0].generated_nodes[0].node_id,
    source_sha: codeValue.source_sha,
    exit_code: 0,
  });
  const growthOperations = structuredClone(operationsValue);
  growthOperations.scenarios[0].per_node_infrastructure_events.push({ kind: 'mutated-cloud-resource', node_id: manifestValue.scenarios[0].generated_nodes[0].node_id });

  const crossLineMetrics = structuredClone(metricsValue);
  crossLineMetrics.scenarios[0].resolution_samples[0].context.line_id = 'line:e11-mutated-cross-line';

  return Object.freeze([
    probe('generated-node-source', 'GENERATED_NODE_SOURCE', criteriaValue, manifestValue, sourceMutation, operationsValue, metricsValue, isolationValue, [], environmentValue),
    probe('build-and-infrastructure-growth', 'BUILD_PROVENANCE_MISMATCH', criteriaValue, manifestValue, growthCode, growthOperations, metricsValue, isolationValue, ['INFRA_EVENT_COUNT'], environmentValue),
    probe('cross-line-context-resolution', 'CONTEXT_FIELD_MISMATCH', criteriaValue, manifestValue, codeValue, operationsValue, crossLineMetrics, isolationValue, [], environmentValue),
  ]);
}

function probe(probeId, expectedCode, criteria, manifest, code, operations, metrics, isolation, alternativeCodes = [], environment = {}) {
  const result = reconcile(criteria, manifest, code, operations, metrics, isolation, environment);
  const detectedCodes = result.violations.map((entry) => entry.code);
  const accepted = [expectedCode, ...alternativeCodes];
  return Object.freeze({
    probe_id: probeId,
    expected_violation: accepted,
    detected: accepted.some((code) => detectedCodes.includes(code)),
    detected_codes: [...new Set(detectedCodes)].sort(),
  });
}

function expectedScenarioIds(criteria) {
  return criteria.scale_matrix.node_counts.flatMap((scale) => criteria.scale_matrix.topologies.map((topology) => `scale-${String(scale).padStart(4, '0')}-${topology.id}`));
}

function generatedIdentityTokens(manifest) {
  const tokens = new Set([manifest.run_token]);
  for (const scenario of array(manifest.scenarios)) {
    tokens.add(scenario.namespace);
    for (const node of [...array(scenario.fixture_roots), ...array(scenario.sovereign_controls), ...array(scenario.generated_nodes)]) {
      for (const field of ['node_id', 'line_id', 'realm_id', 'mall_id']) if (node?.[field]) tokens.add(node[field]);
    }
  }
  return [...tokens].filter(Boolean);
}

function summarizeLatency(samples) {
  const groups = new Map();
  for (const sample of samples) {
    if (!nonnegative(sample.elapsed_ms)) continue;
    const values = groups.get(sample.kind) ?? [];
    values.push(number(sample.elapsed_ms));
    groups.set(sample.kind, values);
  }
  return [...groups.entries()].map(([kind, values]) => {
    values.sort((left, right) => left - right);
    return Object.freeze({ kind, sample_count: values.length, minimum_ms: values[0], p50_ms: percentile(values, 0.5), p95_ms: percentile(values, 0.95), maximum_ms: values.at(-1) });
  });
}

function percentile(values, fraction) {
  if (values.length === 0) return null;
  return values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)];
}

function compareFields(expected, actual, fields, code, add) {
  for (const field of fields) if (expected[field] !== actual[field]) add('resolution', code, { node_id: expected.node_id, field, actual: actual[field], expected: expected[field] });
}

function inventoryDigest(entries) {
  const sorted = [...array(entries)].sort((left, right) => String(left.path).localeCompare(String(right.path)));
  return sha256(Buffer.from(sorted.map((entry) => `${entry.path}\0${entry.size_bytes}\0${entry.sha256}\n`).join('')));
}

function multisetMismatch(actual, expected) {
  const counts = new Map();
  for (const value of expected) counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
  for (const value of actual) counts.set(String(value), (counts.get(String(value)) ?? 0) - 1);
  return [...counts.values()].reduce((total, value) => total + Math.abs(value), 0);
}

function duplicateValues(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

function byScenario(value) {
  return new Map(array(value).map((entry) => [entry.scenario_id, entry]));
}

function sameArray(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameMap(left, right) {
  return left.size === right.size && [...left.entries()].every(([key, value]) => right.get(key) === value);
}

function validSha(value) {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
}

function nonnegative(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0;
}

function threshold(thresholdId, expected, actual) {
  return Object.freeze({ threshold_id: thresholdId, expected, actual, met: actual === expected });
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function requireObject(value, name, missing) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) missing.push(name);
}

function requireArray(value, name, missing, nonempty) {
  if (!Array.isArray(value) || (nonempty && value.length === 0)) missing.push(name);
}

function requireValue(value, name, missing) {
  if (value === undefined || value === null || value === '') missing.push(name);
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
  if (!value || value.startsWith('--')) throw new Error(`E11_SCALE_OPTION_REQUIRED:${name}`);
  return value;
}
