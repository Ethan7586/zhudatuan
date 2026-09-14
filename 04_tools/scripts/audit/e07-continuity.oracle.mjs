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
const evidence = evidenceInputs(inputs);
const missingItems = requiredEvidence(criteria, inputs);
const baseline = reconcile(criteria, evidence);
const negativeProbes = runNegativeProbes(criteria, evidence);
const thresholds = Object.freeze([
  threshold('required_raw_evidence_missing_count', 0, missingItems.length),
  threshold('four_level_sample_and_transition_completeness_mismatch_count', 0, baseline.counts.completeness),
  threshold('identity_realm_line_parent_level_membership_account_principal_change_count', 0, baseline.counts.identity),
  threshold('lineage_or_immutable_history_digest_change_count', 0, baseline.counts.historyDigest),
  threshold('hosted_opening_authority_or_allowed_addition_mismatch_count', 0, baseline.counts.opening),
  threshold('hosted_infrastructure_call_delta', 0, baseline.counts.infrastructure),
  threshold('selected_sovereign_target_identity_replacement_count', 0, baseline.counts.upgradeIdentity),
  threshold('sovereign_four_step_timeline_mismatch_count', 0, baseline.counts.timeline),
  threshold('sovereign_resource_readiness_or_uniqueness_mismatch_count', 0, baseline.counts.resources),
  threshold('manifest_digest_node_binding_or_release_pointer_mismatch_count', 0, baseline.counts.manifest),
  threshold('non_target_transition_change_count', 0, baseline.counts.nonTarget),
  threshold('unexpected_relation_capability_or_history_change_count', 0, baseline.counts.unexpectedHistory),
  threshold('business_source_count_or_digest_change_count', 0, baseline.counts.source),
  threshold('node_specific_source_copy_or_build_count', 0, baseline.counts.nodeSpecific),
  threshold('rollback_restoration_mismatch_count', 0, baseline.counts.rollback),
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
  schema_version: 'e07-independent-continuity-recount-v1',
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
  environment_assurance: claimOutcome === 'MET' && evidence.environment?.kind === 'DEV' ? 'DEV VERIFIED' : 'NOT ESTABLISHED',
});
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' });

function evidenceInputs(values) {
  return Object.freeze({
    opening: values['mall-opening-lineage-before-after.json'],
    infrastructure: values['mall-opening-infra-counts.json'],
    timeline: values['sovereign-upgrade-state-timeline.json'],
    manifests: values['sovereign-upgrade-manifest-pointers.json'],
    history: values['history-digests.json'],
    nonTarget: values['nontarget-transition-diff.json'],
    sourceBuild: values['source-build-counts.json'],
    rollback: values['rollback-receipts.json'],
    raw: values['continuity-database-raw-rows.json'],
    environment: values['environment.json'],
  });
}

function requiredEvidence(criteriaValue, values) {
  const missing = [];
  for (const name of criteriaValue.required_input_artifacts) {
    if (!values[name] || typeof values[name] !== 'object') missing.push(`artifact:${name}`);
  }
  const arrayRequirements = [
    ['mall-opening-lineage-before-after.json', 'samples'],
    ['mall-opening-infra-counts.json', 'fixture_setup.setup_receipts'],
    ['mall-opening-infra-counts.json', 'fixture_setup.fixture_parent_receipts'],
    ['sovereign-upgrade-state-timeline.json', 'upgrades'],
    ['sovereign-upgrade-manifest-pointers.json', 'upgrades'],
    ['history-digests.json', 'samples'],
    ['nontarget-transition-diff.json', 'comparisons'],
    ['source-build-counts.json', 'before.entries'],
    ['source-build-counts.json', 'after.entries'],
    ['rollback-receipts.json', 'receipts'],
  ];
  for (const [name, path] of arrayRequirements) requireArray(at(values[name], path), `${name}:${path}`, missing, true);
  for (const field of ['nodes', 'relations', 'closure', 'realms', 'memberships', 'accounts', 'principals', 'capabilities',
    'provisioning', 'openings', 'configurations', 'entity_bindings', 'upgrades', 'sovereignty_versions',
    'domain_binding_sets', 'domain_bindings', 'resource_binding_sets', 'manifests', 'upgrade_steps', 'outbox']) {
    requireArray(values['continuity-database-raw-rows.json']?.[field], `database:${field}`, missing, field !== 'closure');
  }
  for (const field of ['kind', 'environment_id', 'description', 'owner', 'isolation', 'production_impact', 'runtime',
    'source_control', 'configuration_digest']) requireValue(values['environment.json']?.[field], `environment:${field}`, missing);

  for (const sample of array(values['mall-opening-lineage-before-after.json']?.samples)) {
    const id = sample.sample?.signed_level ?? 'opening-sample';
    for (const field of ['sample.node_id', 'sample.realm_id', 'sample.membership_id', 'sample.account_id',
      'sample.principal_id', 'operation.request', 'operation.response', 'before.context', 'after.context',
      'before.current_lineage', 'after.current_lineage']) requireValue(at(sample, field), `${id}:${field}`, missing);
  }
  for (const item of array(values['history-digests.json']?.samples)) {
    for (const stage of ['before_opening', 'after_opening', 'after_upgrade', 'after_rollback']) {
      requireValue(item[stage]?.identity_lineage_sha256, `${item.node_id ?? 'history'}:${stage}:identity`, missing);
      requireValue(item[stage]?.immutable_history_sha256, `${item.node_id ?? 'history'}:${stage}:immutable-history`, missing);
    }
  }
  for (const item of array(values['sovereign-upgrade-state-timeline.json']?.upgrades)) {
    const id = item.sample?.signed_level ?? 'upgrade';
    for (const field of ['sample.node_id', 'request', 'response.upgrade_id', 'upgrade', 'sovereignty_versions', 'steps',
      'relation_history']) requireValue(at(item, field), `${id}:${field}`, missing);
  }
  for (const item of array(values['sovereign-upgrade-manifest-pointers.json']?.upgrades)) {
    const id = item.sample?.signed_level ?? 'manifest';
    for (const field of ['sample.node_id', 'upgrade_id', 'domain_binding_sets', 'domain_bindings',
      'resource_binding_sets', 'manifests']) requireValue(at(item, field), `${id}:${field}`, missing);
  }
  for (const item of array(values['rollback-receipts.json']?.receipts)) {
    const id = item.sample?.signed_level ?? 'rollback';
    for (const field of ['sample.node_id', 'upgrade_id', 'result', 'after_rollback.context', 'upgrade_rows.upgrade',
      'upgrade_rows.steps', 'upgrade_rows.relation_history']) requireValue(at(item, field), `${id}:${field}`, missing);
  }
  return [...new Set(missing)].sort();
}

