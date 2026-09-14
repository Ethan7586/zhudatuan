import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const runDirectory = resolve(option('--run-directory'));
const criteriaPath = resolve(option('--criteria'));
const outputPath = resolve(option('--output'));
const missingItems = [];
const inputArtifacts = [];

const criteria = await requiredJson(criteriaPath, 'locked criteria');
const requiredNames = criteria?.required_input_artifacts ?? [];
const raw = {};
for (const name of requiredNames) raw[name] = await requiredJson(join(runDirectory, name), name);

if (criteria?.claim_id !== 'E2-ID-001' || criteria?.legacy_trace_id !== 'E04'
  || criteria?.negative_matrix?.expected_observation_count !== 48
  || criteria?.realm_matrix?.length !== 3) {
  missingItems.push('recognized prelocked E04 criteria');
}

const identity = raw['multi-realm-identity-map.json'];
const positives = raw['multi-realm-positive-results.json'];
const transitions = raw['multi-realm-session-transitions.json'];
const negatives = raw['multi-realm-negative-results.json'];
const database = raw['multi-realm-database-diff.json'];
const environment = raw['environment.json'];

requireMinimum(identity?.realms, 3, 'three Realm identity records');
requireMinimum(identity?.discovery?.positive_cases, 3, 'three Realm credential discovery observations');
requireMinimum(identity?.discovery?.cross_realm_cases, 6, 'six cross-Realm credential discovery observations');
requireMinimum(positives?.cases, 3, 'three own-Realm positive observations');
requireMinimum(transitions?.directed_pairs, 6, 'six directed Realm transition observations');
requireMinimum(negatives?.observations, 48, '48 negative observations');
if (typeof environment?.kind !== 'string') missingItems.push('environment classification');
if (!database?.fixture_before?.tables || !database?.established_before_negative_matrix?.tables
  || !database?.after_negative_matrix?.tables) missingItems.push('authoritative before/after table rows');

for (const realm of identity?.realms ?? []) {
  if (!realm?.realm_label || !realm?.expected || !realm?.identity || !Array.isArray(realm?.scope_grants)
    || !Array.isArray(realm?.permissions) || !realm?.asset) {
    missingItems.push(`complete identity map for Realm ${realm?.realm_label ?? 'unknown'}`);
  }
}
for (const item of positives?.cases ?? []) {
  if (!item?.case_id || !item?.request || !item?.read_response || !item?.write_response) {
    missingItems.push(`complete positive observation ${item?.case_id ?? 'unknown'}`);
  }
}
for (const item of transitions?.directed_pairs ?? []) {
  const required = ['pair_id', 'source_identifiers', 'target_expected_identifiers', 'issue_response',
    'fresh_target_session', 'consume_response', 'login_intent_row', 'source_session_at_source',
    'source_session_at_target', 'target_session_at_target', 'target_membership_resolution',
    'target_scope_resolution'];
  if (required.some((field) => !Object.hasOwn(item ?? {}, field))) {
    missingItems.push(`complete transition observation ${item?.pair_id ?? 'unknown'}`);
  }
}
for (const item of negatives?.observations ?? []) {
  if (!item?.case_id || !item?.pair_id || !item?.misuse_variant || !item?.operation_kind
    || !item?.request?.presented_authority || !item?.request?.source_authority || !item?.response) {
    missingItems.push(`complete negative observation ${item?.case_id ?? 'unknown'}`);
  }
}

const identityMetrics = evaluateIdentity(identity);
const positiveMetrics = evaluatePositives(positives);
const transitionMetrics = evaluateTransitions(transitions);
const negativeMetrics = evaluateNegatives(negatives, identity, transitions, criteria);
const databaseMetrics = evaluateDatabase(database);
const negativeProbes = runNegativeProbes({ identity, transitions, negatives, criteria });

