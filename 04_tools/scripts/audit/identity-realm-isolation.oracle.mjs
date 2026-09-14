import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const runDirectory = option('--run-directory');
const criteriaPath = option('--criteria');
const outputPath = option('--output');
const inputNames = Object.freeze([
  'host-resolution-negative-matrix.json',
  'realm-scope-node-negative-matrix.json',
  'authority-forgery-database-diff.json',
  'authorization-denial-audit.jsonl',
  'compatibility-path-trace.json',
  'environment.json',
]);
const [criteria, host, isolation, forgery, auditText, compatibility, environment] = await Promise.all([
  readJson(criteriaPath),
  readJson(join(runDirectory, inputNames[0])),
  readJson(join(runDirectory, inputNames[1])),
  readJson(join(runDirectory, inputNames[2])),
  readFile(join(runDirectory, inputNames[3]), 'utf8'),
  readJson(join(runDirectory, inputNames[4])),
  readJson(join(runDirectory, inputNames[5])),
]);
const audits = auditText.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
const missingItems = [];
const expectedInvalidIds = Object.freeze([
  'E12-NEG-01-UNKNOWN-HOST',
  'E12-NEG-02-AMBIGUOUS-HOST',
  'E12-NEG-03-CROSS-REALM-HOST',
  'E12-NEG-04-CROSS-SCOPE',
  'E12-NEG-05-WRONG-NODE-IDENTITY',
  'E12-NEG-06-STALE-ACCESS-VERSION',
  'E12-NEG-07-SUSPENDED-NODE-OR-MEMBERSHIP',
]);
const expectedForgeryFields = Object.freeze(['realm', 'membership', 'scope', 'node_id', 'mall_id', 'role']);

const hostCases = byId(host.invalid_cases);
const databaseCases = byId(isolation.invalid_cases);
const positiveHost = byId(host.positive_cases);
const positiveDatabase = byId(isolation.positive_cases);
const httpForgeries = new Map(forgery.http_requests.map((entry) => [entry.field, entry]));
const writeForgeries = new Map(forgery.write_requests.map((entry) => [entry.field, entry]));
const auditCases = byId(audits);

requireCount(host.positive_cases, 2, 'two HTTP positive baselines', missingItems);
requireCount(isolation.positive_cases, 2, 'two database positive baselines', missingItems);
for (const id of expectedInvalidIds) {
  if (!databaseCases.has(id) && !hostCases.has(id)) missingItems.push(`invalid case ${id}`);
  if (!auditCases.has(id)) missingItems.push(`denial audit ${id}`);
}
for (const field of expectedForgeryFields) {
  if (!httpForgeries.has(field)) missingItems.push(`HTTP forgery field ${field}`);
  if (!writeForgeries.has(field)) missingItems.push(`write forgery field ${field}`);
}
if (!isolation.database_before || !isolation.database_after || !isolation.database_diff) {
  missingItems.push('direct database before/after/diff');
}
if (!compatibility.database || !compatibility.http) missingItems.push('compatibility path trace');

const positiveMismatches = [
  comparePositive('E12-POS-A-A', host.baselines.node_a, positiveHost, positiveDatabase),
  comparePositive('E12-POS-B-B', host.baselines.node_b, positiveHost, positiveDatabase),
].filter((entry) => entry !== null);

const invalidEvaluations = [
  evaluateUnknownHost(hostCases.get('E12-NEG-01-UNKNOWN-HOST'), databaseCases.get('E12-NEG-01-UNKNOWN-HOST')),
  evaluateAmbiguousHost(hostCases.get('E12-NEG-02-AMBIGUOUS-HOST'), databaseCases.get('E12-NEG-02-AMBIGUOUS-HOST')),
  evaluateCrossRealm(databaseCases.get('E12-NEG-03-CROSS-REALM-HOST')),
  evaluateCrossScope(databaseCases.get('E12-NEG-04-CROSS-SCOPE')),
  evaluateWrongNode(databaseCases.get('E12-NEG-05-WRONG-NODE-IDENTITY')),
  evaluateStale(databaseCases.get('E12-NEG-06-STALE-ACCESS-VERSION')),
  evaluateSuspended(databaseCases.get('E12-NEG-07-SUSPENDED-NODE-OR-MEMBERSHIP')),
];
const invalidAcceptanceCount = invalidEvaluations.filter((entry) => entry.accepted).length;
const databaseDiff = isolation.database_diff;
  const invalidBusinessWriteCount = databaseDiff.changed_table_count === 0
  && databaseDiff.authoritative_ownership_changed === false
  && crossRealmWriteUnchanged(databaseCases.get('E12-NEG-03-CROSS-REALM-HOST')) ? 0 : 1;