function reconcile(criteriaValue, input) {
  const violations = [];
  const add = (bucket, code, details) => violations.push(Object.freeze({ bucket, code, details }));
  const expectedSamples = array(criteriaValue.sample_matrix);
  const expectedLevels = expectedSamples.map((entry) => entry.signed_level);
  const targetLevels = expectedSamples.filter((entry) => entry.sovereign_upgrade).map((entry) => entry.signed_level);
  const nonTargetLevels = expectedSamples.filter((entry) => !entry.sovereign_upgrade).map((entry) => entry.signed_level);
  const openingSamples = array(input.opening?.samples);
  const historySamples = array(input.history?.samples);
  const timelineUpgrades = array(input.timeline?.upgrades);
  const manifestUpgrades = array(input.manifests?.upgrades);
  const rollbackReceipts = array(input.rollback?.receipts);
  const openingByLevel = uniqueMap(openingSamples, (entry) => entry.sample?.signed_level, 'opening', add);
  const timelineByLevel = uniqueMap(timelineUpgrades, (entry) => entry.sample?.signed_level, 'timeline', add);
  const manifestByLevel = uniqueMap(manifestUpgrades, (entry) => entry.sample?.signed_level, 'manifest', add);
  const rollbackByLevel = uniqueMap(rollbackReceipts, (entry) => entry.sample?.signed_level, 'rollback', add);
  const historyByNode = uniqueMap(historySamples, (entry) => entry.node_id, 'history', add);

  compareSet(expectedLevels, openingSamples.map((entry) => entry.sample?.signed_level), 'SAMPLE_MATRIX_MISMATCH', 'opening', add);
  compareSet(targetLevels, timelineUpgrades.map((entry) => entry.sample?.signed_level), 'UPGRADE_TARGET_MATRIX_MISMATCH', 'completeness', add);
  compareSet(targetLevels, manifestUpgrades.map((entry) => entry.sample?.signed_level), 'MANIFEST_TARGET_MATRIX_MISMATCH', 'completeness', add);
  compareSet(targetLevels, rollbackReceipts.map((entry) => entry.sample?.signed_level), 'ROLLBACK_TARGET_MATRIX_MISMATCH', 'completeness', add);
  compareSet(targetLevels, array(input.nonTarget?.target_node_ids).map((id) => levelForNode(openingSamples, id)),
    'TARGET_NODE_SET_MISMATCH', 'completeness', add);
  compareSet(nonTargetLevels, array(input.nonTarget?.non_target_node_ids).map((id) => levelForNode(openingSamples, id)),
    'NON_TARGET_NODE_SET_MISMATCH', 'completeness', add);

  for (const expected of expectedSamples) {
    const item = openingByLevel.get(expected.signed_level);
    if (!item) continue;
    const before = item.before;
    const after = item.after;
    const response = item.operation?.response;
    const sampleValue = item.sample;
    compareIdentity(before, after, criteriaValue.immutable_identity_and_lineage_fields, 'OPENING_IDENTITY_CHANGED', 'identity', add);
    const expectedBefore = {
      node_id: sampleValue.node_id,
      realm_id: sampleValue.realm_id,
      membership_id: sampleValue.membership_id,
      account_id: sampleValue.account_id,
      principal_id: sampleValue.principal_id,
      signed_level: expected.signed_level,
    };
    compareFields(expectedBefore, identityAnchor(before), Object.keys(expectedBefore), 'FIXTURE_IDENTITY_MISMATCH', 'identity', add);
    validateOpening(item, add);

    const history = historyByNode.get(sampleValue.node_id);
    if (!history) add('historyDigest', 'HISTORY_SAMPLE_MISSING', { node_id: sampleValue.node_id });
    else validateHistoryDigests(history, add);

    if (expected.sovereign_upgrade) {
      const upgrade = timelineByLevel.get(expected.signed_level);
      const manifest = manifestByLevel.get(expected.signed_level);
      const rollback = rollbackByLevel.get(expected.signed_level);
      if (upgrade) {
        compareIdentity(before, snapshotFromUpgrade(upgrade, item), criteriaValue.immutable_identity_and_lineage_fields,
          'UPGRADE_IDENTITY_REPLACED', 'upgradeIdentity', add);
        validateUpgrade(upgrade, item, add);
      }
      if (manifest) validateManifest(manifest, sampleValue.node_id, add);
      if (rollback) validateRollback(rollback, item, add);
    }
  }

  validateOpeningRawRows(input.raw, openingSamples, add);
  validateInfrastructure(input.infrastructure, expectedSamples.length, add);
  validateNonTargets(input.nonTarget, input.rollback, openingSamples, add);
  validateHistoryShapes(openingSamples, rollbackByLevel, targetLevels, add);
  validateSourceBuild(input.sourceBuild, add);
  validateRawCardinality(input.raw, expectedSamples.length, targetLevels.length, add);

  const counts = Object.freeze(Object.fromEntries([
    'completeness', 'identity', 'historyDigest', 'opening', 'infrastructure', 'upgradeIdentity', 'timeline', 'resources',
    'manifest', 'nonTarget', 'unexpectedHistory', 'source', 'nodeSpecific', 'rollback',
  ].map((bucket) => [bucket, violations.filter((entry) => entry.bucket === bucket).length])));
  return Object.freeze({
    violations,
    counts,
    observations: Object.freeze({
      expected_levels: expectedLevels,
      upgrade_target_levels: targetLevels,
      opening_sample_count: openingSamples.length,
      upgrade_timeline_count: timelineUpgrades.length,
      manifest_count: manifestUpgrades.length,
      rollback_receipt_count: rollbackReceipts.length,
      source_file_count: input.sourceBuild?.before?.file_count ?? null,
      raw_row_counts: rawCounts(input.raw),
    }),
  });
}

