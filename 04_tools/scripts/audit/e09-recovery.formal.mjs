import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

export async function finalizeE09Evidence(input) {
  const oraclePath = join(input.evidenceDirectory, 'recovery-independent-recount.json');
  const oracle = await readJson(oraclePath);
  const criteria = await readJson(input.criteriaPath);
  if (Date.parse(criteria.locked_at) >= Date.parse(input.startedAt)) throw new Error('E09_CRITERIA_NOT_LOCKED_BEFORE_EXECUTION');
  const runPath = repositoryPath(input.evidenceDirectory);
  const criteriaRepositoryPath = repositoryPath(input.criteriaPath);
  const oracleInvocation = `node 04_tools/scripts/audit/e09-recovery.oracle.mjs --run-directory ${runPath} --criteria ${criteriaRepositoryPath} --output ${join(runPath, 'recovery-independent-recount.json')}`;
  const executionLog = Object.freeze({
    schema_version: 'e09-execution-log-v1',
    started_at: input.startedAt,
    completed_at: input.completedAt,
    source_sha: input.sourceControl.sha,
    tree_state_before_execution: input.sourceControl.tree_state,
    commands: [
      `npm run evidence:e09 -- --evidence-directory ${runPath}`,
      'node 04_tools/scripts/audit/database-contracts.mjs --postgres-fresh <ephemeral-postgres-url>',
      'node --import tsx 04_tools/scripts/audit/e09-recovery.workload.ts --database-url <ephemeral-postgres-url> --criteria <locked-criteria> --output-directory <run-directory>',
      oracleInvocation,
    ],
    observed_execution: input.executionSummary,
    cleanup: `docker rm -f ${input.container}`,
    exit_code: 0,
  });
  await writeJson(join(input.evidenceDirectory, 'execution-log.json'), executionLog);

  const artifactDefinitions = [
    ['idempotency-five-way-results.json', 'Five simultaneous request/response sets and authoritative cardinalities for every operation/node pair'],
    ['idempotency-conflict-results.json', 'Same-key different-hash rejection and before/after state digests'],
    ['interruption-state-diffs.json', 'Before, interrupted and terminal snapshots for all four fixed interruption points'],
    ['recovery-receipts.json', 'Reconstructed transaction/provider continuation receipts for every interruption'],
    ['nontarget-isolation-diff.json', 'Target recovery plus complete target/non-target snapshots and canonical diffs'],
    ['database-raw-rows.json', 'Raw runtime idempotency, business fact, checkpoint and provider-command rows'],
    ['provider-receipts.json', 'Raw deterministic provider resources, receipts and apply-attempt rows'],
    ['audit-and-outbox-rows.json', 'Raw production audit records and runtime Outbox rows'],
    ['environment.json', 'Disposable execution environment identity and production differences'],
    ['recovery-independent-recount.json', 'Independent authority, recovery, provider and isolation recount with negative probes'],
    ['workload-execution.json', 'Observed E09 workload matrix totals'],
    ['migration-replay.txt', 'Complete migration replay completion output'],
    ['execution-log.json', 'Exact commands, source SHA, matrix totals and cleanup record'],
  ];
  const artifacts = await Promise.all(artifactDefinitions.map(async ([name, role]) => artifact(
    join(input.evidenceDirectory, name), role, name.endsWith('.json') ? 'application/json' : 'text/plain')));
  const criteriaBytes = await readFile(input.criteriaPath);
  artifacts.push(Object.freeze({
    path_or_uri: criteriaRepositoryPath,
    media_type: 'application/json',
    sha256: `sha256:${sha256(criteriaBytes)}`,
    size_bytes: criteriaBytes.byteLength,
    role: 'Pre-execution locked E09 criteria snapshot',
  }));

  const actor = Object.freeze({
    actor_id: 'codex-task-e09-acceptance-repair-20260914',
    role: 'E09 failure-injection test and independent recount operator',
    organization: 'zhudatuan internal',
    relationship_to_test_item: 'Implemented the E09 disposable workload and evidence exporter, executed the production critical-write kernel and operated the separate raw-evidence oracle; not an independent reviewer.',
  });
  const gaps = Object.freeze([
    'No stable separately managed staging replay has been performed.',
    'The DEV provider is deterministic and local; no authorized real payment, DNS or cloud-provider recovery observation has been performed.',
    'Synthetic business actions were used behind the five registered operation IDs; this run does not establish each live module handler business contract.',
    'No reviewer independent of the E09 workload, recovery implementation and oracle has recomputed and signed the evidence.',
  ]);
  const evidencePath = join(input.evidenceDirectory, 'E2.0-E09-证据.json');
  const evidence = Object.freeze({
    $schema: '../../E2.0-证据.schema.json',
    schema_version: 'e2.0-evidence-v2',
    evidence_id: `E2-EVID-E09-DEV-${input.completedAt.slice(0, 10).replaceAll('-', '')}`,
    profile_version: '2.0.0',
    non_gating: true,
    claim_ids: ['E2-REC-001'],
    criteria: {
      criteria_id: criteria.criteria_id,
      path: criteriaRepositoryPath,
      sha256: `sha256:${sha256(criteriaBytes)}`,
      locked_at: criteria.locked_at,
      locked_before_execution: true,
      test_designer: actor,
    },
    test_basis_refs: [...criteria.authoritative_basis, ...criteria.implementation_basis].map((entry) => entry.path),
    execution: {
      started_at: input.startedAt,
      completed_at: input.completedAt,
      executor: actor,
      invocations: [{
        kind: 'COMMAND',
        exact: `npm run evidence:e09 -- --evidence-directory ${runPath}`,
        working_directory: 'repository root',
        exit_code: 0,
        stdout_artifact: repositoryPath(join(input.evidenceDirectory, 'execution-log.json')),
        stderr_artifact: null,
        sensitive_value_handling: 'The generated disposable PostgreSQL password and connection URL were used only in process memory and were not persisted in evidence.',
      }],
    },
    environment: {
      kind: input.environment.kind,
      environment_id: input.environment.environment_id,
      description: input.environment.description,
      owner: input.environment.owner,
      isolation: input.environment.isolation,
      real_customer_data: input.environment.real_customer_data,
      production_impact: input.environment.production_impact,
      differences_from_production: input.environment.differences_from_production,
    },
    source_control: {
      repository: 'zdt-next',
      evidence_commit_sha: input.sourceControl.sha,
      test_item_shas: [input.sourceControl.sha],
      execution_tree_state: input.sourceControl.tree_state,
      diff_sha256: null,
    },
    configuration: {
      summary: `postgres:17-alpine ${input.environment.runtime.docker_image_id}; ${input.environment.runtime.migration_count} migrations; three nodes; five operations; five-way=${input.executionSummary.five_way_scenarios}; conflict=${input.executionSummary.conflict_scenarios}; interruptions=${input.executionSummary.interruption_scenarios}; target recoveries=${input.executionSummary.isolation_target_recoveries}.`,
      digest: input.environment.configuration_digest,
      unknown_fields: [],
    },
    raw_observations: oracle.thresholds.map((entry) => ({
      observation_id: `OBS-E09-${entry.threshold_id.toUpperCase().replaceAll('_', '-')}`,
      source: 'recovery-independent-recount.json',
      value: { expected: entry.expected, actual: entry.actual, met: entry.met },
      unit: 'count',
      captured_at: oracle.executed_at,
      notes: 'Recomputed from the nine locked raw artifacts; no runner PASS/status field was read.',
    })),
    artifacts,
    independent_oracle: {
      oracle_id: oracle.oracle_id,
      independent_from_test_program: true,
      reads_test_program_pass: false,
      procedure: criteria.independent_oracle.procedure,
      exact_invocation: oracleInvocation,
      evaluator: actor,
      input_artifacts: [criteriaRepositoryPath, ...criteria.required_input_artifacts.map((name) => join(runPath, name))],
      computed_observations: oracle.thresholds,
    },
    anomalies: [],
    reproduction: {
      prerequisites: ['Docker Engine', 'Node.js and repository dependencies', 'clean checkout of the recorded source SHA'],
      steps: [`Check out ${input.sourceControl.sha}.`, `Run npm run evidence:e09 -- --evidence-directory ${runPath}.`,
        'Read recovery-independent-recount.json and independently verify the listed artifact hashes and raw rows.'],
      expected_raw_observations: criteria.prelocked_thresholds,
      cleanup: 'The runner removes the disposable PostgreSQL container in a finally block; no external provider or production resource is created.',
    },
    assessment: {
      claim_outcome: oracle.claim_outcome,
      environment_assurance: oracle.environment_assurance,
      review_assurance: 'NOT REVIEWED',
      alignment_depth: 'PROJECT_CUSTOM',
      applicability_ref: null,
      rationale: oracle.claim_outcome === 'MET'
        ? `All ${input.executionSummary.five_way_scenarios} operation/node pairs converged under five simultaneous requests, all conflicts preserved accepted state, all ${input.executionSummary.interruption_scenarios} fixed interruption cases recovered to one terminal authority, all local provider receipts remained unique, and Sovereign-C recovery changed no non-target node. All four negative oracle mutations were detected.`
        : `The independent oracle computed ${oracle.claim_outcome}; inspect missing_items, violations and negative_probes in recovery-independent-recount.json.`,
      gaps,
    },
    review: {
      reviewer: null,
      reviewed_at: null,
      independence_statement: null,
      review_completed: false,
      same_as_executor: null,
      same_as_test_designer: null,
      external_to_delivery_team: null,
      conflicts_disclosed: null,
      recomputation_artifacts: [],
    },
  });
  const statementPath = join(input.evidenceDirectory, 'E2.0-E09-符合性声明.json');
  const statement = Object.freeze({
    $schema: '../../E2.0-符合性声明.schema.json',
    schema_version: 'e2.0-conformity-statement-v2',
    statement_id: `E2-STATEMENT-E09-DEV-${input.completedAt.slice(0, 10).replaceAll('-', '')}`,
    template: false,
    profile_id: 'E2.0',
    profile_version: '2.0.0',
    issued_at: input.completedAt,
    scope: `E2-REC-001 / legacy E09 at source SHA ${input.sourceControl.sha}, disposable local PostgreSQL 17 and deterministic local provider only.`,
    claim_ids: ['E2-REC-001'],
    rating: {
      claim_outcome: oracle.claim_outcome,
      environment_assurance: oracle.environment_assurance,
      review_assurance: 'NOT REVIEWED',
      alignment_depth: 'PROJECT_CUSTOM',
    },
    evidence_refs: [repositoryPath(evidencePath)],
    review_evidence_refs: [],
    tailoring_refs: [],
    gaps,
    issuer: {
      name_or_id: actor.actor_id,
      organization: actor.organization,
      role: actor.role,
      relationship_to_test_item: actor.relationship_to_test_item,
      signed_at: input.completedAt,
    },
    reviewer: null,
    mandatory_disclaimer: 'This is an E2.0 standards-aligned tailored conformity statement, not an ISO, IEEE, NIST, OWASP, PCI SSC, or third-party certification.',
    non_gating: true,
  });
  await validateEvidence(evidence, statement);
  await writeJson(evidencePath, evidence);
  await writeJson(statementPath, statement);
  return Object.freeze({ oracle, evidencePath, statementPath });
}

