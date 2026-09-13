import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const runDirectory = option('--run-directory');
const criteriaPath = option('--criteria');
const outputPath = option('--output');
const criteria = await readJson(criteriaPath);
const inputNames = criteria.required_input_artifacts;
const loaded = await Promise.all(inputNames.map(async (name) => [name, await optionalJson(join(runDirectory, name))]));
const values = Object.fromEntries(loaded);
const inputs = evidenceInputs(values);
const missingItems = requiredEvidence(criteria, values);
const baseline = reconcile(criteria, inputs);
const negativeProbes = runNegativeProbes(criteria, inputs);
const thresholds = Object.freeze([
  threshold('required_raw_evidence_missing_count', 0, missingItems.length),
  threshold('three_node_and_five_operation_completeness_mismatch_count', 0, baseline.counts.completeness),
  threshold('expected_database_fact_mismatch_count', 0, baseline.counts.database),
  threshold('unexpected_database_audit_or_outbox_fact_count', 0, baseline.counts.unexpected),
  threshold('suspended_or_revoked_residual_access_count', 0, baseline.counts.residualAccess),
  threshold('reactivated_or_granted_expected_access_denial_count', 0, baseline.counts.expectedAccessDenial),
  threshold('hosted_specific_infrastructure_object_count', 0, baseline.counts.hostedObjects),
  threshold('hosted_per_node_infrastructure_action_count', 0, baseline.counts.perNodeActions),
  threshold('hosted_lifecycle_infrastructure_category_event_count', 0, baseline.counts.lifecycleInfrastructure),
  threshold('shared_host_build_artifact_deploy_restart_mismatch_count', 0, baseline.counts.sharedRelease),
  threshold('historical_github_workflow_receipt_mismatch_count', 0, baseline.counts.github),
  threshold('business_source_count_or_digest_change_count', 0, baseline.counts.source),
  threshold('hosted_node_specific_source_or_build_count', 0, baseline.counts.nodeSpecific),
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
  schema_version: 'e05-independent-zero-fanout-recount-v1',
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
  environment_assurance: claimOutcome === 'MET' && inputs.environment?.kind === 'DEV' ? 'DEV VERIFIED' : 'NOT ESTABLISHED',
});
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' });

function evidenceInputs(input) {
  return Object.freeze({
    database: input['hosted-before-after-database.json'],
    timeline: input['hosted-lifecycle-timeline.json'],
    audit: input['hosted-audit-outbox.json'],
    infrastructure: input['hosted-infrastructure-call-counts.json'],
    release: input['hosted-shared-release-receipt.json'],
    runtime: input['hosted-runtime-inventory.json'],
    source: input['hosted-source-inventory.json'],
    github: input['github-workflow-observation.json'],
    environment: input['environment.json'],
  });
}