function validateOpening(item, add) {
  const { before, after, operation, sample } = item;
  const response = operation?.response ?? {};
  const beforeContext = before?.context ?? {};
  const afterContext = after?.context ?? {};
  const expectedResponse = {
    node_id: sample.node_id,
    membership_id: sample.membership_id,
    principal_id: sample.principal_id,
    realm_id: sample.realm_id,
    line_id: beforeContext.line_id,
    signed_level: sample.signed_level,
    parent_node_id: beforeContext.parent_node_id,
    original_parent_node_id: beforeContext.original_parent_node_id,
    host_sovereign_node_id: beforeContext.host_sovereign_node_id,
    sovereignty_tier: 'hosted',
    node_profile: 'operating_mall',
    status: 'active',
  };
  compareFields(expectedResponse, response, Object.keys(expectedResponse), 'OPENING_RESPONSE_MISMATCH', 'opening', add);
  if (beforeContext.node_profile !== 'consumer' || beforeContext.sovereignty_tier !== 'hosted' || beforeContext.mall_id !== null) {
    add('opening', 'OPENING_PRECONDITION_MISMATCH', { node_id: sample.node_id, context: beforeContext });
  }
  if (afterContext.node_profile !== 'operating_mall' || afterContext.sovereignty_tier !== 'hosted'
    || afterContext.mall_id !== response.mall_id || afterContext.realm_node_profile !== 'operating_mall'
    || afterContext.membership_node_profile !== 'operating_mall') {
    add('opening', 'OPENING_RESULT_STATE_MISMATCH', { node_id: sample.node_id, context: afterContext, response });
  }
  if (Number(response.capability_version) !== 2 || !sameSet(response.capabilities, ['consumer', 'operating_mall'])) {
    add('opening', 'OPENING_CAPABILITY_RESPONSE_MISMATCH', { node_id: sample.node_id, response });
  }
  if (array(before?.relation_history).length !== 1 || !deepEqual(before?.relation_history, after?.relation_history)) {
    add('opening', 'OPENING_RELATION_HISTORY_CHANGED', { node_id: sample.node_id });
  }
  if (array(before?.capability_history).length !== 1 || array(after?.capability_history).length !== 2
    || Number(after?.capability_history?.[1]?.capability_version) !== 2
    || !sameSet(after?.capability_history?.[1]?.capabilities, ['consumer', 'operating_mall'])) {
    add('opening', 'OPENING_CAPABILITY_HISTORY_MISMATCH', { node_id: sample.node_id });
  }
  if (array(after?.opening_history).length !== 1 || array(after?.change_history).filter((row) => row.kind === 'sfl.hosted_mall.opened').length !== 1
    || array(after?.outbox_history).filter((row) => row.event_type === 'sfl.hosted_mall.opened').length !== 1) {
    add('opening', 'OPENING_ALLOWED_FACT_COUNT_MISMATCH', { node_id: sample.node_id });
  }
}