async function artifact(path, role, mediaType) {
  const bytes = await readFile(path);
  return Object.freeze({
    path_or_uri: repositoryPath(path),
    media_type: mediaType,
    sha256: `sha256:${sha256(bytes)}`,
    size_bytes: bytes.byteLength,
    role,
  });
}

async function validateEvidence(evidence, statement) {
  const [{ default: Ajv2020 }, { default: addFormats }] = await Promise.all([import('ajv/dist/2020.js'), import('ajv-formats')]);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  for (const [name, value, schemaName] of [
    ['evidence', evidence, 'E2.0-证据.schema.json'],
    ['statement', statement, 'E2.0-符合性声明.schema.json'],
  ]) {
    const schema = await readJson(join(repositoryRoot, '05_docs_ziliao', 'docs_wendang', 'architecture', 'evidence', 'e2.0', schemaName));
    const validate = ajv.compile(schema);
    if (!validate(value)) throw new Error(`E09_${name.toUpperCase()}_SCHEMA_INVALID:${JSON.stringify(validate.errors)}`);
  }
}

function readJson(path) {
  return readFile(path, 'utf8').then(JSON.parse);
}

function writeJson(path, value) {
  return writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function repositoryPath(path) {
  return relative(repositoryRoot, path).replaceAll('\\', '/');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
