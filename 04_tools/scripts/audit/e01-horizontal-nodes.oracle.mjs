import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const runDirectory = requiredOption('--run-directory');
const criteriaPath = requiredOption('--criteria');
const outputPath = requiredOption('--output');
const criteria = await readJson(criteriaPath);
if (criteria.claim_id !== 'E2-TOPO-001' || criteria.legacy_trace_id !== 'E01') {
  throw new Error('E01_ORACLE_CRITERIA_INVALID');
}

const missingItems = [];
const violations = [];
const thresholds = [];
const inputHashes = [];
const artifacts = {};
for (const name of criteria.required_input_artifacts) {
  const path = join(runDirectory, name);
  try {
    const bytes = await readFile(path);
    artifacts[name] = JSON.parse(bytes.toString('utf8'));
    inputHashes.push({ path: name, sha256: `sha256:${sha256(bytes)}`, size_bytes: bytes.byteLength });
  } catch (cause) {
    missingItems.push({ item: name, reason: cause instanceof Error ? cause.message : String(cause) });
  }
}

const manifest = artifacts['horizontal-input-manifest.json'];
const topology = artifacts['horizontal-topology.json'];
const contexts = artifacts['horizontal-node-contexts.json'];
const operations = artifacts['horizontal-operation-results.json'];
const database = artifacts['horizontal-database-diff.json'];
const model = artifacts['horizontal-model-inventory.json'];
const artifact = artifacts['horizontal-artifact-identity.json'];
const environment = artifacts['environment.json'];

requireArray(manifest?.peers, 'manifest peers', missingItems, true);
requireValue(manifest?.parent, 'manifest parent', missingItems);
requireArray(topology?.nodes, 'topology nodes', missingItems, true);
requireArray(topology?.relations, 'topology relations', missingItems, true);
requireArray(topology?.closure, 'topology closure', missingItems, true);
requireArray(contexts?.observations, 'context observations', missingItems, true);
requireArray(contexts?.authority_map, 'context authority map', missingItems, true);
requireArray(operations?.positive_results, 'positive operation results', missingItems, true);
requireArray(operations?.cross_node_results, 'cross-node operation results', missingItems, true);
requireValue(database?.seeded_before_operations, 'seeded database snapshot', missingItems);
requireValue(database?.after_positive_operations, 'positive database snapshot', missingItems);
requireValue(database?.after_cross_node_operations, 'negative database snapshot', missingItems);
requireValue(database?.after_transaction_rollback, 'rollback database snapshot', missingItems);
requireArray(model?.database_model?.tables, 'database model tables', missingItems, true);
requireArray(model?.database_model?.context_resolvers, 'database context resolvers', missingItems, true);
requireValue(model?.source_inventory, 'source inventory', missingItems);
requireArray(model?.peer_model_assignments, 'peer model assignments', missingItems, true);
requireArray(artifact?.build_invocations, 'build invocations', missingItems, true);
requireArray(artifact?.artifacts, 'built artifacts', missingItems, true);
requireArray(artifact?.peer_artifact_assignments, 'peer artifact assignments', missingItems, true);
requireValue(environment?.source_control, 'environment source control', missingItems);