function validateHistoryDigests(item, add) {
  const stages = ['before_opening', 'after_opening', 'after_upgrade', 'after_rollback'];
  for (const field of ['identity_lineage_sha256', 'immutable_history_sha256']) {
    const values = stages.map((stage) => item?.[stage]?.[field]);
    if (!values.every(validSha) || new Set(values).size !== 1) {
      add('historyDigest', 'HISTORY_DIGEST_CHANGED', { node_id: item.node_id, field, values });
    }
  }
  for (const stage of stages) {
    const observation = item?.[stage];
    if (observation?.identity_lineage_sha256 !== objectDigest(observation?.identity_lineage)
      || observation?.immutable_history_sha256 !== objectDigest(observation?.immutable_history)) {
      add('historyDigest', 'HISTORY_DIGEST_RECOMPUTE_MISMATCH', { node_id: item.node_id, stage });
    }
  }
}

function validateUpgrade(upgrade, opening, add) {
  const response = upgrade.response ?? {};
  const row = array(upgrade.upgrade)[0] ?? {};
  const before = opening.after?.context ?? {};
  const expected = {
    node_id: opening.sample.node_id,
    membership_id: opening.sample.membership_id,
    principal_id: opening.sample.principal_id,
    realm_id: opening.sample.realm_id,
    line_id: before.line_id,
    signed_level: opening.sample.signed_level,
    parent_node_id: before.parent_node_id,
    original_parent_node_id: before.original_parent_node_id,
    previous_host_sovereign_node_id: before.host_sovereign_node_id,
    host_sovereign_node_id: opening.sample.node_id,
    source_tier: 'hosted',
    target_tier: 'sovereign',
    node_profile: 'operating_mall',
    status: 'upgraded',
  };
  compareFields(expected, response, Object.keys(expected), 'UPGRADE_RESPONSE_MISMATCH', 'timeline', add);
  if (array(upgrade.upgrade).length !== 1 || row.upgrade_id !== response.upgrade_id || row.status !== 'upgraded') {
    add('timeline', 'UPGRADE_AUTHORITY_ROW_MISMATCH', { node_id: opening.sample.node_id, response, rows: upgrade.upgrade });
  }
  const steps = array(upgrade.steps);
  if (!sameArray(steps.map((entry) => entry.step), ['planned', 'resources_ready', 'bindings_complete', 'upgraded'])
    || !sameArray(steps.map((entry) => Number(entry.ordinal)), [1, 2, 3, 4])
    || steps.some((entry) => entry.upgrade_id !== response.upgrade_id)) {
    add('timeline', 'UPGRADE_FOUR_STEP_TIMELINE_MISMATCH', { node_id: opening.sample.node_id, steps });
  }
  const sovereignty = array(upgrade.sovereignty_versions);
  if (sovereignty.length !== 1 || sovereignty[0]?.node_id !== opening.sample.node_id
    || sovereignty[0]?.host_sovereign_node_id !== opening.sample.node_id || sovereignty[0]?.status !== 'upgraded') {
    add('timeline', 'UPGRADE_SOVEREIGNTY_VERSION_MISMATCH', { node_id: opening.sample.node_id, sovereignty });
  }
  const relations = array(upgrade.relation_history);
  if (relations.length !== 2 || Number(relations[0]?.relation_version) !== 1 || Number(relations[1]?.relation_version) !== 2
    || relations[0]?.superseded_at === null || relations[1]?.superseded_at !== null
    || relations[1]?.host_sovereign_node_id !== opening.sample.node_id) {
    add('unexpectedHistory', 'UPGRADE_RELATION_HISTORY_MISMATCH', { node_id: opening.sample.node_id, relations });
  }
}