function requiredEvidence(criteriaValue, input) {
  const missing = [];
  for (const name of criteriaValue.required_input_artifacts) {
    if (!input[name] || typeof input[name] !== 'object') missing.push(`artifact:${name}`);
  }
  for (const [name, path, nonempty] of [
    ['hosted-before-after-database.json', 'fixture.samples', true],
    ['hosted-before-after-database.json', 'after.nodes', true],
    ['hosted-before-after-database.json', 'after.relations', true],
    ['hosted-before-after-database.json', 'after.closure', true],
    ['hosted-before-after-database.json', 'after.memberships', true],
    ['hosted-before-after-database.json', 'after.credentials', true],
    ['hosted-before-after-database.json', 'after.member_profiles', true],
    ['hosted-before-after-database.json', 'after.capability_definitions', true],
    ['hosted-before-after-database.json', 'after.event_definitions', true],
    ['hosted-before-after-database.json', 'after.scope_grants', true],
    ['hosted-before-after-database.json', 'after.entitlements', true],
    ['hosted-lifecycle-timeline.json', 'operation_receipts', true],
    ['hosted-lifecycle-timeline.json', 'stages', true],
    ['hosted-audit-outbox.json', 'decision_audit', true],
    ['hosted-audit-outbox.json', 'runtime_outbox', true],
    ['hosted-infrastructure-call-counts.json', 'lifecycle_operation_receipts', true],
    ['hosted-runtime-inventory.json', 'shared_test_environment.process_lines', true],
    ['hosted-runtime-inventory.json', 'shared_test_environment.port_mappings', true],
    ['hosted-source-inventory.json', 'before.entries', true],
    ['hosted-source-inventory.json', 'after.entries', true],
  ]) requireArray(at(input[name], path), `${name}:${path}`, missing, nonempty);
  for (const field of ['receipt.workflow.run_id', 'receipt.workflow.url', 'receipt.workflow.event',
    'receipt.workflow.conclusion', 'receipt.release.source_sha', 'receipt.release.artifact_id',
    'receipt.release.tree_digest', 'receipt.release.previous', 'receipt.release.current',
    'receipt.release.build_count', 'receipt.release.deploy_count', 'receipt.release.restart.command_count']) {
    requireValue(at(input['hosted-shared-release-receipt.json'], field), `shared-release:${field}`, missing);
  }
  for (const field of ['workflow.databaseId', 'workflow.url', 'workflow.event', 'workflow.conclusion',
    'workflow.startedAt', 'workflow.updatedAt', 'workflow.headSha', 'workflow.workflowName']) {
    requireValue(at(input['github-workflow-observation.json'], field), `github:${field}`, missing);
  }
  for (const field of ['kind', 'environment_id', 'description', 'owner', 'isolation', 'production_impact', 'runtime',
    'source_control', 'configuration_digest']) requireValue(input['environment.json']?.[field], `environment:${field}`, missing);
  for (const stage of array(input['hosted-lifecycle-timeline.json']?.stages)) {
    requireValue(stage.stage, 'timeline:stage id', missing);
    requireValue(stage.observed_at, `${stage.stage ?? 'stage'}:observed_at`, missing);
    requireArray(stage.access, `${stage.stage ?? 'stage'}:access`, missing, true);
    for (const access of array(stage.access)) {
      for (const field of ['node_id', 'membership_id', 'capability_id', 'scope_grant_id', 'observed_at', 'inputs']) {
        requireValue(access[field], `${stage.stage ?? 'stage'}:${field}`, missing);
      }
      for (const field of ['node_status', 'membership_status', 'scope_effect', 'scope_effective_at',
        'entitlement_state', 'entitlement_effective_at']) requireValue(access.inputs?.[field], `${stage.stage ?? 'stage'}:inputs:${field}`, missing);
    }
  }
  return [...new Set(missing)].sort();
}