const thresholds = Object.freeze([
  threshold('required_artifact_missing_count', 0, requiredNames.filter((name) => raw[name] === null).length),
  threshold('credential_discovery_mismatch_count', 0, identityMetrics.discovery_mismatch_count),
  threshold('identity_map_mismatch_count', 0, identityMetrics.identity_map_mismatch_count),
  threshold('identifier_merge_count', 0, identityMetrics.identifier_merge_count),
  threshold('positive_case_count', 3, positiveMetrics.case_count),
  threshold('positive_acceptance_count', 3, positiveMetrics.accepted_count),
  threshold('positive_asset_mismatch_count', 0, positiveMetrics.asset_mismatch_count),
  threshold('positive_authoritative_write_count', 3, positiveMetrics.write_count),
  threshold('directed_pair_count', 6, transitionMetrics.pair_count),
  threshold('transition_pair_mismatch_count', 0, transitionMetrics.pair_mismatch_count),
  threshold('consumed_login_intent_count', 6, transitionMetrics.consumed_intent_count),
  threshold('fresh_target_session_count', 6, transitionMetrics.fresh_target_session_count),
  threshold('source_session_target_resolution_count', 0, transitionMetrics.source_session_target_resolution_count),
  threshold('target_session_target_resolution_count', 6, transitionMetrics.target_session_target_resolution_count),
  threshold('source_authority_residue_count', 0, transitionMetrics.source_authority_residue_count),
  threshold('target_authority_mismatch_count', 0, transitionMetrics.target_authority_mismatch_count),
  threshold('multi_membership_activation_count', 0,
    positiveMetrics.multi_membership_activation_count + transitionMetrics.multi_membership_activation_count
      + negativeMetrics.multi_membership_activation_count),
  threshold('negative_observation_count', 48, negativeMetrics.observation_count),
  threshold('negative_combination_mismatch_count', 0, negativeMetrics.combination_mismatch_count),
  threshold('negative_request_integrity_mismatch_count', 0, negativeMetrics.request_integrity_mismatch_count),
  threshold('negative_denial_stage_mismatch_count', 0, negativeMetrics.denial_stage_mismatch_count),
  threshold('negative_acceptance_count', 0, negativeMetrics.acceptance_count),
  threshold('cross_realm_data_disclosure_count', 0, negativeMetrics.disclosure_count),
  threshold('negative_authoritative_write_count', 0, negativeMetrics.write_count),
  threshold('negative_outbox_delta', 0, negativeMetrics.outbox_delta),
  threshold('negative_matrix_changed_table_count', 0, databaseMetrics.changed_table_count),
  threshold('fixture_preexisting_row_count', 0, databaseMetrics.fixture_preexisting_row_count),
  threshold('negative_oracle_probe_miss_count', 0, negativeProbes.filter(({ detected }) => !detected).length),
]);
const contradictions = thresholds.filter((entry) => !entry.met).map((entry) => entry.threshold_id);
const uniqueMissingItems = Object.freeze([...new Set(missingItems)]);
const claimOutcome = uniqueMissingItems.length > 0 ? 'UNKNOWN' : contradictions.length > 0 ? 'NOT MET' : 'MET';
const result = Object.freeze({
  schema_version: 'e04-independent-multi-realm-recount-v1',
  oracle_id: 'E2-ORACLE-E04-MULTI-REALM',
  executed_at: new Date().toISOString(),
  independent_from_test_program: true,
  reads_test_program_pass: false,
  criteria: criteria === null ? null : {
    criteria_id: criteria.criteria_id,
    sha256: inputArtifacts.find(({ path }) => path === criteriaPath)?.sha256 ?? null,
    locked_at: criteria.locked_at,
  },
  input_artifacts: inputArtifacts,
  computed_observations: {
    identity: identityMetrics,
    positives: positiveMetrics,
    transitions: transitionMetrics,
    negatives: negativeMetrics,
    database: databaseMetrics,
    environment_kind: environment?.kind ?? null,
  },
  negative_probes: negativeProbes,
  thresholds,
  missing_items: uniqueMissingItems,
  contradictions,
  claim_outcome: claimOutcome,
  environment_assurance: claimOutcome === 'UNKNOWN' ? 'NOT ESTABLISHED' : 'DEV VERIFIED',
  review_assurance: 'NOT REVIEWED',
});
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
console.log(`E04 independent oracle: outcome=${claimOutcome} missing=${uniqueMissingItems.length} contradictions=${contradictions.length}`);