function validateManifest(item, nodeId, add) {
  const sets = array(item.domain_binding_sets);
  const bindings = array(item.domain_bindings);
  const resources = array(item.resource_binding_sets);
  const manifests = array(item.manifests);
  const surfaces = ['accounts', 'console', 'payment_callback', 'public_api', 'storefront'];
  if (sets.length !== 1 || sets[0]?.node_id !== nodeId || sets[0]?.status !== 'active'
    || sets[0]?.upgrade_id !== item.upgrade_id) add('resources', 'DOMAIN_BINDING_SET_MISMATCH', { node_id: nodeId, sets });
  if (bindings.length !== 5 || !sameSet(bindings.map((entry) => entry.surface), surfaces)
    || new Set(bindings.map((entry) => entry.host)).size !== 5 || bindings.some((entry) => entry.status !== 'active')) {
    add('resources', 'DOMAIN_BINDING_READINESS_MISMATCH', { node_id: nodeId, bindings });
  }
  if (resources.length !== 1 || resources[0]?.node_id !== nodeId || resources[0]?.upgrade_id !== item.upgrade_id
    || resources[0]?.status !== 'active') add('resources', 'RESOURCE_BINDING_SET_MISMATCH', { node_id: nodeId, resources });
  const manifest = manifests[0];
  if (manifests.length !== 1 || manifest?.node_id !== nodeId || manifest?.upgrade_id !== item.upgrade_id
    || manifest?.status !== 'active' || manifest?.manifest?.node_id !== nodeId) {
    add('manifest', 'MANIFEST_NODE_BINDING_MISMATCH', { node_id: nodeId, manifests });
    return;
  }
  const recomputed = `sha256:${sha256(Buffer.from(postgresJsonbText(manifest.manifest)))}`;
  if (manifest.manifest_digest !== recomputed || manifest.recomputed_manifest_digest !== recomputed) {
    add('manifest', 'MANIFEST_DIGEST_MISMATCH', {
      node_id: nodeId, recorded: manifest.manifest_digest, database_recomputed: manifest.recomputed_manifest_digest, oracle_recomputed: recomputed,
    });
  }
  if (manifest.release_pointer_ref !== null || manifest.manifest?.release_pointer_ref !== null) {
    add('manifest', 'RELEASE_POINTER_NOT_NULL', { node_id: nodeId, release_pointer_ref: manifest.release_pointer_ref });
  }
}

function validateRollback(receipt, opening, add) {
  const context = receipt.after_rollback?.context ?? {};
  const upgrades = receipt.upgrade_rows ?? {};
  if (receipt.result !== 'rolled_back' || receipt.upgrade_id !== upgrades.upgrade?.[0]?.upgrade_id
    || upgrades.upgrade?.[0]?.status !== 'rolled_back' || !upgrades.upgrade?.[0]?.rolled_back_at) {
    add('rollback', 'ROLLBACK_RECEIPT_MISMATCH', { node_id: opening.sample.node_id, receipt });
  }
  if (context.node_id !== opening.sample.node_id || context.sovereignty_tier !== 'hosted'
    || context.node_profile !== 'operating_mall' || context.mall_id !== opening.after?.context?.mall_id
    || context.host_sovereign_node_id !== opening.after?.context?.host_sovereign_node_id) {
    add('rollback', 'ROLLBACK_STATE_NOT_RESTORED', { node_id: opening.sample.node_id, context });
  }
  compareIdentity(opening.before, receipt.after_rollback, ['node_id', 'line_id', 'realm_id', 'parent_node_id',
    'original_parent_node_id', 'signed_level', 'membership_id', 'account_id', 'principal_id', 'lineage'],
  'ROLLBACK_IDENTITY_CHANGED', 'rollback', add);
  const relations = array(upgrades.relation_history);
  const steps = array(upgrades.steps);
  if (relations.length !== 3 || !sameArray(relations.map((entry) => Number(entry.relation_version)), [1, 2, 3])
    || relations[2]?.host_sovereign_node_id !== opening.after?.context?.host_sovereign_node_id
    || relations[2]?.superseded_at !== null) add('rollback', 'ROLLBACK_RELATION_MISMATCH', { node_id: opening.sample.node_id, relations });
  if (!sameArray(steps.map((entry) => entry.step), ['planned', 'resources_ready', 'bindings_complete', 'upgraded', 'rolled_back'])
    || !sameArray(steps.map((entry) => Number(entry.ordinal)), [1, 2, 3, 4, 5])) {
    add('rollback', 'ROLLBACK_TIMELINE_MISMATCH', { node_id: opening.sample.node_id, steps });
  }
  for (const [name, rows] of [['sovereignty', upgrades.sovereignty_versions], ['domain-set', upgrades.domain_binding_sets],
    ['domains', upgrades.domain_bindings], ['resources', upgrades.resource_binding_sets], ['manifest', upgrades.manifests]]) {
    if (array(rows).length === 0 || array(rows).some((entry) => entry.status !== 'rolled_back')) {
      add('rollback', 'ROLLBACK_RESOURCE_STATUS_MISMATCH', { node_id: opening.sample.node_id, name, rows });
    }
  }
  if (array(receipt.after_rollback?.opening_history).length !== 1 || array(receipt.after_rollback?.capability_history).length !== 2) {
    add('rollback', 'ROLLBACK_REMOVED_OPENING_CAPABILITY', { node_id: opening.sample.node_id });
  }
}