function reconcile(criteriaValue, input) {
  const violations = [];
  const add = (bucket, code, details, amount = 1) => violations.push(Object.freeze({ bucket, code, amount, details }));
  const expectedSamples = array(criteriaValue.sample_matrix);
  const samples = array(input.database?.fixture?.samples);
  const sampleById = new Map(samples.map((entry) => [entry.sample_id, entry]));
  const expectedOperationCounts = new Map([['create', 3], ['suspend', 1], ['reactivate', 1], ['grant', 1], ['revoke', 1]]);
  const receipts = array(input.timeline?.operation_receipts);
  const stages = array(input.timeline?.stages);
  const stageByName = new Map(stages.map((entry) => [entry.stage, entry]));

  compareSet(expectedSamples.map((entry) => entry.sample_id), samples.map((entry) => entry.sample_id),
    'SAMPLE_SET_MISMATCH', 'completeness', add);
  for (const expected of expectedSamples) {
    const actual = sampleById.get(expected.sample_id);
    if (!actual || actual.signed_level !== expected.signed_level
      || !sameSet(actual.lifecycle_operations, expected.lifecycle_operations)) {
      add('completeness', 'SAMPLE_DEFINITION_MISMATCH', { expected, actual });
    }
  }
  compareSet(criteriaValue.operation_sequence, [...new Set(receipts.map((entry) => entry.operation))],
    'OPERATION_CATEGORY_SET_MISMATCH', 'completeness', add);
  for (const [operation, expectedCount] of expectedOperationCounts) {
    const actualCount = receipts.filter((entry) => entry.operation === operation).length;
    if (actualCount !== expectedCount) add('completeness', 'OPERATION_RECEIPT_COUNT_MISMATCH', {
      operation, expected: expectedCount, actual: actualCount,
    }, Math.abs(expectedCount - actualCount) || 1);
  }
  compareSet(['after_create', 'after_suspend', 'after_reactivate', 'after_grant', 'after_revoke'],
    stages.map((entry) => entry.stage), 'STAGE_SET_MISMATCH', 'completeness', add);

  validateDatabase(criteriaValue, input.database, samples, receipts, add);
  const accessCounts = validateAccess(criteriaValue, stageByName, add);
  validateAuditOutbox(input.audit, samples, add);
  const infrastructureCounts = validateInfrastructure(criteriaValue, input, add);
  const releaseCounts = validateRelease(criteriaValue, input.release, add);
  const githubCount = validateGithub(criteriaValue, input.release, input.github, add);
  const sourceCounts = validateSource(input.source, add);

  const bucketCount = (bucket) => violations.filter((entry) => entry.bucket === bucket)
    .reduce((total, entry) => total + Number(entry.amount ?? 1), 0);
  const counts = Object.freeze({
    completeness: bucketCount('completeness'),
    database: bucketCount('database'),
    unexpected: bucketCount('unexpected'),
    residualAccess: accessCounts.residual,
    expectedAccessDenial: accessCounts.deniedExpected,
    hostedObjects: infrastructureCounts.hostedObjects,
    perNodeActions: infrastructureCounts.perNodeActions,
    lifecycleInfrastructure: infrastructureCounts.lifecycleEvents,
    sharedRelease: releaseCounts,
    github: githubCount,
    source: sourceCounts.source,
    nodeSpecific: sourceCounts.nodeSpecific,
  });
  return Object.freeze({
    violations,
    counts,
    observations: Object.freeze({
      sample_ids: samples.map((entry) => entry.sample_id),
      node_ids: samples.map((entry) => entry.node_id),
      operation_counts: Object.fromEntries([...expectedOperationCounts].map(([operation]) => [operation,
        receipts.filter((entry) => entry.operation === operation).length])),
      access_decisions: Object.fromEntries(stages.flatMap((stage) => array(stage.access).map((access) => [
        `${stage.stage}:${access.node_id}:${access.scope_grant_id.endsWith(':extra') ? 'extra' : 'base'}`,
        recomputeAllowed(access),
      ]))),
      final_database_counts: input.database?.after?.counts ?? null,
      audit_count: array(input.audit?.decision_audit).length,
      outbox_count: array(input.audit?.runtime_outbox).length,
      hosted_lifecycle_counts: input.infrastructure?.hosted_lifecycle ?? null,
      shared_release_counts: input.infrastructure?.shared_host_change ?? null,
      github_run_id: input.github?.workflow?.databaseId ?? null,
      source_file_count: input.source?.before?.file_count ?? null,
    }),
  });
}