function evaluateIdentity(artifact) {
  const realms = artifact?.realms ?? [];
  const byLabel = new Map(realms.map((entry) => [entry.realm_label, entry]));
  let discoveryMismatch = 0;
  for (const label of ['A', 'B', 'C']) {
    const map = byLabel.get(label);
    const found = (artifact?.discovery?.positive_cases ?? []).find((entry) => entry.expected?.realm_id === map?.expected?.realm_id);
    if (!map || !found || found.response?.realm_id !== map.identity?.realm_id
      || found.response?.account_id !== map.identity?.account_id
      || found.response?.principal_id !== map.identity?.principal_id
      || found.response?.secret_hash_present !== true) discoveryMismatch += 1;
  }
  discoveryMismatch += (artifact?.discovery?.cross_realm_cases ?? []).filter((entry) => entry.response !== null).length;
  if (new Set(realms.map((entry) => entry.identity?.subject_hash)).size !== 1
    || realms.some((entry) => entry.identity?.subject_hash !== artifact?.shared_subject_hash)) discoveryMismatch += 1;

  let identityMapMismatch = 0;
  for (const entry of realms) {
    const expected = entry.expected ?? {};
    const observed = entry.identity ?? {};
    for (const field of ['realm_id', 'account_id', 'principal_id', 'membership_id', 'base_session_id',
      'node_id', 'line_id', 'parent_node_id', 'signed_level']) {
      if (observed[field] !== expected[field]) identityMapMismatch += 1;
    }
    if (entry.scope_grants?.length !== 1 || entry.scope_grants[0]?.scope_id !== expected.scope_id
      || entry.scope_grants[0]?.membership_id !== expected.membership_id) identityMapMismatch += 1;
    if (!entry.permissions?.some((permission) => permission.code === 'access.scope.manage'
      && permission.effect === 'allow')) identityMapMismatch += 1;
    if (entry.asset?.id !== expected.asset_id || entry.asset?.scope_id !== expected.scope_id
      || entry.asset?.participant_realm_id !== expected.realm_id
      || entry.asset?.participant_account_id !== expected.account_id
      || entry.asset?.participant_membership_id !== expected.membership_id
      || entry.asset?.participant_node_id !== expected.node_id) identityMapMismatch += 1;
  }

  const categories = {
    credential_id: realms.map((entry) => entry.identity?.credential_id),
    account_id: realms.map((entry) => entry.identity?.account_id),
    principal_id: realms.map((entry) => entry.identity?.principal_id),
    membership_id: realms.map((entry) => entry.identity?.membership_id),
    base_session_id: realms.map((entry) => entry.identity?.base_session_id),
    node_id: realms.map((entry) => entry.identity?.node_id),
    lineage_identity: realms.map((entry) => [entry.identity?.line_id, entry.identity?.node_id,
      entry.identity?.parent_node_id, entry.identity?.signed_level].join('|')),
    scope_grant_id: realms.map((entry) => entry.scope_grants?.[0]?.id),
    scope_id: realms.map((entry) => entry.scope_grants?.[0]?.scope_id),
    asset_id: realms.map((entry) => entry.asset?.id),
  };
  const duplicateCategories = Object.entries(categories).filter(([, values]) => distinctDefined(values).size !== 3)
    .map(([name]) => name);
  return Object.freeze({
    realm_count: realms.length,
    credential_row_count: categories.credential_id.length,
    discovery_positive_count: artifact?.discovery?.positive_cases?.length ?? 0,
    discovery_cross_count: artifact?.discovery?.cross_realm_cases?.length ?? 0,
    discovery_mismatch_count: discoveryMismatch,
    identity_map_mismatch_count: identityMapMismatch,
    identifier_merge_count: duplicateCategories.length,
    duplicate_identifier_categories: duplicateCategories,
    distinct_counts: Object.fromEntries(Object.entries(categories).map(([name, values]) => [name, distinctDefined(values).size])),
  });
}