function validateOpeningRawRows(raw, openingSamples, add) {
  const samplesByNode = new Map(openingSamples.map((entry) => [entry.sample?.node_id, entry]));
  for (const item of openingSamples) {
    const nodeId = item.sample.node_id;
    const response = item.operation?.response ?? {};
    const rows = {
      opening: array(raw?.openings).filter((entry) => entry.node_id === nodeId),
      configuration: array(raw?.configurations).filter((entry) => entry.node_id === nodeId),
      entity: array(raw?.entity_bindings).filter((entry) => entry.node_id === nodeId),
      provisioning: array(raw?.provisioning).filter((entry) => entry.node_id === nodeId),
    };
    if (rows.opening.length !== 1 || rows.configuration.length !== 1 || rows.entity.length !== 1 || rows.provisioning.length !== 1
      || rows.opening[0]?.opening_id !== response.opening_id || rows.configuration[0]?.infrastructure_mode !== 'shared_host'
      || rows.configuration[0]?.host_sovereign_node_id !== item.before?.context?.host_sovereign_node_id
      || rows.entity[0]?.mall_id !== response.mall_id) {
      add('opening', 'OPENING_RAW_ALLOWED_ADDITION_MISMATCH', { node_id: nodeId, rows });
    }
  }
  for (const row of array(raw?.openings)) if (!samplesByNode.has(row.node_id)) add('opening', 'UNEXPECTED_OPENING_NODE', { row });
}

function validateInfrastructure(value, sampleCount, add) {
  const setup = value?.fixture_setup ?? {};
  const observation = value?.opening_observation ?? {};
  const fixtureParentCount = array(setup.fixture_parent_receipts).length;
  if (Number(setup.setup_provisioning_row_delta) !== sampleCount + fixtureParentCount
    || array(setup.setup_receipts).length !== sampleCount || fixtureParentCount !== 5) {
    add('infrastructure', 'FIXTURE_PROVISIONING_COUNT_MISMATCH', {
      setup_provisioning_row_delta: setup.setup_provisioning_row_delta,
      sample_receipt_count: array(setup.setup_receipts).length,
      fixture_parent_receipt_count: fixtureParentCount,
      sample_count: sampleCount,
    });
  }
  if (Number(observation.hosted_provisioning_row_delta) !== 0 || array(observation.external_infrastructure_calls).length !== 0
    || array(observation.deployment_or_release_pointer_calls).length !== 0) {
    add('infrastructure', 'HOSTED_INFRASTRUCTURE_DELTA', { observation });
  }
  const files = array(value?.implementation_scan?.files);
  if (files.length === 0 || files.some((entry) => array(entry.forbidden_infrastructure_references).length > 0)) {
    add('infrastructure', 'HOSTED_IMPLEMENTATION_INFRASTRUCTURE_REFERENCE', { files });
  }
}

function validateNonTargets(value, rollback, openingSamples, add) {
  const sampleByNode = new Map(openingSamples.map((entry) => [entry.sample?.node_id, entry]));
  const expectedNonTargets = openingSamples.filter((entry) => !entry.sample?.sovereign_upgrade).map((entry) => entry.sample.node_id);
  const comparisons = array(value?.comparisons).filter((entry) => entry.role === 'non_target');
  compareSet(expectedNonTargets, comparisons.map((entry) => entry.node_id), 'NON_TARGET_COMPARISON_SET_MISMATCH', 'nonTarget', add);
  for (const comparison of comparisons) {
    if (!sampleByNode.has(comparison.node_id) || !deepEqual(comparison.before_upgrade, comparison.after_upgrade)
      || comparison.before_upgrade_sha256 !== objectDigest(comparison.before_upgrade)
      || comparison.after_upgrade_sha256 !== objectDigest(comparison.after_upgrade)
      || comparison.before_upgrade_sha256 !== comparison.after_upgrade_sha256) {
      add('nonTarget', 'NON_TARGET_UPGRADE_CHANGE', { node_id: comparison.node_id });
    }
  }
  const afterRollback = array(rollback?.non_target_after_rollback);
  compareSet(expectedNonTargets, afterRollback.map((entry) => entry.node_id), 'NON_TARGET_ROLLBACK_SET_MISMATCH', 'nonTarget', add);
  for (const comparison of afterRollback) {
    if (comparison.after_opening_sha256 !== comparison.after_rollback_sha256
      || comparison.after_rollback_sha256 !== objectDigest(comparison.after_rollback)) {
      add('nonTarget', 'NON_TARGET_ROLLBACK_CHANGE', { node_id: comparison.node_id });
    }
  }
}

