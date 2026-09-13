import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const runDirectory = requiredOption('--run-directory');
const criteriaPath = requiredOption('--criteria');
const outputPath = requiredOption('--output');
const criteria = await readJson(criteriaPath);
const missingItems = [];
const artifacts = {};
const inputHashes = [];

for (const name of criteria.required_input_artifacts) {
  const path = resolve(runDirectory, name);
  try {
    const bytes = await readFile(path);
    artifacts[name] = JSON.parse(bytes.toString('utf8'));
    inputHashes.push({ path: name, sha256: `sha256:${sha256(bytes)}`, size_bytes: bytes.byteLength });
  } catch (error) {
    missingItems.push({ artifact: name, error: error instanceof Error ? error.message : String(error) });
  }
}

const thresholds = [];
const violations = [];
const observe = (thresholdId, expected, actual, met) => {
  thresholds.push(Object.freeze({ threshold_id: thresholdId, expected, actual, met }));
  if (!met) violations.push(Object.freeze({ threshold_id: thresholdId, expected, actual }));
};

let mutationProbes = [];
if (missingItems.length === 0) {
  const input = artifacts['vertical-input-manifest.json'];
  const relations = artifacts['vertical-node-relations.json'];
  const contexts = artifacts['vertical-context-matrix.json'];
  const closure = artifacts['vertical-closure-matrix.json'];
  const version = artifacts['vertical-relation-version-diff.json'];
  const negatives = artifacts['vertical-negative-probes.json'];
  const authority = artifacts['vertical-authority-counters.json'];
  const environment = artifacts['environment.json'];
  const nodes = [...input.nodes].sort((left, right) => Number(left.level) - Number(right.level));
  const expectedLevels = Array.from({ length: 12 }, (_, level) => level);
  const observedLevels = nodes.map((node) => Number(node.level));
  const currentRelations = relations.after_version_change.filter((row) => row.superseded_at === null);
  const currentEdges = currentRelations.filter((row) => row.parent_node_id !== null);
  const l12Facts = Number(negatives.l12_fact_count);
  observe('node_count', 12, nodes.length, nodes.length === 12);
  observe('level_sequence', expectedLevels, observedLevels, same(expectedLevels, observedLevels));
  observe('current_parent_edge_count', 11, currentEdges.length, currentEdges.length === 11);
  observe('l12_fact_count', 0, l12Facts, l12Facts === 0);

  const parentMismatches = currentRelations.filter((row) => {
    const node = nodes.find((candidate) => candidate.node_id === row.node_id);
    if (!node || row.line_id !== input.line_id || row.signed_level !== `L${node.level}`) return true;
    return Number(node.level) === 0
      ? row.parent_node_id !== null
      : row.parent_node_id !== nodes[Number(node.level) - 1]?.node_id;
  });
  observe('same_line_adjacent_parent_mismatch_count', 0, parentMismatches.length, parentMismatches.length === 0);

  const expectedClosure = deriveClosure(nodes);
  const initialClosureMismatch = setMismatch(expectedClosure, closure.initial_current_rows.map(closureKey));
  const currentClosureMismatch = setMismatch(expectedClosure, closure.after_version_current_rows.map(closureKey));
  observe('initial_closure_row_count', 78, closure.initial_current_rows.length, closure.initial_current_rows.length === 78);
  observe('current_closure_row_count', 78, closure.after_version_current_rows.length, closure.after_version_current_rows.length === 78);
  observe('derived_closure_mismatch_count', 0, initialClosureMismatch + currentClosureMismatch,
    initialClosureMismatch + currentClosureMismatch === 0);

  const resolverAssessment = assessResolvers(nodes, closure.after_version_resolver_results);
  observe('self_total', 12, resolverAssessment.selfTotal, resolverAssessment.selfTotal === 12);
  observe('ancestor_total', 66, resolverAssessment.ancestorTotal, resolverAssessment.ancestorTotal === 66);
  observe('descendant_total', 66, resolverAssessment.descendantTotal, resolverAssessment.descendantTotal === 66);
  observe('subtree_total', 78, resolverAssessment.subtreeTotal, resolverAssessment.subtreeTotal === 78);
  observe('resolver_mismatch_count', 0, resolverAssessment.mismatches.length, resolverAssessment.mismatches.length === 0);

  const contextMismatches = assessContexts(nodes, contexts.after_version_change, currentRelations);
  observe('context_observation_count', 12, contexts.after_version_change.length, contexts.after_version_change.length === 12);
  observe('context_mismatch_count', 0, contextMismatches.length, contextMismatches.length === 0);

  const targetRows = [...version.relation_rows].sort((left, right) => Number(left.relation_version) - Number(right.relation_version));
  const preserved = targetRows.filter((row) => Number(row.relation_version) === 1 && row.superseded_at === input.changed_effective_at).length;
  const current = targetRows.filter((row) => Number(row.relation_version) === 2 && row.superseded_at === null).length;
  observe('target_relation_version_count', 2, targetRows.length, targetRows.length === 2);
  observe('preserved_historical_relation_count', 1, preserved, preserved === 1);
  observe('current_relation_version_count', 1, current, current === 1);
  const expectedTargetPath = nodes.slice(0, Number(nodes.find((node) => node.node_id === version.target_node_id)?.level ?? -1) + 1)
    .reverse().map((node, distance) => ({ node_id: node.node_id, distance }));
  const historicalPathMismatch = pathMismatch(expectedTargetPath, version.historical_path, 1);
  const currentPathMismatch = pathMismatch(expectedTargetPath, version.current_path, 2);
  observe('historical_path_mismatch_count', 0, historicalPathMismatch, historicalPathMismatch === 0);
  observe('current_path_mismatch_count', 0, currentPathMismatch, currentPathMismatch === 0);

  const tables = authority.model_and_path.tables.map((entry) => entry.table_name).sort();
  const functions = authority.model_and_path.resolvers.map((entry) => entry.function_name);
  const contextResolverCount = functions.filter((name) => name === 'resolve_node_context').length;
  const scopeResolverCount = functions.filter((name) => name.startsWith('resolve_node_scope_')).length;
  observe('shared_model_table_set', ['node', 'nodeclosure', 'noderelation'], tables,
    same(['node', 'nodeclosure', 'noderelation'], tables));
  observe('level_specific_table_or_column_count', 0, authority.model_and_path.level_specific_tables_or_columns.length,
    authority.model_and_path.level_specific_tables_or_columns.length === 0);
  observe('context_resolver_count', 1, contextResolverCount, contextResolverCount === 1);
  observe('scope_resolver_count', 4, scopeResolverCount, scopeResolverCount === 4);
  observe('levels_using_shared_context_path', 12, contexts.after_version_change.length,
    contexts.shared_resolver === 'organization.resolve_node_context(text)' && contexts.after_version_change.length === 12);
  observe('levels_using_each_shared_scope_path', 12, closure.after_version_resolver_results.length,
    closure.after_version_resolver_results.length === 12 && Object.keys(closure.resolver_functions).length === 4);

  const acceptedProbeCount = Number(negatives.accepted_probe_count);
  const residualCount = Number(negatives.residual_fact_count);
  const rollbackCount = Number(negatives.rollback.total);
  const probeErrors = Object.fromEntries(negatives.probes.map((probe) => [probe.probe_id, probe.error?.message ?? '']));
  const errorMismatchCount = [
    ['skip-level', 'SFL_NODE_RELATION_LEVEL_ADJACENCY_INVALID'],
    ['second-current-parent', 'SFL_NODE_RELATION_VERSION_INVALID'],
    ['cross-line', 'SFL_NODE_RELATION_CROSS_LINE_INVALID'],
    ['l12-boundary', 'signed_level'],
  ].filter(([probe, marker]) => !probeErrors[probe]?.includes(marker)).length;
  observe('accepted_negative_probe_count', 0, acceptedProbeCount, acceptedProbeCount === 0);
  observe('negative_probe_error_mismatch_count', 0, errorMismatchCount, errorMismatchCount === 0);
  observe('negative_probe_residual_fact_count', 0, residualCount, residualCount === 0);
  observe('transaction_rollback_remaining_fact_count', 0, rollbackCount, rollbackCount === 0);

  const permissionDelta = Number(authority.signed_level_only_permission_change_count);
  const sovereigntyDelta = Number(authority.signed_level_only_sovereignty_change_count);
  const resourceDelta = Number(authority.signed_level_only_sovereign_resource_change_count);
  observe('signed_level_only_permission_change_count', 0, permissionDelta, permissionDelta === 0);
  observe('signed_level_only_sovereignty_change_count', 0, sovereigntyDelta, sovereigntyDelta === 0);
  observe('signed_level_only_sovereign_resource_change_count', 0, resourceDelta, resourceDelta === 0);
  const comparison = authority.after_relation_version.comparison;
  const comparisonMismatch = comparison.filter((entry) => entry.sovereignty_tier !== 'hosted'
    || Number(entry.entitlement_count) !== 0 || Number(entry.resource_count) !== 0 || Number(entry.manifest_count) !== 0).length;
  observe('higher_level_authority_comparison_mismatch_count', 0, comparisonMismatch, comparisonMismatch === 0);

  const environmentReady = environment.kind === 'DEV'
    && String(environment.runtime?.postgres ?? '').includes('PostgreSQL 17')
    && Number(environment.runtime?.migration_count) > 0;
  observe('dev_environment_ready', true, environmentReady, environmentReady);

  mutationProbes = [
    {
      probe_id: 'drop-one-closure-row',
      detected: setMismatch(expectedClosure, closure.after_version_current_rows.slice(1).map(closureKey)) > 0,
    },
    {
      probe_id: 'drop-historical-relation-version',
      detected: targetRows.slice(1).length !== criteria.relation_version_threshold.target_relation_row_count,
    },
    {
      probe_id: 'accept-skip-level-probe',
      detected: acceptedProbeCount + 1 !== criteria.boundary_threshold.accepted_negative_probe_count,
    },
  ];
  const mutationMisses = mutationProbes.filter((probe) => !probe.detected).length;
  observe('negative_oracle_mutation_detection_miss_count', 0, mutationMisses, mutationMisses === 0);
}