function validateDatabase(criteriaValue, value, samples, receipts, add) {
  const before = value?.before ?? {};
  const after = value?.after ?? {};
  const beforeArrays = ['nodes', 'relations', 'closure', 'realms', 'memberships', 'accounts', 'principals', 'credentials',
    'member_profiles', 'capability_definitions', 'event_definitions', 'node_capabilities', 'scope_grants', 'entitlements',
    'provisioning', 'manifests', 'resource_bindings'];
  for (const name of beforeArrays) if (array(before[name]).length !== 0) {
    add('unexpected', 'BEFORE_FIXTURE_NOT_EMPTY', { name, count: array(before[name]).length }, array(before[name]).length);
  }
  if (Object.values(before.counts ?? {}).some((count) => Number(count) !== 0)) {
    add('unexpected', 'BEFORE_COUNT_NOT_ZERO', { counts: before.counts });
  }
  const expected = criteriaValue.expected_database_facts;
  const mappings = {
    hosted_node_count: after.counts?.hosted_nodes,
    current_relation_count: after.counts?.current_relations,
    active_final_node_count: after.counts?.active_nodes,
    active_membership_count: after.counts?.active_memberships,
    active_base_scope_count: after.counts?.active_base_scopes,
    enabled_base_entitlement_count: after.counts?.enabled_base_entitlements,
    revoked_extra_scope_row_count: after.counts?.extra_scope_rows,
    revoked_extra_scope_active_count: after.counts?.active_extra_scopes,
    decision_audit_count: after.counts?.audit_rows,
    outbox_count: after.counts?.outbox_rows,
    hosted_manifest_count: after.counts?.manifest_rows,
    hosted_resource_binding_count: after.counts?.resource_binding_rows,
  };
  for (const [field, actual] of Object.entries(mappings)) if (Number(actual) !== Number(expected[field])) {
    add('database', 'DATABASE_COUNT_MISMATCH', { field, expected: expected[field], actual });
  }
  const extraEntitlement = array(after.entitlements).find((entry) => entry.id.endsWith(':extra'));
  if (extraEntitlement?.state !== expected.revoked_extra_entitlement_state || !extraEntitlement?.expires_at) {
    add('database', 'REVOKED_ENTITLEMENT_STATE_MISMATCH', { expected: expected.revoked_extra_entitlement_state, actual: extraEntitlement });
  }
  const nodeIds = samples.map((entry) => entry.node_id);
  for (const [name, rows, expectedCount] of [
    ['nodes', after.nodes, 3], ['relations', after.relations, 3], ['closure', after.closure, 6], ['realms', after.realms, 3],
    ['memberships', after.memberships, 3], ['accounts', after.accounts, 3], ['principals', after.principals, 3],
    ['credentials', after.credentials, 3], ['member_profiles', after.member_profiles, 3],
    ['capability_definitions', after.capability_definitions, 2], ['event_definitions', after.event_definitions, 4],
    ['node_capabilities', after.node_capabilities, 3], ['scope_grants', after.scope_grants, 4],
    ['entitlements', after.entitlements, 4], ['provisioning', after.provisioning, 3],
    ['manifests', after.manifests, 0], ['resource_bindings', after.resource_bindings, 0],
  ]) if (array(rows).length !== expectedCount) add('unexpected', 'RAW_DATABASE_CARDINALITY_MISMATCH', {
    name, expected: expectedCount, actual: array(rows).length,
  }, Math.abs(expectedCount - array(rows).length) || 1);
  for (const node of array(after.nodes)) {
    if (!nodeIds.includes(node.id) || node.sovereignty_tier !== 'hosted' || node.node_profile !== 'consumer'
      || node.status !== 'active' || node.mall_id !== null) add('database', 'HOSTED_NODE_FINAL_STATE_MISMATCH', { node });
  }
  for (const relation of array(after.relations)) {
    if (!nodeIds.includes(relation.node_id) || relation.host_sovereign_node_id !== value?.fixture?.host_sovereign_node_id
      || relation.superseded_at !== null || Number(relation.relation_version) !== 1) {
      add('database', 'HOSTED_RELATION_STATE_MISMATCH', { relation });
    }
  }
  for (const receipt of receipts.filter((entry) => entry.operation === 'create')) {
    if (receipt.production_function !== 'organization.provision_hosted_node(jsonb)'
      || receipt.production_response?.node_id !== receipt.node_id || receipt.production_response?.sovereignty_tier !== 'hosted') {
      add('database', 'CREATE_PRODUCTION_RESPONSE_MISMATCH', { receipt_id: receipt.receipt_id, response: receipt.production_response });
    }
  }
}

function validateAccess(criteriaValue, stages, add) {
  const checks = [
    ['after_create', true, 'expected'],
    ['after_suspend', false, 'denied'],
    ['after_reactivate', true, 'expected'],
    ['after_grant', true, 'expected'],
    ['after_revoke', false, 'denied'],
  ];
  let residual = 0;
  let deniedExpected = 0;
  for (const [stageName, expected, kind] of checks) {
    const decisions = array(stages.get(stageName)?.access);
    const expectedCount = stageName === 'after_create' ? 3 : 1;
    if (decisions.length !== expectedCount) {
      add('completeness', 'ACCESS_STAGE_CARDINALITY_MISMATCH', { stage: stageName, expected: expectedCount, actual: decisions.length });
    }
    for (const decision of decisions) {
      const recomputed = recomputeAllowed(decision);
      if (decision.allowed !== recomputed) add('database', 'EXPORTED_ACCESS_DECISION_MISMATCH', {
        stage: stageName, node_id: decision.node_id, exported: decision.allowed, recomputed,
      });
      if (recomputed !== expected) {
        if (kind === 'denied' && recomputed) {
          residual += 1;
          add('access', 'RESIDUAL_ACCESS', { stage: stageName, node_id: decision.node_id });
        } else {
          deniedExpected += 1;
          add('access', 'EXPECTED_ACCESS_DENIED', { stage: stageName, node_id: decision.node_id });
        }
      }
    }
  }
  return Object.freeze({ residual, deniedExpected });
}