function validateHistoryShapes(openingSamples, rollbackByLevel, targetLevels, add) {
  for (const item of openingSamples) {
    const target = targetLevels.includes(item.sample.signed_level);
    if (array(item.before?.relation_history).length !== 1 || array(item.after?.relation_history).length !== 1
      || array(item.before?.capability_history).length !== 1 || array(item.after?.capability_history).length !== 2) {
      add('unexpectedHistory', 'OPENING_HISTORY_SHAPE_MISMATCH', { node_id: item.sample.node_id });
    }
    if (!target) continue;
    const rollback = rollbackByLevel.get(item.sample.signed_level);
    if (!rollback || array(rollback.after_rollback?.relation_history).length !== 3
      || array(rollback.after_rollback?.capability_history).length !== 2
      || array(rollback.after_rollback?.opening_history).length !== 1
      || array(rollback.after_rollback?.upgrade_history).length !== 1) {
      add('unexpectedHistory', 'TARGET_FINAL_HISTORY_SHAPE_MISMATCH', { node_id: item.sample.node_id });
    }
  }
}

function validateSourceBuild(value, add) {
  const before = value?.before ?? {};
  const after = value?.after ?? {};
  if (!validSha(before.inventory_sha256) || before.inventory_sha256 !== inventoryDigest(before.entries)
    || !validSha(after.inventory_sha256) || after.inventory_sha256 !== inventoryDigest(after.entries)
    || Number(before.file_count) !== array(before.entries).length || Number(after.file_count) !== array(after.entries).length
    || before.file_count !== after.file_count || before.inventory_sha256 !== after.inventory_sha256) {
    add('source', 'SOURCE_INVENTORY_CHANGED', { before: summarizeInventory(before), after: summarizeInventory(after) });
  }
  const nodeSpecific = Number(before.node_specific_file_count ?? 0) + Number(after.node_specific_file_count ?? 0)
    + array(value?.node_specific_builds).length + array(value?.build_invocations).filter((entry) => entry.node_id || entry.node_specific).length;
  if (nodeSpecific !== 0 || array(before.entries).some((entry) => array(entry.node_specific_tokens).length > 0)
    || array(after.entries).some((entry) => array(entry.node_specific_tokens).length > 0)) {
    add('nodeSpecific', 'NODE_SPECIFIC_SOURCE_OR_BUILD', { node_specific_count: nodeSpecific });
  }
  if (array(value?.build_invocations).length !== 0) add('source', 'UNEXPECTED_BUILD_INVOCATION', { builds: value.build_invocations });
}

function validateRawCardinality(raw, sampleCount, targetCount, add) {
  const expected = {
    nodes: sampleCount,
    realms: sampleCount,
    memberships: sampleCount,
    accounts: sampleCount,
    principals: sampleCount,
    provisioning: sampleCount,
    openings: sampleCount,
    configurations: sampleCount,
    entity_bindings: sampleCount,
    capabilities: sampleCount * 2,
    relations: sampleCount + targetCount * 2,
    upgrades: targetCount,
    sovereignty_versions: targetCount,
    domain_binding_sets: targetCount,
    domain_bindings: targetCount * 5,
    resource_binding_sets: targetCount,
    manifests: targetCount,
    upgrade_steps: targetCount * 5,
    outbox: sampleCount + targetCount,
  };
  for (const [name, count] of Object.entries(expected)) {
    if (array(raw?.[name]).length !== count) add('unexpectedHistory', 'RAW_ROW_CARDINALITY_MISMATCH', {
      table: name, expected: count, actual: array(raw?.[name]).length,
    });
  }
}

function runNegativeProbes(criteriaValue, input) {
  if (!input.opening || !input.sourceBuild || !input.nonTarget) return [];
  const lineageMutation = structuredClone(input);
  lineageMutation.opening.samples[0].after.context.parent_node_id = 'node:e07-mutated-parent';
  lineageMutation.opening.samples[0].after.current_lineage = ['node:e07-mutated-parent'];

  const identityMutation = structuredClone(input);
  identityMutation.opening.samples[0].after.context.membership_id = 'membership:e07-mutated';
  identityMutation.opening.samples[0].after.context.signed_level = 'L2';

  const sourceMutation = structuredClone(input);
  sourceMutation.sourceBuild.node_specific_builds.push({ node_id: input.opening.samples[0].sample.node_id, kind: 'mutated-build' });

  const nonTargetMutation = structuredClone(input);
  const nonTarget = nonTargetMutation.nonTarget.comparisons.find((entry) => entry.role === 'non_target');
  if (nonTarget) nonTarget.after_upgrade.context.sovereignty_tier = 'sovereign';

  return Object.freeze([
    probe('unrelated-lineage', ['OPENING_IDENTITY_CHANGED'], criteriaValue, lineageMutation),
    probe('membership-and-level-reset', ['OPENING_IDENTITY_CHANGED'], criteriaValue, identityMutation),
    probe('node-specific-source-build', ['NODE_SPECIFIC_SOURCE_OR_BUILD'], criteriaValue, sourceMutation),
    probe('non-target-node-switch', ['NON_TARGET_UPGRADE_CHANGE'], criteriaValue, nonTargetMutation),
  ]);
}