function evaluatePositives(artifact) {
  const cases = artifact?.cases ?? [];
  let accepted = 0;
  let assetMismatches = 0;
  let writes = 0;
  let multiMembership = 0;
  for (const item of cases) {
    const read = item.read_response ?? {};
    const write = item.write_response ?? {};
    const readAccepted = read.status === 200 && read.denial === null;
    const writeAccepted = write.status === 200 && write.denial === null;
    if (readAccepted && writeAccepted) accepted += 1;
    if (read.asset_rows?.length !== 1 || read.asset_rows[0]?.id !== item.expected_asset_id
      || write.write_rows?.length !== 1 || write.write_rows[0]?.id !== item.expected_asset_id) assetMismatches += 1;
    writes += write.write_rows?.length ?? 0;
    multiMembership += countMultipleMemberships(read) + countMultipleMemberships(write);
  }
  return Object.freeze({
    case_count: cases.length,
    accepted_count: accepted,
    asset_mismatch_count: assetMismatches,
    write_count: writes,
    multi_membership_activation_count: multiMembership,
  });
}

function evaluateTransitions(artifact) {
  const entries = artifact?.directed_pairs ?? [];
  const expectedPairs = expectedPairSet();
  const actualPairs = entries.map((entry) => entry.pair_id);
  const pairMismatch = symmetricMismatch(expectedPairs, actualPairs);
  const baseSessions = new Set(entries.flatMap((entry) => [entry.source_identifiers?.base_session_id,
    entry.target_expected_identifiers?.base_session_id]).filter(Boolean));
  const freshIds = entries.map((entry) => entry.fresh_target_session?.id).filter(Boolean);
  let consumed = 0;
  let fresh = 0;
  let sourceAtTarget = 0;
  let targetAtTarget = 0;
  let residue = 0;
  let targetMismatch = 0;
  let multiMembership = 0;
  for (const entry of entries) {
    const targetSessionId = entry.fresh_target_session?.id;
    const intent = entry.login_intent_row;
    if (entry.issue_response?.row_count === 1 && entry.consume_response?.row_count === 1
      && intent?.consumed_at != null && intent?.target_session_id === targetSessionId
      && intent?.target_account_id === entry.target_expected_identifiers?.account_id) consumed += 1;
    if (targetSessionId && !baseSessions.has(targetSessionId)
      && freshIds.filter((id) => id === targetSessionId).length === 1) fresh += 1;
    sourceAtTarget += entry.source_session_at_target?.row_count ?? 0;
    if (entry.target_session_at_target?.row_count === 1) targetAtTarget += 1;
    const resolved = entry.target_session_at_target?.rows?.[0] ?? {};
    const expected = entry.target_expected_identifiers ?? {};
    const targetScope = entry.target_scope_resolution?.rows?.[0]?.scope?.id;
    const targetChecks = {
      realm_id: resolved.realm_id,
      account_id: resolved.account_id,
      membership_id: resolved.membership_id,
      node_id: resolved.node_id,
      line_id: resolved.line_id,
      session_id: resolved.session_id,
      scope_id: targetScope,
    };
    for (const [field, value] of Object.entries(targetChecks)) {
      const expectedValue = field === 'session_id' ? targetSessionId : expected[field];
      if (value !== expectedValue) targetMismatch += 1;
    }
    if (entry.source_session_at_source?.row_count !== 1
      || entry.target_membership_resolution?.row_count !== 1
      || entry.target_scope_resolution?.row_count !== 1) targetMismatch += 1;
    const source = entry.source_identifiers ?? {};
    for (const [field, value] of Object.entries(targetChecks)) {
      const sourceValue = field === 'session_id' ? source.base_session_id : source[field];
      if (sourceValue != null && value === sourceValue) residue += 1;
    }
    if ((entry.target_session_at_target?.row_count ?? 0) > 1
      || (entry.target_membership_resolution?.row_count ?? 0) > 1) multiMembership += 1;
  }
  return Object.freeze({
    pair_count: entries.length,
    pair_mismatch_count: pairMismatch,
    consumed_intent_count: consumed,
    fresh_target_session_count: fresh,
    source_session_target_resolution_count: sourceAtTarget,
    target_session_target_resolution_count: targetAtTarget,
    source_authority_residue_count: residue,
    target_authority_mismatch_count: targetMismatch,
    multi_membership_activation_count: multiMembership,
  });
}