const invalidOutboxCount = databaseDiff.outbox_row_delta === 0
  && databaseDiff.e12_outbox_row_delta === 0
  && crossRealmOutboxUnchanged(databaseCases.get('E12-NEG-03-CROSS-REALM-HOST')) ? 0 : 1;

const forgeryEvaluations = expectedForgeryFields.map((field) => evaluateForgery(
  field,
  host.baselines.node_a,
  isolation.baselines.node_a,
  httpForgeries.get(field),
  writeForgeries.get(field),
));
const forgedOwnershipChanges = forgeryEvaluations.filter((entry) => entry.ownership_changed).length;
const defaultNodeFallbackCount = [
  hostCases.get('E12-NEG-01-UNKNOWN-HOST'),
  hostCases.get('E12-NEG-02-AMBIGUOUS-HOST'),
].filter((entry) => entry?.handler_invocations !== 0 || entry?.handler_context !== null
  || entry?.direct_resolved_context !== null).length
  + (compatibility.database.resolver_availability.legacy_session_resolver === null ? 0 : 1);
const denialAuditMismatchCount = expectedInvalidIds.filter((id) => {
  const audit = auditCases.get(id);
  return audit?.decision !== 'deny' || typeof audit.reason !== 'string' || audit.reason.length === 0;
}).length;

const thresholds = Object.freeze([
  threshold('valid_baseline_mismatch_count', 0, positiveMismatches.length),
  threshold('invalid_request_acceptance_count', 0, invalidAcceptanceCount),
  threshold('invalid_business_write_count', 0, invalidBusinessWriteCount),
  threshold('invalid_outbox_count', 0, invalidOutboxCount),
  threshold('forged_ownership_changes', 0, forgedOwnershipChanges),
  threshold('default_node_fallback_count', 0, defaultNodeFallbackCount),
  threshold('denial_audit_mismatch_count', 0, denialAuditMismatchCount),
]);
const contradictions = thresholds.filter((entry) => !entry.met).map((entry) => entry.threshold_id);
if (criteria.claim_id !== 'E2-ISO-001' || criteria.legacy_trace_id !== 'E12'
  || criteria.prelocked_thresholds?.length !== 6) {
  missingItems.push('recognized prelocked E12 criteria');
}
const claimOutcome = missingItems.length > 0 ? 'UNKNOWN' : contradictions.length > 0 ? 'NOT MET' : 'MET';
const inputArtifacts = await Promise.all([criteriaPath, ...inputNames.map((name) => join(runDirectory, name))]
  .map(async (path) => ({ path, sha256: `sha256:${sha256(await readFile(path))}` })));
const result = Object.freeze({
  schema_version: 'e12-independent-oracle-v1',
  oracle_id: 'E2-ORACLE-E12-AUTHORITY-DIFF',
  executed_at: new Date().toISOString(),
  independent_from_test_program: true,
  reads_test_program_pass: false,
  criteria: {
    criteria_id: criteria.criteria_id,
    sha256: inputArtifacts[0].sha256,
    locked_at: criteria.locked_at,
  },
  input_artifacts: inputArtifacts,
  computed_observations: {
    positive_baseline_mismatches: positiveMismatches,
    invalid_case_evaluations: invalidEvaluations,
    forgery_evaluations: forgeryEvaluations,
    database_diff: databaseDiff,
    denial_audit_count: audits.length,
    denial_audit_mismatch_count: denialAuditMismatchCount,
    environment_kind: environment.kind,
  },
  thresholds,
  missing_items: Object.freeze([...new Set(missingItems)]),
  contradictions,
  claim_outcome: claimOutcome,
  environment_assurance: claimOutcome === 'UNKNOWN' ? 'NOT ESTABLISHED' : 'DEV VERIFIED',
  review_assurance: 'NOT REVIEWED',
});
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
console.log(`E12 independent oracle: outcome=${claimOutcome} missing=${result.missing_items.length} contradictions=${contradictions.length}`);