function recomputeAllowed(observation) {
  const inputs = observation?.inputs;
  if (!inputs) return false;
  const observedAt = Date.parse(observation.observed_at);
  return inputs.node_status === 'active' && inputs.membership_status === 'active' && inputs.scope_effect === 'allow'
    && Date.parse(inputs.scope_effective_at) <= observedAt
    && (inputs.scope_expires_at === null || Date.parse(inputs.scope_expires_at) > observedAt)
    && inputs.entitlement_state === 'enabled' && Date.parse(inputs.entitlement_effective_at) <= observedAt
    && (inputs.entitlement_expires_at === null || Date.parse(inputs.entitlement_expires_at) > observedAt);
}

function validateAuditOutbox(value, samples, add) {
  const audits = array(value?.decision_audit);
  const outbox = array(value?.runtime_outbox);
  const expectedOps = ['create', 'create', 'create', 'grant', 'reactivate', 'revoke', 'suspend'];
  const auditOps = audits.map((entry) => String(entry.operation).replace('organization.hosted.', '')).sort();
  const outboxOps = outbox.map((entry) => entry.payload?.operation).sort();
  if (!sameArray(auditOps, expectedOps)) add('unexpected', 'AUDIT_OPERATION_MULTISET_MISMATCH', { expected: expectedOps, actual: auditOps });
  if (!sameArray(outboxOps, expectedOps)) add('unexpected', 'OUTBOX_OPERATION_MULTISET_MISMATCH', { expected: expectedOps, actual: outboxOps });
  if (audits.length !== 7) add('unexpected', 'AUDIT_COUNT_MISMATCH', { expected: 7, actual: audits.length }, Math.abs(7 - audits.length) || 1);
  if (outbox.length !== 7) add('unexpected', 'OUTBOX_COUNT_MISMATCH', { expected: 7, actual: outbox.length }, Math.abs(7 - outbox.length) || 1);
  const nodeIds = new Set(samples.map((entry) => entry.node_id));
  for (const audit of audits) if (!nodeIds.has(audit.resource_id) || audit.decision !== 'allow'
    || audit.reason !== 'E05_HOSTED_DATA_ONLY' || audit.trace_id !== value.trace_id) {
    add('unexpected', 'AUDIT_ROW_MISMATCH', { audit });
  }
  for (const event of outbox) if (!nodeIds.has(event.aggregate_id) || event.trace_id !== value.trace_id
    || event.payload?.node_id !== event.aggregate_id || Number(event.payload?.infrastructure_action_count) !== 0) {
    add('unexpected', 'OUTBOX_ROW_MISMATCH', { event });
  }
}

function validateInfrastructure(criteriaValue, input, add) {
  const categoryValues = criteriaValue.hosted_lifecycle_zero_categories.map((category) => Number(
    input.infrastructure?.hosted_lifecycle?.[category] ?? 0));
  const lifecycleEvents = categoryValues.reduce((total, value) => total + value, 0)
    + array(input.infrastructure?.lifecycle_operation_receipts).reduce((total, receipt) => total + array(receipt.infrastructure_actions).length, 0);
  if (lifecycleEvents !== 0) add('infrastructure', 'HOSTED_LIFECYCLE_INFRASTRUCTURE_EVENT', { lifecycle_events: lifecycleEvents });
  const processLines = array(input.runtime?.shared_test_environment?.process_lines);
  const portMappings = array(input.runtime?.shared_test_environment?.port_mappings);
  const tokens = array(input.runtime?.hosted_identity_tokens);
  const processMatches = processLines.filter((line) => tokens.some((token) => String(line).includes(token)));
  const portMatches = portMappings.filter((line) => tokens.some((token) => String(line).includes(token)));
  const manifests = array(input.database?.after?.manifests);
  const resources = array(input.database?.after?.resource_bindings);
  const pointers = array(input.runtime?.hosted_specific_pointer_references);
  const hostedObjects = processMatches.length + portMatches.length + manifests.length + resources.length + pointers.length;
  if (hostedObjects !== 0) add('infrastructure', 'HOSTED_INFRASTRUCTURE_OBJECT', {
    process_matches: processMatches, port_matches: portMatches, manifest_count: manifests.length,
    resource_count: resources.length, pointers,
  }, hostedObjects);
  if (!deepEqual(processMatches, input.runtime?.hosted_specific_process_matches)
    || !deepEqual(portMatches, input.runtime?.hosted_specific_port_matches)) {
    add('infrastructure', 'RUNTIME_MATCH_RECOUNT_MISMATCH', { processMatches, portMatches });
  }
  const perNodeActions = Number(input.infrastructure?.shared_host_change?.hosted_per_node_action_count ?? 0)
    + array(input.infrastructure?.lifecycle_operation_receipts).reduce((total, receipt) => total + array(receipt.infrastructure_actions).length, 0);
  if (perNodeActions !== 0) add('infrastructure', 'HOSTED_PER_NODE_ACTION', { count: perNodeActions }, perNodeActions);
  return Object.freeze({ hostedObjects, perNodeActions, lifecycleEvents });
}