const claimOutcome = missingItems.length > 0 ? 'UNKNOWN' : violations.length === 0 ? 'MET' : 'NOT MET';
const environmentArtifact = artifacts['environment.json'];
const environmentAssurance = claimOutcome === 'MET' && environmentArtifact?.kind === 'DEV' ? 'DEV VERIFIED' : 'NOT ESTABLISHED';
const output = Object.freeze({
  schema_version: 'e02-vertical-independent-recount-v1',
  oracle_id: criteria.independent_oracle.oracle_id,
  executed_at: new Date().toISOString(),
  criteria_id: criteria.criteria_id,
  run_directory: runDirectory,
  reads_test_program_pass: false,
  input_artifacts: inputHashes,
  missing_items: missingItems,
  violations,
  thresholds,
  mutation_probes: mutationProbes,
  claim_outcome: claimOutcome,
  environment_assurance: environmentAssurance,
});
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' });
console.log(`E02 independent recount completed: outcome=${claimOutcome} thresholds=${thresholds.length} violations=${violations.length}`);

function deriveClosure(nodes) {
  const keys = [];
  for (const descendant of nodes) {
    for (let ancestorLevel = descendant.level; ancestorLevel >= 0; ancestorLevel -= 1) {
      keys.push(`${descendant.node_id}\u0000${nodes[ancestorLevel].node_id}\u0000${descendant.level - ancestorLevel}`);
    }
  }
  return keys;
}