let mutationProbes = [];
if (missingItems.length === 0) {
  const peers = manifest.peers;
  const peerByLabel = new Map(peers.map((peer) => [peer.label, peer]));
  const criterionByLabel = new Map(criteria.fixture.peer_nodes.map((peer) => [peer.label, peer]));

  const topologyMismatch = assessTopology(manifest, topology, criterionByLabel);
  observe('horizontal_topology_mismatch_count', 0, topologyMismatch, topologyMismatch === 0);
  observe('peer_count', criteria.fixture.peer_count, peers.length, peers.length === criteria.fixture.peer_count);
  observe('line_unique_count', 1, unique(peers.map((peer) => peer.line_id)).length,
    unique(peers.map((peer) => peer.line_id)).length === 1);
  observe('parent_unique_count', 1, unique(peers.map((peer) => peer.parent_node_id)).length,
    unique(peers.map((peer) => peer.parent_node_id)).length === 1);
  observe('signed_level_unique_count', 1, unique(peers.map((peer) => peer.signed_level)).length,
    unique(peers.map((peer) => peer.signed_level)).length === 1);

  const contextMismatch = assessContexts(peers, topology, contexts.observations);
  observe('context_mismatch_count', criteria.identity_and_isolation_threshold.context_mismatch_count,
    contextMismatch, contextMismatch === criteria.identity_and_isolation_threshold.context_mismatch_count);
  const pathIdentityCount = unique(contexts.observations.map((entry) => entry.path_identity)).length;
  observe('peer_context_path_identity_count', criteria.model_and_path_threshold.peer_context_path_identity_count,
    pathIdentityCount, pathIdentityCount === criteria.model_and_path_threshold.peer_context_path_identity_count);

  const authorityAssessment = assessAuthority(peers, criterionByLabel, contexts.authority_map, criteria);
  observe('authority_mapping_mismatch_count', criteria.identity_and_isolation_threshold.authority_mapping_mismatch_count,
    authorityAssessment.mismatch_count,
    authorityAssessment.mismatch_count === criteria.identity_and_isolation_threshold.authority_mapping_mismatch_count);
  observe('authority_dimension_distinct_count_mismatch_count', 0, authorityAssessment.distinct_count_mismatch_count,
    authorityAssessment.distinct_count_mismatch_count === 0);

  const positiveAssessment = assessPositive(peers, peerByLabel, operations.positive_results, criteria);
  observe('positive_observation_count', criteria.operation_matrix.positive_observation_count,
    operations.positive_results.length,
    operations.positive_results.length === criteria.operation_matrix.positive_observation_count);
  observe('positive_operation_decision_mismatch_count', criteria.identity_and_isolation_threshold.operation_decision_mismatch_count,
    positiveAssessment.decision_mismatch_count,
    positiveAssessment.decision_mismatch_count === criteria.identity_and_isolation_threshold.operation_decision_mismatch_count);
  observe('successful_business_write_count', criteria.operation_matrix.expected_successful_business_write_count,
    positiveAssessment.successful_write_count,
    positiveAssessment.successful_write_count === criteria.operation_matrix.expected_successful_business_write_count);
  observe('positive_non_target_business_write_count', criteria.identity_and_isolation_threshold.non_target_business_write_count,
    positiveAssessment.non_target_write_count,
    positiveAssessment.non_target_write_count === criteria.identity_and_isolation_threshold.non_target_business_write_count);

  const crossAssessment = assessCross(peers, peerByLabel, operations.cross_node_results, criteria);
  observe('cross_node_observation_count', criteria.operation_matrix.cross_node_observation_count,
    operations.cross_node_results.length,
    operations.cross_node_results.length === criteria.operation_matrix.cross_node_observation_count);
  observe('cross_node_request_or_decision_mismatch_count', 0, crossAssessment.request_or_decision_mismatch_count,
    crossAssessment.request_or_decision_mismatch_count === 0);
  observe('cross_node_allowed_count', criteria.identity_and_isolation_threshold.cross_node_allowed_count,
    crossAssessment.allowed_count,
    crossAssessment.allowed_count === criteria.identity_and_isolation_threshold.cross_node_allowed_count);
  observe('cross_node_business_row_count', criteria.identity_and_isolation_threshold.cross_node_business_row_count,
    crossAssessment.business_row_count,
    crossAssessment.business_row_count === criteria.identity_and_isolation_threshold.cross_node_business_row_count);
  observe('cross_node_outbox_count', criteria.identity_and_isolation_threshold.cross_node_outbox_count,
    crossAssessment.outbox_count,
    crossAssessment.outbox_count === criteria.identity_and_isolation_threshold.cross_node_outbox_count);

  const databaseAssessment = assessDatabase(database, peers, operations, criteria);
  observe('decision_audit_count', criteria.operation_matrix.expected_decision_audit_count,
    databaseAssessment.audit_count,
    databaseAssessment.audit_count === criteria.operation_matrix.expected_decision_audit_count);
  observe('outbox_count', criteria.operation_matrix.expected_outbox_count,
    databaseAssessment.outbox_count,
    databaseAssessment.outbox_count === criteria.operation_matrix.expected_outbox_count);
  observe('business_resource_version_mismatch_count', 0, databaseAssessment.resource_version_mismatch_count,
    databaseAssessment.resource_version_mismatch_count === 0);
  observe('unexpected_authoritative_diff_count', criteria.identity_and_isolation_threshold.unexpected_authoritative_diff_count,
    databaseAssessment.unexpected_diff_count,
    databaseAssessment.unexpected_diff_count === criteria.identity_and_isolation_threshold.unexpected_authoritative_diff_count);
  observe('transaction_rollback_residual_fact_count', criteria.identity_and_isolation_threshold.rollback_residual_fact_count,
    databaseAssessment.rollback_residual_count,
    databaseAssessment.rollback_residual_count === criteria.identity_and_isolation_threshold.rollback_residual_fact_count);

  const modelAssessment = assessModel(model, peers, criteria);
  observe('shared_model_table_mismatch_count', 0, modelAssessment.table_mismatch_count,
    modelAssessment.table_mismatch_count === 0);
  observe('sql_context_resolver_count', criteria.model_and_path_threshold.sql_context_resolver_count,
    modelAssessment.sql_context_resolver_count,
    modelAssessment.sql_context_resolver_count === criteria.model_and_path_threshold.sql_context_resolver_count);
  observe('typescript_context_parser_definition_count', criteria.model_and_path_threshold.typescript_context_parser_definition_count,
    modelAssessment.parser_definition_count,
    modelAssessment.parser_definition_count === criteria.model_and_path_threshold.typescript_context_parser_definition_count);
  observe('typescript_context_adapter_definition_count', criteria.model_and_path_threshold.typescript_context_adapter_definition_count,
    modelAssessment.adapter_definition_count,
    modelAssessment.adapter_definition_count === criteria.model_and_path_threshold.typescript_context_adapter_definition_count);
  observe('peer_model_identity_count', criteria.model_and_path_threshold.peer_model_identity_count,
    modelAssessment.peer_model_identity_count,
    modelAssessment.peer_model_identity_count === criteria.model_and_path_threshold.peer_model_identity_count);
  observe('source_copy_count', criteria.model_and_path_threshold.source_copy_count,
    modelAssessment.source_copy_count,
    modelAssessment.source_copy_count === criteria.model_and_path_threshold.source_copy_count);
  observe('node_name_business_branch_count', criteria.model_and_path_threshold.node_name_business_branch_count,
    modelAssessment.node_name_business_branch_count,
    modelAssessment.node_name_business_branch_count === criteria.model_and_path_threshold.node_name_business_branch_count);
  observe('node_specific_source_file_count', criteria.source_and_artifact_threshold.node_specific_source_file_count,
    modelAssessment.node_specific_source_file_count,
    modelAssessment.node_specific_source_file_count === criteria.source_and_artifact_threshold.node_specific_source_file_count);

  const sourceRecountMismatch = await recountSourceInventory(model.source_inventory);
  observe('source_inventory_recount_mismatch_count', 0, sourceRecountMismatch, sourceRecountMismatch === 0);
  const artifactAssessment = assessArtifact(artifact, environment, peers, criteria);
  observe('source_sha_unique_count', criteria.source_and_artifact_threshold.source_sha_unique_count,
    artifactAssessment.source_sha_unique_count,
    artifactAssessment.source_sha_unique_count === criteria.source_and_artifact_threshold.source_sha_unique_count);
  observe('build_count', criteria.source_and_artifact_threshold.build_count, artifactAssessment.build_count,
    artifactAssessment.build_count === criteria.source_and_artifact_threshold.build_count);
  observe('build_id_unique_count', criteria.source_and_artifact_threshold.build_id_unique_count,
    artifactAssessment.build_id_unique_count,
    artifactAssessment.build_id_unique_count === criteria.source_and_artifact_threshold.build_id_unique_count);
  observe('artifact_identity_count', criteria.source_and_artifact_threshold.artifact_identity_count,
    artifactAssessment.artifact_identity_count,
    artifactAssessment.artifact_identity_count === criteria.source_and_artifact_threshold.artifact_identity_count);
  observe('artifact_assignment_count', criteria.source_and_artifact_threshold.artifact_assignment_count,
    artifactAssessment.assignment_count,
    artifactAssessment.assignment_count === criteria.source_and_artifact_threshold.artifact_assignment_count);
  observe('artifact_assignment_mismatch_count', criteria.source_and_artifact_threshold.artifact_assignment_mismatch_count,
    artifactAssessment.assignment_mismatch_count,
    artifactAssessment.assignment_mismatch_count === criteria.source_and_artifact_threshold.artifact_assignment_mismatch_count);
  observe('artifact_provenance_or_digest_mismatch_count', 0, artifactAssessment.provenance_or_digest_mismatch_count,
    artifactAssessment.provenance_or_digest_mismatch_count === 0);
  observe('node_specific_build_count', criteria.source_and_artifact_threshold.node_specific_build_count,
    artifactAssessment.node_specific_build_count,
    artifactAssessment.node_specific_build_count === criteria.source_and_artifact_threshold.node_specific_build_count);

  const environmentReady = environment.kind === 'DEV'
    && String(environment.runtime?.postgres ?? '').includes('PostgreSQL 17')
    && Number(environment.runtime?.migration_count) > 0
    && environment.source_control?.tree_state === 'CLEAN';
  observe('dev_environment_ready', true, environmentReady, environmentReady);

  const contextMutation = structuredClone(contexts.observations);
  contextMutation[0].observed.mall_id = peers[1].scope_id;
  const crossMutation = structuredClone(operations.cross_node_results);
  crossMutation[0].status = 200;
  crossMutation[0].write_rows = [{ id: peers[1].resource_id }];
  crossMutation[0].emitted_outbox = { id: 'mutated' };
  const artifactMutation = structuredClone(artifact);
  artifactMutation.artifacts.push({ ...artifactMutation.artifacts[0], artifact_identity: `sha256:${'f'.repeat(64)}` });
  mutationProbes = [
    {
      probe_id: 'swap-one-context-scope',
      detected: assessContexts(peers, topology, contextMutation) > contextMismatch,
    },
    {
      probe_id: 'admit-one-cross-node-write',
      detected: assessCross(peers, peerByLabel, crossMutation, criteria).business_row_count > crossAssessment.business_row_count,
    },
    {
      probe_id: 'add-second-artifact-identity',
      detected: assessArtifact(artifactMutation, environment, peers, criteria).artifact_identity_count
        > artifactAssessment.artifact_identity_count,
    },
  ];
  const mutationMisses = mutationProbes.filter((probe) => !probe.detected).length;
  observe('negative_oracle_mutation_detection_miss_count', 0, mutationMisses, mutationMisses === 0);
}