function evaluateNegatives(artifact, identityArtifact, transitionArtifact, criteriaValue) {
  const observations = artifact?.observations ?? [];
  const expected = [];
  for (const pair of expectedPairSet()) {
    for (const variant of criteriaValue?.negative_matrix?.misuse_variants ?? []) {
      for (const operation of criteriaValue?.negative_matrix?.operation_kinds ?? []) expected.push(`${pair}|${variant}|${operation}`);
    }
  }
  const actual = observations.map((entry) => `${entry.pair_id}|${entry.misuse_variant}|${entry.operation_kind}`);
  const maps = new Map((identityArtifact?.realms ?? []).map((entry) => [entry.realm_label, entry]));
  const transitionMap = new Map((transitionArtifact?.directed_pairs ?? []).map((entry) => [entry.pair_id, entry]));
  let requestMismatch = 0;
  let denialStageMismatch = 0;
  let acceptance = 0;
  let disclosure = 0;
  let writes = 0;
  let outboxDelta = 0;
  let multiMembership = 0;
  const expectedStage = { source_session: 'session', source_membership: 'membership', source_scope: 'scope', source_node_identity: 'node' };
  for (const item of observations) {
    const response = item.response ?? {};
    if ((response.status >= 200 && response.status < 300) || response.denial === null) acceptance += 1;
    disclosure += response.asset_rows?.length ?? 0;
    writes += response.write_rows?.length ?? 0;
    if (JSON.stringify(response.outbox_before ?? []) !== JSON.stringify(response.outbox_after ?? [])) outboxDelta += 1;
    multiMembership += countMultipleMemberships(response);
    if (response.denial?.stage !== expectedStage[item.misuse_variant]) denialStageMismatch += 1;

    const source = maps.get(item.source_realm_label);
    const target = maps.get(item.target_realm_label);
    const transition = transitionMap.get(item.pair_id);
    const presented = item.request?.presented_authority ?? {};
    const sourceAuthority = item.request?.source_authority ?? {};
    const sourceExpected = source?.expected ?? {};
    const targetExpected = target?.expected ?? {};
    const expectedPresented = {
      token_hash: transition?.fresh_target_session?.token_hash,
      session_id: transition?.fresh_target_session?.id,
      membership_id: targetExpected.membership_id,
      scope_id: targetExpected.scope_id,
      node_id: targetExpected.node_id,
      realm_id: targetExpected.realm_id,
      account_id: targetExpected.account_id,
    };
    if (item.misuse_variant === 'source_session') {
      expectedPresented.token_hash = source?.identity?.base_token_hash;
      expectedPresented.session_id = sourceExpected.base_session_id;
    }
    if (item.misuse_variant === 'source_membership') expectedPresented.membership_id = sourceExpected.membership_id;
    if (item.misuse_variant === 'source_scope') expectedPresented.scope_id = sourceExpected.scope_id;
    if (item.misuse_variant === 'source_node_identity') expectedPresented.node_id = sourceExpected.node_id;
    if (!source || !target || !transition || item.request?.target_asset_id !== targetExpected.asset_id
      || item.request?.target_host !== target?.expected?.accounts_host
      || Object.entries(expectedPresented).some(([field, value]) => presented[field] !== value)
      || sourceAuthority.membership_id !== sourceExpected.membership_id
      || sourceAuthority.scope_id !== sourceExpected.scope_id
      || sourceAuthority.node_id !== sourceExpected.node_id) requestMismatch += 1;
  }
  return Object.freeze({
    observation_count: observations.length,
    combination_mismatch_count: symmetricMismatch(expected, actual),
    request_integrity_mismatch_count: requestMismatch,
    denial_stage_mismatch_count: denialStageMismatch,
    acceptance_count: acceptance,
    disclosure_count: disclosure,
    write_count: writes,
    outbox_delta: outboxDelta,
    multi_membership_activation_count: multiMembership,
  });
}