function probe(probeId, expectedCodes, criteriaValue, input) {
  const result = reconcile(criteriaValue, input);
  const detectedCodes = [...new Set(result.violations.map((entry) => entry.code))].sort();
  return Object.freeze({
    probe_id: probeId,
    expected_violation: expectedCodes,
    detected: expectedCodes.some((code) => detectedCodes.includes(code)),
    detected_codes: detectedCodes,
  });
}

function snapshotFromUpgrade(upgrade, opening) {
  const relations = array(upgrade.relation_history);
  const active = relations.find((entry) => entry.superseded_at === null) ?? {};
  return Object.freeze({
    context: {
      node_id: upgrade.response?.node_id,
      line_id: upgrade.response?.line_id,
      realm_id: upgrade.response?.realm_id,
      parent_node_id: upgrade.response?.parent_node_id,
      original_parent_node_id: upgrade.response?.original_parent_node_id,
      signed_level: upgrade.response?.signed_level,
      membership_id: upgrade.response?.membership_id,
      account_id: upgrade.sample?.account_id,
      principal_id: upgrade.response?.principal_id,
      host_sovereign_node_id: active.host_sovereign_node_id,
    },
    current_lineage: opening.after?.current_lineage,
  });
}

function compareIdentity(before, after, fields, code, bucket, add) {
  const left = identityAnchor(before);
  const right = identityAnchor(after);
  for (const field of fields) {
    if (field === 'lineage' ? !deepEqual(left[field], right[field]) : left[field] !== right[field]) {
      add(bucket, code, { node_id: left.node_id ?? right.node_id, field, before: left[field], after: right[field] });
    }
  }
}

function identityAnchor(snapshot) {
  const context = snapshot?.context ?? {};
  return Object.freeze({
    node_id: context.node_id,
    line_id: context.line_id,
    realm_id: context.realm_id,
    parent_node_id: context.parent_node_id,
    original_parent_node_id: context.original_parent_node_id,
    signed_level: context.signed_level,
    membership_id: context.membership_id,
    account_id: context.account_id,
    principal_id: context.principal_id,
    lineage: snapshot?.current_lineage,
  });
}

function uniqueMap(values, key, kind, add) {
  const result = new Map();
  for (const value of values) {
    const id = key(value);
    if (!id || result.has(id)) add('completeness', 'DUPLICATE_OR_MISSING_SAMPLE_KEY', { kind, id });
    else result.set(id, value);
  }
  return result;
}

function compareFields(expected, actual, fields, code, bucket, add) {
  for (const field of fields) if (!deepEqual(expected?.[field], actual?.[field])) {
    add(bucket, code, { field, expected: expected?.[field], actual: actual?.[field], node_id: expected?.node_id ?? actual?.node_id });
  }
}

function compareSet(expected, actual, code, bucket, add) {
  if (!sameSet(expected, actual)) add(bucket, code, { expected, actual });
}

function levelForNode(samples, nodeId) {
  return samples.find((entry) => entry.sample?.node_id === nodeId)?.sample?.signed_level ?? null;
}

function rawCounts(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => Array.isArray(value)).map(([name, value]) => [name, value.length]));
}

function summarizeInventory(value) {
  return { file_count: value?.file_count, inventory_sha256: value?.inventory_sha256, entry_count: array(value?.entries).length };
}

function inventoryDigest(entries) {
  const sorted = [...array(entries)].sort((left, right) => String(left.path).localeCompare(String(right.path)));
  return `sha256:${sha256(Buffer.from(sorted.map((entry) => `${entry.path}\0${entry.size_bytes}\0${entry.sha256}\n`).join('')))}`;
}

function postgresJsonbText(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(postgresJsonbText).join(', ')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => left.length - right.length || Buffer.compare(Buffer.from(left), Buffer.from(right)));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}: ${postgresJsonbText(item)}`).join(', ')}}`;
  }
  return JSON.stringify(value);
}

function objectDigest(value) {
  return `sha256:${sha256(Buffer.from(canonical(value)))}`;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

function deepEqual(left, right) {
  return canonical(left) === canonical(right);
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
  if (!value || value.startsWith('--')) throw new Error(`E07_OPTION_VALUE_REQUIRED:${name}`);
  return value;
}