function option(name) {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (!value) throw new Error(`E12_ORACLE_OPTION_REQUIRED:${name}`);
  return value;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function byId(entries) {
  return new Map((entries ?? []).map((entry) => [entry.case_id, entry]));
}

function requireCount(entries, count, label, missing) {
  if (!Array.isArray(entries) || entries.length !== count) missing.push(label);
}

function comparePositive(caseId, expected, httpCases, databaseCases) {
  const httpCase = httpCases.get(caseId);
  const databaseCase = databaseCases.get(caseId);
  const httpContext = httpCase?.handler_context;
  const databaseContext = databaseCase?.response?.resolved_context;
  const mismatches = [];
  if (httpCase?.response?.status !== 200 || httpCase?.handler_invocations !== 1) mismatches.push('HTTP_STATUS_OR_HANDLER');
  for (const field of ['node_id', 'realm_id', 'scope_id', 'mall_id']) {
    if (httpContext?.[field] !== expected[field]) mismatches.push(`HTTP_${field}`);
  }
  for (const field of ['node_id', 'realm_id', 'mall_id']) {
    if (databaseContext?.[field] !== expected[field]) mismatches.push(`DATABASE_${field}`);
  }
  if (databaseContext?.membership_id !== databaseCase?.expected_context?.membership_id) mismatches.push('DATABASE_membership_id');
  return mismatches.length === 0 ? null : { case_id: caseId, mismatches };
}

function evaluateUnknownHost(httpCase, databaseCase) {
  const accepted = httpCase?.response?.status !== 421 || httpCase?.handler_invocations !== 0
    || !httpCase?.resolver_error?.message?.startsWith('SFL_NODE_MANIFEST_HOST_UNKNOWN:')
    || databaseCase?.response?.row_count !== 0;
  return { case_id: 'E12-NEG-01-UNKNOWN-HOST', accepted };
}

function evaluateAmbiguousHost(httpCase, databaseCase) {
  const accepted = httpCase?.response?.status !== 421 || httpCase?.handler_invocations !== 0
    || !httpCase?.resolver_error?.message?.startsWith('SFL_NODE_MANIFEST_HOST_AMBIGUOUS:')
    || databaseCase?.response?.database_error?.code !== '23505'
    || databaseCase?.response?.authoritative_rows?.length !== 1;
  return { case_id: 'E12-NEG-02-AMBIGUOUS-HOST', accepted };
}

function evaluateCrossRealm(entry) {
  return { case_id: 'E12-NEG-03-CROSS-REALM-HOST', accepted: entry?.response?.row_count !== 0 };
}

function evaluateCrossScope(entry) {
  return { case_id: 'E12-NEG-04-CROSS-SCOPE', accepted: entry?.response?.policy_decision?.reason !== 'SCOPE_DENIED' };
}

function evaluateWrongNode(entry) {
  return { case_id: 'E12-NEG-05-WRONG-NODE-IDENTITY', accepted: entry?.response?.error?.message !== 'NODE_SCOPE_MISMATCH' };
}

function evaluateStale(entry) {
  return { case_id: 'E12-NEG-06-STALE-ACCESS-VERSION', accepted: entry?.response?.row_count !== 0 };
}

function evaluateSuspended(entry) {
  const variants = entry?.variants ?? [];
  const accepted = variants.length !== 2 || variants.some((variant) => variant.response?.row_count !== 0);
  return { case_id: 'E12-NEG-07-SUSPENDED-NODE-OR-MEMBERSHIP', accepted };
}

function crossRealmWriteUnchanged(staleCase) {
  const probe = staleCase?.cross_realm_write_probe;
  return probe?.error?.operation_result?.status === 404
    && JSON.stringify(probe.before?.sessions) === JSON.stringify(probe.after?.sessions)
    && (probe.after?.outbox?.length ?? -1) === 0;
}

function crossRealmOutboxUnchanged(staleCase) {
  return staleCase?.cross_realm_write_probe?.after?.outbox?.length === 0;
}

function evaluateForgery(field, httpBaseline, databaseBaseline, httpCase, writeCase) {
  const httpContext = httpCase?.handler_context;
  const authoritative = writeCase?.authoritative_context;
  const sessions = writeCase?.database_after_write_before_rollback?.sessions ?? [];
  const outbox = writeCase?.database_after_write_before_rollback?.outbox ?? [];
  const sourceSession = sessions.find((entry) => entry.id === databaseBaseline.session_id);
  const nonSourceSessions = sessions.filter((entry) => entry.id !== databaseBaseline.session_id);
  const ownershipChanged = httpCase?.response?.status !== 200
    || httpCase?.handler_invocations !== 1
    || httpContext?.node_id !== httpBaseline.node_id
    || httpContext?.realm_id !== httpBaseline.realm_id
    || httpContext?.scope_id !== httpBaseline.scope_id
    || httpContext?.mall_id !== httpBaseline.mall_id
    || authoritative?.realm_id !== databaseBaseline.realm_id
    || authoritative?.membership_id !== databaseBaseline.membership_id
    || authoritative?.scope_id !== `principal:realm-isolation:l1`
    || authoritative?.node_id !== databaseBaseline.node_id
    || authoritative?.mall_id !== databaseBaseline.mall_id
    || writeCase?.error !== null
    || writeCase?.response?.status !== 200
    || sourceSession?.revoked_at == null
    || nonSourceSessions.some((entry) => entry.revoked_at !== null)
    || outbox.length !== 1
    || outbox[0]?.aggregate_id !== databaseBaseline.session_id
    || outbox[0]?.scope_id !== databaseBaseline.membership_id;
  return { field, ownership_changed: ownershipChanged };
}

function threshold(thresholdId, expected, actual) {
  return Object.freeze({ threshold_id: thresholdId, expected, actual, met: actual === expected });
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}