const claimOutcome = missingItems.length > 0 ? 'UNKNOWN' : violations.length === 0 ? 'MET' : 'NOT MET';
const environmentAssurance = claimOutcome === 'MET' && environment?.kind === 'DEV' ? 'DEV VERIFIED' : 'NOT ESTABLISHED';
const output = Object.freeze({
  schema_version: 'e01-horizontal-independent-recount-v1',
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
console.log(`E01 independent recount completed: outcome=${claimOutcome} thresholds=${thresholds.length} violations=${violations.length}`);

function assessTopology(manifestValue, topologyValue, criterionByLabel) {
  let mismatches = 0;
  const expectedNodes = [manifestValue.parent, ...manifestValue.peers];
  if (topologyValue.nodes.length !== expectedNodes.length) mismatches += Math.abs(topologyValue.nodes.length - expectedNodes.length);
  if (topologyValue.relations.length !== expectedNodes.length) mismatches += Math.abs(topologyValue.relations.length - expectedNodes.length);
  for (const expected of expectedNodes) {
    const node = topologyValue.nodes.find((entry) => entry.node_id === expected.node_id);
    const relation = topologyValue.relations.find((entry) => entry.node_id === expected.node_id && entry.superseded_at === null);
    if (!node || node.line_id !== expected.line_id || node.realm_id !== expected.realm_id
      || node.mall_id !== expected.scope_id || node.sovereignty_tier !== expected.sovereignty_tier
      || node.node_profile !== 'operating_mall' || node.status !== 'active') mismatches += 1;
    if (!relation || relation.line_id !== expected.line_id || relation.parent_node_id !== expected.parent_node_id
      || relation.original_parent_node_id !== expected.parent_node_id || relation.signed_level !== expected.signed_level
      || Number(relation.relation_version) !== 1) mismatches += 1;
    if (expected.label !== 'H-PARENT') {
      const criterion = criterionByLabel.get(expected.label);
      if (!criterion || expected.signed_level !== criteria.fixture.peer_signed_level
        || expected.parent_node_id !== manifestValue.parent.node_id
        || expected.sovereignty_tier !== criterion.sovereignty_tier) mismatches += 1;
      const expectedHost = expected.sovereignty_tier === 'sovereign' ? expected.node_id : manifestValue.parent.node_id;
      if (relation?.host_sovereign_node_id !== expectedHost) mismatches += 1;
    }
  }
  const expectedClosure = [
    `${manifestValue.parent.node_id}|${manifestValue.parent.node_id}|0`,
    ...manifestValue.peers.flatMap((peer) => [
      `${peer.node_id}|${peer.node_id}|0`,
      `${peer.node_id}|${manifestValue.parent.node_id}|1`,
    ]),
  ].sort();
  const observedClosure = topologyValue.closure.filter((row) => row.superseded_at === null)
    .map((row) => `${row.descendant_node_id}|${row.ancestor_node_id}|${Number(row.depth)}`).sort();
  mismatches += setMismatch(expectedClosure, observedClosure);
  return mismatches;
}

function assessContexts(peers, topologyValue, observations) {
  let mismatches = observations.length === peers.length ? 0 : Math.abs(observations.length - peers.length);
  for (const peer of peers) {
    const observation = observations.find((entry) => entry.peer_label === peer.label);
    const relation = topologyValue.relations.find((entry) => entry.node_id === peer.node_id && entry.superseded_at === null);
    const expected = {
      line_id: peer.line_id,
      node_id: peer.node_id,
      parent_node_id: peer.parent_node_id,
      signed_level: peer.signed_level,
      sovereignty_tier: peer.sovereignty_tier,
      node_profile: peer.node_profile,
      realm_id: peer.realm_id,
      mall_id: peer.scope_id,
      host_sovereign_node_id: relation?.host_sovereign_node_id,
      relation_version: Number(relation?.relation_version),
      effective_at: relation?.effective_at,
      status: 'active',
    };
    if (!observation || !same(expected, observation.observed)) mismatches += 1;
  }
  return mismatches;
}

function assessAuthority(peers, criterionByLabel, authorityMap, criteriaValue) {
  let mismatchCount = authorityMap.length === peers.length ? 0 : Math.abs(authorityMap.length - peers.length);
  const dimensions = {
    node_id: [], realm_id: [], account_id: [], membership_id: [], scope_id: [], resource_id: [],
  };
  for (const peer of peers) {
    const mapping = authorityMap.find((entry) => entry.peer_label === peer.label);
    const identity = mapping?.identity;
    const resource = mapping?.resources?.[0];
    if (!identity || identity.node_id !== peer.node_id || identity.line_id !== peer.line_id
      || identity.realm_id !== peer.realm_id || identity.account_id !== peer.account_id
      || identity.principal_id !== peer.principal_id || identity.membership_id !== peer.membership_id
      || identity.scope_id !== peer.scope_id || identity.granted_scope_id !== peer.scope_id
      || identity.client !== 'operator' || identity.status !== 'active') mismatchCount += 1;
    if (!resource || resource.resource_id !== peer.resource_id || resource.scope_id !== peer.scope_id
      || resource.participant_node_id !== peer.node_id || resource.participant_membership_id !== peer.membership_id
      || resource.participant_realm_id !== peer.realm_id || resource.participant_account_id !== peer.account_id) mismatchCount += 1;
    const capabilities = new Map(array(mapping?.capabilities).map((entry) => [entry.capability_id, entry]));
    for (const operation of criteriaValue.operation_matrix.positive_operations_per_peer) {
      const expectedEnabled = operation.kind !== 'capability_probe' || criterionByLabel.get(peer.label)?.variant_capability_expected;
      const entitlement = capabilities.get(operation.operation_id);
      if (!entitlement || entitlement.scope_id !== peer.scope_id
        || entitlement.state !== (expectedEnabled ? 'enabled' : 'disabled')) mismatchCount += 1;
    }
    for (const key of Object.keys(dimensions)) dimensions[key].push(key === 'resource_id' ? resource?.resource_id : identity?.[key]);
  }
  const distinctCountMismatch = Object.values(dimensions)
    .filter((values) => unique(values).length !== criteriaValue.identity_and_isolation_threshold.distinct_count_per_authority_dimension).length;
  return { mismatch_count: mismatchCount, distinct_count_mismatch_count: distinctCountMismatch };
}

function assessPositive(peers, peerByLabel, results, criteriaValue) {
  let mismatchCount = 0;
  let successfulWrites = 0;
  let nonTargetWrites = 0;
  const expectedKeys = new Set();
  for (const peer of peers) {
    for (const operation of criteriaValue.operation_matrix.positive_operations_per_peer) {
      expectedKeys.add(`${peer.label}|${operation.kind}`);
      const result = results.find((entry) => entry.source_peer_label === peer.label && entry.kind === operation.kind);
      const expectedStatus = operation.expected_status ?? operation.expected_by_peer?.[peer.label];
      if (!result || result.status !== expectedStatus || result.request?.endpoint_host !== peer.accounts_host
        || result.request?.membership_id !== peer.membership_id || result.request?.scope_id !== peer.scope_id
        || result.request?.node_id !== peer.node_id || result.request?.realm_id !== peer.realm_id
        || result.request?.resource_id !== peer.resource_id || result.audit_scope_id !== peer.scope_id) {
        mismatchCount += 1;
        continue;
      }
      if (operation.kind === 'read' && (result.read_rows?.length !== 1
        || result.read_rows[0]?.id !== peer.resource_id || result.write_rows?.length !== 0
        || result.emitted_outbox !== null)) mismatchCount += 1;
      if (operation.kind === 'write') {
        if (result.write_rows?.length !== 1 || result.write_rows[0]?.id !== peer.resource_id
          || result.write_rows[0]?.participant_node_id !== peer.node_id
          || result.write_rows[0]?.participant_membership_id !== peer.membership_id
          || result.emitted_outbox?.aggregate_id !== peer.resource_id
          || result.emitted_outbox?.scope_id !== peer.scope_id) mismatchCount += 1;
        if (result.status === 200) successfulWrites += 1;
        for (const row of array(result.write_rows)) {
          if (row.id !== peer.resource_id || row.participant_node_id !== peer.node_id
            || row.participant_membership_id !== peer.membership_id || row.scope_id !== peer.scope_id) nonTargetWrites += 1;
        }
      }
      if (operation.kind === 'capability_probe' && (result.write_rows?.length !== 0
        || result.emitted_outbox !== null || (expectedStatus === 403 && result.denial?.stage !== 'capability'))) mismatchCount += 1;
    }
  }
  const actualKeys = results.map((entry) => `${entry.source_peer_label}|${entry.kind}`);
  mismatchCount += setMismatch([...expectedKeys], actualKeys);
  return {
    decision_mismatch_count: mismatchCount,
    successful_write_count: successfulWrites,
    non_target_write_count: nonTargetWrites,
  };
}

function assessCross(peers, peerByLabel, results, criteriaValue) {
  let requestOrDecisionMismatch = 0;
  let allowed = 0;
  let businessRows = 0;
  let outbox = 0;
  const expectedKeys = new Set();
  const keyByDimension = { realm: 'endpoint_host', membership: 'membership_id', scope: 'scope_id', node: 'node_id', resource: 'resource_id' };
  for (let index = 0; index < peers.length; index += 1) {
    const source = peers[index];
    const donor = peers[(index + 1) % peers.length];
    for (const dimension of criteriaValue.operation_matrix.cross_node_dimensions) {
      for (const kind of criteriaValue.operation_matrix.cross_node_operation_kinds) {
        const key = `${source.label}|${donor.label}|${dimension}|${kind}`;
        expectedKeys.add(key);
        const result = results.find((entry) => entry.source_peer_label === source.label
          && entry.donor_peer_label === donor.label && entry.misuse_dimension === dimension && entry.kind === kind);
        if (!result) {
          requestOrDecisionMismatch += 1;
          continue;
        }
        const baseline = {
          endpoint_host: source.accounts_host,
          membership_id: source.membership_id,
          scope_id: source.scope_id,
          node_id: source.node_id,
          realm_id: source.realm_id,
          resource_id: source.resource_id,
        };
        const changedKey = keyByDimension[dimension];
        const donorValue = changedKey === 'endpoint_host' ? donor.accounts_host
          : changedKey === 'membership_id' ? donor.membership_id
            : changedKey === 'scope_id' ? donor.scope_id
              : changedKey === 'node_id' ? donor.node_id : donor.resource_id;
        for (const [requestKey, expectedValue] of Object.entries(baseline)) {
          const value = requestKey === changedKey ? donorValue : expectedValue;
          if (result.request?.[requestKey] !== value) requestOrDecisionMismatch += 1;
        }
        if (result.status !== 403 || result.denial === null || result.audit_scope_id !== source.scope_id) {
          requestOrDecisionMismatch += 1;
        }
      }
    }
  }
  const actualKeys = results.map((entry) => `${entry.source_peer_label}|${entry.donor_peer_label}|${entry.misuse_dimension}|${entry.kind}`);
  requestOrDecisionMismatch += setMismatch([...expectedKeys], actualKeys);
  for (const result of results) {
    if (result.status === 200) allowed += 1;
    businessRows += array(result.read_rows).length + array(result.write_rows).length;
    if (result.emitted_outbox !== null && result.emitted_outbox !== undefined) outbox += 1;
    if (!peerByLabel.has(result.source_peer_label) || !peerByLabel.has(result.donor_peer_label)) requestOrDecisionMismatch += 1;
  }
  return {
    request_or_decision_mismatch_count: requestOrDecisionMismatch,
    allowed_count: allowed,
    business_row_count: businessRows,
    outbox_count: outbox,
  };
}

function assessDatabase(databaseValue, peers, operationValue, criteriaValue) {
  const seededOrders = table(databaseValue.seeded_before_operations, 'ordering.orderrecord');
  const positiveOrders = table(databaseValue.after_positive_operations, 'ordering.orderrecord');
  const auditRows = table(databaseValue.after_cross_node_operations, 'access.decisionaudit');
  const outboxRows = table(databaseValue.after_cross_node_operations, 'runtime.outbox');
  let resourceVersionMismatch = 0;
  for (const peer of peers) {
    const before = seededOrders.find((row) => row.id === peer.resource_id);
    const after = positiveOrders.find((row) => row.id === peer.resource_id);
    if (!before || Number(before.version) !== 1 || !after || Number(after.version) !== 2
      || after.participant_node_id !== peer.node_id || after.participant_membership_id !== peer.membership_id
      || after.scope_id !== peer.scope_id || !after.evidence?.e01_trace) resourceVersionMismatch += 1;
  }
  const expectedPositiveChanges = ['access.decisionaudit', 'ordering.orderrecord', 'runtime.outbox'];
  const expectedNegativeChanges = ['access.decisionaudit'];
  let unexpectedDiff = setMismatch(expectedPositiveChanges, changedTables(databaseValue.positive_operation_diff));
  unexpectedDiff += setMismatch(expectedNegativeChanges, changedTables(databaseValue.cross_node_operation_diff));
  unexpectedDiff += Number(diff(databaseValue.positive_operation_diff, 'access.decisionaudit')?.count_delta !== criteriaValue.operation_matrix.positive_observation_count);
  unexpectedDiff += Number(diff(databaseValue.positive_operation_diff, 'runtime.outbox')?.count_delta !== criteriaValue.operation_matrix.expected_outbox_count);
  unexpectedDiff += Number(diff(databaseValue.positive_operation_diff, 'ordering.orderrecord')?.count_delta !== 0);
  unexpectedDiff += Number(diff(databaseValue.cross_node_operation_diff, 'access.decisionaudit')?.count_delta !== criteriaValue.operation_matrix.cross_node_observation_count);
  unexpectedDiff += Number(diff(databaseValue.cross_node_operation_diff, 'runtime.outbox')?.changed !== false);
  unexpectedDiff += Number(diff(databaseValue.cross_node_operation_diff, 'ordering.orderrecord')?.changed !== false);
  const expectedAuditTraces = new Set([
    ...operationValue.positive_results.map((entry) => entry.case_id.replace('case:', 'trace:')),
    ...operationValue.cross_node_results.map((entry) => entry.case_id.replace('case:', 'trace:')),
  ]);
  unexpectedDiff += auditRows.filter((row) => !expectedAuditTraces.has(row.trace_id)).length;
  unexpectedDiff += outboxRows.filter((row) => row.event_type !== 'runtime.operation.completed'
    || row.aggregate_type !== 'operation' || !peers.some((peer) => peer.resource_id === row.aggregate_id
      && peer.scope_id === row.scope_id && peer.node_id === row.payload?.node_id)).length;
  const rollbackResidual = Object.values(databaseValue.after_transaction_rollback.tables ?? {})
    .reduce((total, rows) => total + array(rows).length, 0);
  unexpectedDiff += changedTables(databaseValue.rollback_diff).length;
  return {
    audit_count: auditRows.length,
    outbox_count: outboxRows.length,
    resource_version_mismatch_count: resourceVersionMismatch,
    unexpected_diff_count: unexpectedDiff,
    rollback_residual_count: rollbackResidual,
  };
}

function assessModel(modelValue, peers, criteriaValue) {
  const tableNames = modelValue.database_model.tables.map((entry) => entry.table_name).sort();
  const expectedTables = ['node', 'nodeclosure', 'noderelation'];
  const parserCount = array(modelValue.source_inventory?.symbols?.parse_authoritative_node_context).length;
  const adapterCount = array(modelValue.source_inventory?.symbols?.pg_authoritative_node_context_resolver).length;
  const sqlResolverCount = modelValue.database_model.context_resolvers.filter((entry) => entry.function_name === 'resolve_node_context').length;
  const modelIdentities = unique(modelValue.peer_model_assignments.map((entry) => entry.model_identity));
  const pathIdentities = unique(modelValue.peer_model_assignments.map((entry) => entry.path_identity));
  const assignmentMismatch = peers.filter((peer) => !modelValue.peer_model_assignments.some((entry) => entry.peer_label === peer.label
    && entry.node_id === peer.node_id)).length;
  const tableMismatch = setMismatch(expectedTables, tableNames) + assignmentMismatch
    + Number(pathIdentities.length !== criteriaValue.model_and_path_threshold.peer_context_path_identity_count);
  const sourceCopyCount = array(modelValue.source_inventory?.source_copy_ledger).length
    + Math.max(0, parserCount - 1) + Math.max(0, adapterCount - 1) + Math.max(0, sqlResolverCount - 1);
  return {
    table_mismatch_count: tableMismatch,
    sql_context_resolver_count: sqlResolverCount,
    parser_definition_count: parserCount,
    adapter_definition_count: adapterCount,
    peer_model_identity_count: modelIdentities.length,
    source_copy_count: sourceCopyCount,
    node_name_business_branch_count: array(modelValue.source_inventory?.node_name_business_branches).length,
    node_specific_source_file_count: unique(array(modelValue.source_inventory?.node_specific_source_files).map((entry) => entry.path)).length,
  };
}

async function recountSourceInventory(sourceInventory) {
  let mismatches = 0;
  const entries = array(sourceInventory.entries);
  for (const entry of entries) {
    try {
      const bytes = await readFile(join(repositoryRoot, entry.path));
      if (bytes.byteLength !== Number(entry.size_bytes) || `sha256:${sha256(bytes)}` !== entry.sha256) mismatches += 1;
    } catch {
      mismatches += 1;
    }
  }
  if (Number(sourceInventory.file_count) !== entries.length
    || sourceInventory.inventory_digest !== `sha256:${inventoryDigest(entries)}`) mismatches += 1;
  return mismatches;
}

function assessArtifact(artifactValue, environmentValue, peers, criteriaValue) {
  const builds = array(artifactValue.build_invocations);
  const artifactsValue = array(artifactValue.artifacts);
  const assignments = array(artifactValue.peer_artifact_assignments);
  const sourceShas = unique([
    artifactValue.source_sha,
    ...builds.map((entry) => entry.source_sha),
    ...artifactsValue.map((entry) => entry.source_sha),
    ...assignments.map((entry) => entry.source_sha),
  ].filter(Boolean));
  const buildIds = unique([...builds.map((entry) => entry.build_id),
    ...artifactsValue.map((entry) => entry.build_id), ...assignments.map((entry) => entry.build_id)].filter(Boolean));
  const artifactIdentities = unique(artifactsValue.map((entry) => entry.artifact_identity).filter(Boolean));
  let provenanceMismatch = 0;
  for (const build of builds) {
    if (build.scope !== 'shared-runtime' || build.assigned_node_id !== null || build.exit_code !== 0
      || build.source_sha !== environmentValue.source_control.sha || !build.build_id) provenanceMismatch += 1;
  }
  for (const built of artifactsValue) {
    if (built.target !== criteriaValue.shared_build.target || built.marker !== criteriaValue.shared_build.marker
      || built.source_sha !== environmentValue.source_control.sha || !built.build_id
      || built.artifact_identity !== `sha256:${inventoryDigest(array(built.files))}`) provenanceMismatch += 1;
    for (const file of array(built.files)) {
      if (!file.path || !validSha(file.sha256) || !Number.isSafeInteger(Number(file.size_bytes))
        || Number(file.size_bytes) < 0) provenanceMismatch += 1;
    }
  }
  const peerByLabel = new Map(peers.map((peer) => [peer.label, peer]));
  const identities = new Set(artifactIdentities);
  const assignmentMismatch = assignments.filter((entry) => {
    const peer = peerByLabel.get(entry.peer_label);
    return !peer || peer.node_id !== entry.node_id || entry.source_sha !== environmentValue.source_control.sha
      || !buildIds.includes(entry.build_id) || !identities.has(entry.artifact_identity);
  }).length + setMismatch(peers.map((peer) => peer.label), assignments.map((entry) => entry.peer_label));
  if (artifactValue.source_inventory?.inventory_digest !== artifactValue.source_inventory_digest
    || artifactValue.source_inventory_digest !== artifactValue.model_source_inventory_digest) provenanceMismatch += 1;
  return {
    source_sha_unique_count: sourceShas.length,
    build_count: builds.length,
    build_id_unique_count: buildIds.length,
    artifact_identity_count: artifactIdentities.length,
    assignment_count: assignments.length,
    assignment_mismatch_count: assignmentMismatch,
    provenance_or_digest_mismatch_count: provenanceMismatch,
    node_specific_build_count: builds.filter((entry) => entry.scope !== 'shared-runtime' || entry.assigned_node_id !== null).length
      + array(artifactValue.node_specific_builds).length,
  };
}

function observe(thresholdId, expected, actual, met) {
  const observation = Object.freeze({ threshold_id: thresholdId, expected, actual, met });
  thresholds.push(observation);
  if (!met) violations.push(observation);
}

function table(snapshot, name) {
  return array(snapshot?.tables?.[name]);
}

function changedTables(diffValue) {
  return array(diffValue?.tables).filter((entry) => entry.changed).map((entry) => entry.table).sort();
}

function diff(diffValue, name) {
  return array(diffValue?.tables).find((entry) => entry.table === name);
}

function setMismatch(expected, observed) {
  const expectedSet = new Set(expected);
  const observedSet = new Set(observed);
  let mismatches = observed.length - observedSet.size;
  for (const value of expectedSet) if (!observedSet.has(value)) mismatches += 1;
  for (const value of observedSet) if (!expectedSet.has(value)) mismatches += 1;
  return mismatches;
}

function inventoryDigest(entries) {
  return sha256(Buffer.from(entries.map((entry) => `${entry.path}\0${entry.size_bytes}\0${entry.sha256}\n`).join('')));
}

function unique(values) {
  return [...new Set(values)];
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validSha(value) {
  return /^sha256:[a-f0-9]{64}$/.test(value ?? '');
}

function requireArray(value, item, missing, nonempty) {
  if (!Array.isArray(value) || (nonempty && value.length === 0)) missing.push({ item, reason: 'array missing or empty' });
}

function requireValue(value, item, missing) {
  if (value === undefined || value === null) missing.push({ item, reason: 'value missing' });
}

function requiredOption(name) {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`E01_OPTION_VALUE_REQUIRED:${name}`);
  return resolve(value);
}

function readJson(path) {
  return readFile(path, 'utf8').then(JSON.parse);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