function validateRelease(criteriaValue, value, add) {
  const expected = criteriaValue.shared_host_release_threshold;
  const receipt = value?.receipt ?? {};
  const actual = {
    workflow_run_id: receipt.workflow?.run_id,
    workflow_conclusion: receipt.workflow?.conclusion,
    source_sha: receipt.release?.source_sha,
    release_node: receipt.release?.node,
    release_target: receipt.release?.target,
    build_count: receipt.release?.build_count,
    artifact_identity_count: receipt.release?.artifact_identity_count,
    deploy_count: receipt.release?.deploy_count,
    restart_count: receipt.release?.restart?.command_count,
    hosted_per_node_action_count: receipt.release?.hosted_per_node_action_count,
  };
  let mismatches = 0;
  for (const [field, expectedValue] of Object.entries(expected)) if (actual[field] !== expectedValue) {
    mismatches += 1;
    add('release', 'SHARED_RELEASE_FIELD_MISMATCH', { field, expected: expectedValue, actual: actual[field] });
  }
  if (!validSha(receipt.release?.tree_digest) || receipt.release?.previous === receipt.release?.current
    || receipt.release?.final_status !== 'success') {
    mismatches += 1;
    add('release', 'SHARED_RELEASE_PROVENANCE_MISMATCH', { release: receipt.release });
  }
  const expectedSource = criteriaValue.regression_basis.find((entry) => entry.path.endsWith('hosted-shared-release-receipt.json'));
  if (value?.source_artifact?.sha256 !== expectedSource?.sha256 || value?.source_artifact?.git_commit !== expectedSource?.git_commit) {
    mismatches += 1;
    add('release', 'FROZEN_RELEASE_SOURCE_MISMATCH', { expected: expectedSource, actual: value?.source_artifact });
  }
  return mismatches;
}

function validateGithub(criteriaValue, releaseValue, githubValue, add) {
  const expected = criteriaValue.shared_host_release_threshold;
  const workflow = githubValue?.workflow ?? {};
  const receipt = releaseValue?.receipt ?? {};
  const comparisons = [
    ['databaseId', expected.workflow_run_id, workflow.databaseId],
    ['conclusion', expected.workflow_conclusion, workflow.conclusion],
    ['headSha', expected.source_sha, workflow.headSha],
    ['event', receipt.workflow?.event, workflow.event],
    ['url', receipt.workflow?.url, workflow.url],
    ['workflowName', 'Deploy', workflow.workflowName],
  ];
  let mismatches = 0;
  for (const [field, expectedValue, actual] of comparisons) if (expectedValue !== actual) {
    mismatches += 1;
    add('github', 'GITHUB_WORKFLOW_MISMATCH', { field, expected: expectedValue, actual });
  }
  return mismatches;
}