function evaluateDatabase(artifact) {
  const beforeTables = artifact?.established_before_negative_matrix?.tables ?? {};
  const afterTables = artifact?.after_negative_matrix?.tables ?? {};
  const names = [...new Set([...Object.keys(beforeTables), ...Object.keys(afterTables)])];
  const changed = names.filter((name) => JSON.stringify(beforeTables[name] ?? []) !== JSON.stringify(afterTables[name] ?? []));
  const fixtureBefore = artifact?.fixture_before?.tables ?? {};
  return Object.freeze({
    table_count: names.length,
    changed_table_count: changed.length,
    changed_tables: changed.sort(),
    fixture_preexisting_row_count: Object.values(fixtureBefore).reduce((sum, rows) => sum + (rows?.length ?? 0), 0),
  });
}

function runNegativeProbes(input) {
  if (!input.identity || !input.transitions || !input.negatives) return Object.freeze([]);
  const merged = structuredClone(input.identity);
  if (merged.realms?.[0]?.identity && merged.realms?.[1]?.identity) {
    merged.realms[1].identity.account_id = merged.realms[0].identity.account_id;
  }
  const mergedDetected = evaluateIdentity(merged).identifier_merge_count > 0;

  const residue = structuredClone(input.transitions);
  const firstTransition = residue.directed_pairs?.[0];
  if (firstTransition?.target_session_at_target?.rows?.[0]) {
    firstTransition.target_session_at_target.rows[0].membership_id = firstTransition.source_identifiers.membership_id;
  }
  const residueMetrics = evaluateTransitions(residue);
  const residueDetected = residueMetrics.source_authority_residue_count > 0
    || residueMetrics.target_authority_mismatch_count > 0;

  const accepted = structuredClone(input.negatives);
  const firstNegative = accepted.observations?.[0];
  if (firstNegative?.response) {
    firstNegative.response.status = 200;
    firstNegative.response.denial = null;
    firstNegative.response.asset_rows = [{ id: firstNegative.request.target_asset_id }];
    firstNegative.response.write_rows = [{ id: firstNegative.request.target_asset_id }];
  }
  const acceptedMetrics = evaluateNegatives(accepted, input.identity, input.transitions, input.criteria);
  const acceptedDetected = acceptedMetrics.acceptance_count > 0 && acceptedMetrics.disclosure_count > 0
    && acceptedMetrics.write_count > 0;
  return Object.freeze([
    { probe_id: 'identifier-merge', detected: mergedDetected },
    { probe_id: 'transition-source-residue', detected: residueDetected },
    { probe_id: 'accepted-negative-with-write', detected: acceptedDetected },
  ]);
}

function countMultipleMemberships(response) {
  const sessionCount = response?.authorization?.session_resolution?.row_count ?? 0;
  const membershipCount = response?.authorization?.membership_resolution?.row_count ?? 0;
  return Number(sessionCount > 1) + Number(membershipCount > 1);
}

function expectedPairSet() {
  return ['A->B', 'A->C', 'B->A', 'B->C', 'C->A', 'C->B'];
}

function symmetricMismatch(expected, actual) {
  const expectedCounts = counts(expected);
  const actualCounts = counts(actual);
  const keys = new Set([...expectedCounts.keys(), ...actualCounts.keys()]);
  let mismatch = 0;
  for (const key of keys) mismatch += Math.abs((expectedCounts.get(key) ?? 0) - (actualCounts.get(key) ?? 0));
  return mismatch;
}

function counts(values) {
  const result = new Map();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

function distinctDefined(values) {
  return new Set(values.filter((value) => value !== undefined && value !== null && value !== ''));
}

function threshold(thresholdId, expected, actual) {
  return Object.freeze({ threshold_id: thresholdId, expected, actual, met: actual === expected });
}

function requireMinimum(value, expected, label) {
  if (!Array.isArray(value) || value.length < expected) missingItems.push(label);
}

async function requiredJson(path, label) {
  try {
    const bytes = await readFile(path);
    inputArtifacts.push(Object.freeze({ path, sha256: `sha256:${sha256(bytes)}` }));
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    missingItems.push(label);
    return null;
  }
}

function option(name) {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`E04_ORACLE_OPTION_REQUIRED:${name}`);
  return value;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
