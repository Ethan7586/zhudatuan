import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

export async function finalizeE07Evidence(input) {
  const oraclePath = join(input.evidenceDirectory, 'continuity-independent-recount.json');
  const oracle = await readJson(oraclePath);
  const criteria = await readJson(input.criteriaPath);
  if (Date.parse(criteria.locked_at) >= Date.parse(input.startedAt)) throw new Error('E07_CRITERIA_NOT_LOCKED_BEFORE_EXECUTION');
  const runPath = repositoryPath(input.evidenceDirectory);
  const criteriaRepositoryPath = repositoryPath(input.criteriaPath);
  const oracleInvocation = `node 04_tools/scripts/audit/e07-continuity.oracle.mjs --run-directory ${runPath} --criteria ${criteriaRepositoryPath} --output ${join(runPath, 'continuity-independent-recount.json')}`;
  const executionLog = Object.freeze({
    schema_version: 'e07-execution-log-v1',
    started_at: input.startedAt,
    completed_at: input.completedAt,
    source_sha: input.sourceControl.sha,
    tree_state_before_execution: input.sourceControl.tree_state,
    commands: [
      `npm run evidence:e07 -- --evidence-directory ${runPath}`,
      'node 04_tools/scripts/audit/database-contracts.mjs --postgres-fresh <ephemeral-postgres-url>',
      oracleInvocation,
    ],
    observed_execution: input.executionSummary,
    cleanup: `docker rm -f ${input.container}`,
    exit_code: 0,
  });
  await writeJson(join(input.evidenceDirectory, 'execution-log.json'), executionLog);

  const artifactDefinitions = [
    ['mall-opening-lineage-before-after.json', 'Before/after identity, lineage, Membership and append-only opening snapshots for four Hosted nodes'],
    ['mall-opening-infra-counts.json', 'Hosted provisioning counters, zero-infrastructure observation and production implementation scan'],
    ['sovereign-upgrade-state-timeline.json', 'Two production Sovereign upgrade responses, authority rows and four-step timelines'],
    ['sovereign-upgrade-manifest-pointers.json', 'Domain, resource and manifest rows with null release pointers for both upgrade targets'],
    ['history-digests.json', 'Canonical immutable identity, lineage and pre-transition history digests across all four stages'],
    ['nontarget-transition-diff.json', 'Complete target/non-target snapshots and canonical hashes across the upgrade transition'],
    ['source-build-counts.json', 'Before/after business source inventory plus zero per-node build observations'],
    ['rollback-receipts.json', 'Two rollback receipts, restored Hosted snapshots and final resource/history rows'],
    ['continuity-database-raw-rows.json', 'Raw identity, lineage, opening, upgrade, resource, manifest and Outbox database rows'],
    ['environment.json', 'Disposable execution environment identity and production differences'],
    ['continuity-independent-recount.json', 'Independent continuity, resource, isolation and rollback recount with negative probes'],
    ['migration-replay.txt', 'Complete migration replay completion output'],
    ['execution-log.json', 'Exact commands, source SHA, execution totals and cleanup record'],
  ];
  const artifacts = await Promise.all(artifactDefinitions.map(async ([name, role]) => artifact(
    join(input.evidenceDirectory, name), role, name.endsWith('.json') ? 'application/json' : 'text/plain')));
  const criteriaBytes = await readFile(input.criteriaPath);
  artifacts.push(Object.freeze({
    path_or_uri: criteriaRepositoryPath,
    media_type: 'application/json',
    sha256: `sha256:${sha256(criteriaBytes)}`,
    size_bytes: criteriaBytes.byteLength,
    role: 'Pre-execution locked E07 criteria snapshot',
  }));

  const actor = Object.freeze({
    actor_id: 'codex-task-e07-acceptance-repair-20260914',
    role: 'E07 continuity fixture and independent recount operator',
    organization: 'zhudatuan internal',
    relationship_to_test_item: 'Implemented the E07 disposable fixture and evidence exporter, invoked the production opening/upgrade/rollback transactions and operated the separate raw-evidence oracle; not an independent reviewer.',
  });
  const gaps = Object.freeze([
    'No stable separately managed staging replay has been performed.',
    'Sovereign resource values were synthetic database references; no authorized real DNS, TLS, tunnel, runtime, secret or payment-provider readiness observation was performed.',
    'No deployment or release pointer was created, so this run does not establish deployment readiness or production serving behavior.',
    'No reviewer independent of the E07 fixture, transition implementation and oracle has recomputed and signed the evidence.',
  ]);
  const evidencePath = join(input.evidenceDirectory, 'E2.0-E07-证据.json');
  const evidence = Object.freeze({
    $schema: '../../E2.0-证据.schema.json',
    schema_version: 'e2.0-evidence-v2',
    evidence_id: `E2-EVID-E07-DEV-${input.completedAt.slice(0, 10).replaceAll('-', '')}`,
    profile_version: '2.0.0',
    non_gating: true,
    claim_ids: ['E2-CONT-001'],
    criteria: {
      criteria_id: criteria.criteria_id,
      path: criteriaRepositoryPath,
      sha256: `sha256:${sha256(criteriaBytes)}`,
      locked_at: criteria.locked_at,
      locked_before_execution: true,
      test_designer: actor,
    },
    test_basis_refs: [...criteria.authoritative_basis, ...criteria.implementation_basis, ...criteria.regression_basis]
      .map((entry) => entry.path),
    execution: {
      started_at: input.startedAt,
      completed_at: input.completedAt,
      executor: actor,
      invocations: [{
        kind: 'COMMAND',
        exact: `npm run evidence:e07 -- --evidence-directory ${runPath}`,
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
      summary: `postgres:17-alpine ${input.environment.runtime.docker_image_id}; ${input.environment.runtime.migration_count} migrations; four Hosted openings; two Sovereign upgrades; two rollbacks; ${input.executionSummary.source_file_count} production source files inventoried without a per-node build.`,
      digest: input.environment.configuration_digest,
      unknown_fields: [],
    },
    raw_observations: oracle.thresholds.map((entry) => ({
      observation_id: `OBS-E07-${entry.threshold_id.toUpperCase().replaceAll('_', '-')}`,
      source: 'continuity-independent-recount.json',
      value: { expected: entry.expected, actual: entry.actual, met: entry.met },
      unit: 'count',
      captured_at: oracle.executed_at,
      notes: 'Recomputed from the ten locked raw artifacts; no runner PASS/status field was read.',
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
      steps: [
        `Check out ${input.sourceControl.sha}.`,
        `Run npm run evidence:e07 -- --evidence-directory ${runPath}.`,
        'Read continuity-independent-recount.json and independently verify the listed artifact hashes and raw rows.',
      ],
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
        ? `All ${input.executionSummary.opening_count} original Hosted nodes opened in place, both selected nodes upgraded to Sovereign and rolled back without identity or historical-lineage replacement, both non-target nodes remained unchanged, Hosted infrastructure and per-node build counts stayed zero, and all four negative oracle mutations were detected.`
        : `The independent oracle computed ${oracle.claim_outcome}; inspect missing_items, violations and negative_probes in continuity-independent-recount.json.`,
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
  const statementPath = join(input.evidenceDirectory, 'E2.0-E07-符合性声明.json');
  const statement = Object.freeze({
    $schema: '../../E2.0-符合性声明.schema.json',
    schema_version: 'e2.0-conformity-statement-v2',
    statement_id: `E2-STATEMENT-E07-DEV-${input.completedAt.slice(0, 10).replaceAll('-', '')}`,
    template: false,
    profile_id: 'E2.0',
    profile_version: '2.0.0',
    issued_at: input.completedAt,
    scope: `E2-CONT-001 / legacy E07 at source SHA ${input.sourceControl.sha}, disposable local PostgreSQL 17 and synthetic non-production resource references only.`,
    claim_ids: ['E2-CONT-001'],
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
    if (!validate(value)) throw new Error(`E07_${name.toUpperCase()}_SCHEMA_INVALID:${JSON.stringify(validate.errors)}`);
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