function validateSource(value, add) {
  const before = value?.before ?? {};
  const after = value?.after ?? {};
  let source = 0;
  if (!validSha(before.inventory_sha256) || before.inventory_sha256 !== inventoryDigest(before.entries)
    || !validSha(after.inventory_sha256) || after.inventory_sha256 !== inventoryDigest(after.entries)
    || Number(before.file_count) !== array(before.entries).length || Number(after.file_count) !== array(after.entries).length
    || before.file_count !== after.file_count || before.inventory_sha256 !== after.inventory_sha256) {
    source += 1;
    add('source', 'SOURCE_INVENTORY_CHANGED', { before: summarizeInventory(before), after: summarizeInventory(after) });
  }
  if (array(value?.build_invocations_during_lifecycle).length !== 0) {
    source += array(value.build_invocations_during_lifecycle).length;
    add('source', 'LIFECYCLE_BUILD_INVOCATION', { builds: value.build_invocations_during_lifecycle },
      array(value.build_invocations_during_lifecycle).length);
  }
  const nodeSpecific = Number(before.hosted_node_specific_file_count ?? 0) + Number(after.hosted_node_specific_file_count ?? 0)
    + array(value?.hosted_node_specific_builds).length
    + array(before.entries).reduce((total, entry) => total + array(entry.hosted_node_specific_tokens).length, 0)
    + array(after.entries).reduce((total, entry) => total + array(entry.hosted_node_specific_tokens).length, 0);
  if (nodeSpecific !== 0) add('source', 'HOSTED_NODE_SPECIFIC_SOURCE_OR_BUILD', { count: nodeSpecific }, nodeSpecific);
  return Object.freeze({ source, nodeSpecific });
}

function runNegativeProbes(criteriaValue, input) {
  if (!input.database || !input.timeline || !input.infrastructure || !input.audit) return [];
  const infrastructureMutation = structuredClone(input);
  infrastructureMutation.database.after.manifests.push({ node_id: infrastructureMutation.database.fixture.samples[0].node_id,
    manifest_id: 'manifest:e05-mutated' });

  const accessMutation = structuredClone(input);
  const suspended = accessMutation.timeline.stages.find((entry) => entry.stage === 'after_suspend')?.access?.[0];
  if (suspended) suspended.inputs.node_status = 'active';

  const releaseMutation = structuredClone(input);
  releaseMutation.infrastructure.shared_host_change.hosted_per_node_action_count = 3;
  releaseMutation.release.receipt.release.hosted_per_node_action_count = 3;

  const factMutation = structuredClone(input);
  factMutation.audit.decision_audit.push({
    id: 'audit:e05:unexpected', operation: 'organization.hosted.unexpected', resource_id: 'node:e05:unexpected:l2',
    decision: 'allow', reason: 'unexpected', trace_id: factMutation.audit.trace_id,
  });

  return Object.freeze([
    probe('hosted-infrastructure-object', 'HOSTED_INFRASTRUCTURE_OBJECT', criteriaValue, infrastructureMutation),
    probe('suspended-residual-access', 'RESIDUAL_ACCESS', criteriaValue, accessMutation),
    probe('per-node-release-fanout', 'HOSTED_PER_NODE_ACTION', criteriaValue, releaseMutation),
    probe('unexpected-audit-fact', 'AUDIT_OPERATION_MULTISET_MISMATCH', criteriaValue, factMutation),
  ]);
}

function probe(probeId, expectedCode, criteriaValue, input) {
  const result = reconcile(criteriaValue, input);
  const detectedCodes = [...new Set(result.violations.map((entry) => entry.code))].sort();
  return Object.freeze({
    probe_id: probeId,
    expected_violation: expectedCode,
    detected: detectedCodes.includes(expectedCode),
    detected_codes: detectedCodes,
  });
}

function inventoryDigest(entries) {
  const sorted = [...array(entries)].sort((left, right) => String(left.path).localeCompare(String(right.path)));
  return `sha256:${sha256(Buffer.from(sorted.map((entry) => `${entry.path}\0${entry.size_bytes}\0${entry.sha256}\n`).join('')))}`;
}

function summarizeInventory(value) {
  return { file_count: value?.file_count, inventory_sha256: value?.inventory_sha256, entry_count: array(value?.entries).length };
}

function compareSet(expected, actual, code, bucket, add) {
  if (!sameSet(expected, actual)) add(bucket, code, { expected, actual });
}

function sameSet(left, right) {
  const leftArray = array(left).map(String).sort();
  const rightArray = array(right).map(String).sort();
  return sameArray(leftArray, rightArray);
}

function sameArray(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function deepEqual(left, right) {
  return canonical(left) === canonical(right);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

function validSha(value) {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
}

function threshold(thresholdId, expected, actual) {
  return Object.freeze({ threshold_id: thresholdId, expected, actual, met: actual === expected });
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function at(value, path) {
  return path.split('.').reduce((current, key) => current?.[key], value);
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
  if (!value || value.startsWith('--')) throw new Error(`E05_OPTION_VALUE_REQUIRED:${name}`);
  return value;
}