function closureKey(row) {
  return `${row.descendant_node_id}\u0000${row.ancestor_node_id}\u0000${Number(row.depth)}`;
}

function setMismatch(expected, observed) {
  const expectedSet = new Set(expected);
  const observedSet = new Set(observed);
  let mismatches = 0;
  for (const key of expectedSet) if (!observedSet.has(key)) mismatches += 1;
  for (const key of observedSet) if (!expectedSet.has(key)) mismatches += 1;
  return mismatches + (observed.length - observedSet.size);
}

function assessResolvers(nodes, results) {
  const mismatches = [];
  let selfTotal = 0;
  let ancestorTotal = 0;
  let descendantTotal = 0;
  let subtreeTotal = 0;
  for (const item of results) {
    const level = Number(item.level);
    const expected = {
      self: [{ node_id: nodes[level].node_id, distance: 0 }],
      ancestors: Array.from({ length: level }, (_, index) => ({ node_id: nodes[level - index - 1].node_id, distance: index + 1 })),
      descendants: Array.from({ length: 11 - level }, (_, index) => ({ node_id: nodes[level + index + 1].node_id, distance: index + 1 })),
      subtree: Array.from({ length: 12 - level }, (_, index) => ({ node_id: nodes[level + index].node_id, distance: index })),
    };
    selfTotal += item.self.length;
    ancestorTotal += item.ancestors.length;
    descendantTotal += item.descendants.length;
    subtreeTotal += item.subtree.length;
    for (const operation of Object.keys(expected)) {
      const actual = item[operation].map((row) => ({ node_id: row.node_id, distance: Number(row.distance) }));
      if (!same(expected[operation], actual)) mismatches.push({ fixture_id: item.fixture_id, operation });
    }
  }
  return { selfTotal, ancestorTotal, descendantTotal, subtreeTotal, mismatches };
}

function assessContexts(nodes, observations, currentRelations) {
  const mismatches = [];
  for (const observation of observations) {
    const expected = nodes[Number(observation.level)];
    const relation = currentRelations.find((row) => row.node_id === expected.node_id);
    const context = observation.context;
    if (!context || context.line_id !== expected.line_id || context.node_id !== expected.node_id
      || context.parent_node_id !== expected.parent_node_id || context.signed_level !== expected.signed_level
      || context.sovereignty_tier !== expected.sovereignty_tier || context.node_profile !== expected.node_profile
      || context.realm_id !== expected.realm_id || context.mall_id !== expected.mall_id
      || context.host_sovereign_node_id !== expected.host_sovereign_node_id
      || Number(context.relation_version) !== Number(relation?.relation_version)) mismatches.push(observation.fixture_id);
  }
  return mismatches;
}

function pathMismatch(expected, actual, targetVersion) {
  let mismatches = expected.length === actual.length ? 0 : Math.abs(expected.length - actual.length);
  for (let index = 0; index < Math.min(expected.length, actual.length); index += 1) {
    if (expected[index].node_id !== actual[index].node_id || expected[index].distance !== Number(actual[index].distance)) mismatches += 1;
    if (index === 0 && Number(actual[index].relation_version) !== targetVersion) mismatches += 1;
  }
  return mismatches;
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requiredOption(name) {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`E02_OPTION_VALUE_REQUIRED:${name}`);
  return resolve(value);
}

function readJson(path) {
  return readFile(path, 'utf8').then(JSON.parse);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
