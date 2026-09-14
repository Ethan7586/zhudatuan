import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

export async function finalizeE01Evidence(input) {
  const oraclePath = join(input.evidenceDirectory, 'horizontal-independent-recount.json');
  const oracle = await readJson(oraclePath);
  const criteria = await readJson(input.criteriaPath);
  if (Date.parse(criteria.locked_at) >= Date.parse(input.startedAt)) throw new Error('E01_CRITERIA_NOT_LOCKED_BEFORE_EXECUTION');
  const runPath = repositoryPath(input.evidenceDirectory);
  const criteriaRepositoryPath = repositoryPath(input.criteriaPath);
  const oracleInvocation = `node 04_tools/scripts/audit/e01-horizontal-nodes.oracle.mjs --run-directory ${runPath} --criteria ${criteriaRepositoryPath} --output ${join(runPath, 'horizontal-independent-recount.json')}`;
  const executionLog = Object.freeze({
    schema_version: 'e01-execution-log-v1',
    started_at: input.startedAt,
    completed_at: input.completedAt,
    source_sha: input.sourceControl.sha,
    tree_state_before_execution: input.sourceControl.tree_state,
    commands: [
      `npm run evidence:e01 -- --evidence-directory ${runPath}`,
      `node 04_tools/scripts/release/build-runtime-bundle.mjs commerce-api <temporary-output-directory> ${input.sourceControl.sha}`,
      'node 04_tools/scripts/audit/database-contracts.mjs --identity-realm-isolation <ephemeral-postgres-url> local-disposable-fixture',
      oracleInvocation,
    ],
    observed_execution: input.executionSummary,
    cleanup: `database ROLLBACK; docker rm -f ${input.container}; remove temporary shared artifact directory`,
    exit_code: 0,
  });
  await writeJson(join(input.evidenceDirectory, 'execution-log.json'), executionLog);

  const artifactDefinitions = [
    ['horizontal-input-manifest.json', 'Synthetic H-A, H-B and H-C topology, authority and operation inputs'],
    ['horizontal-topology.json', 'Raw shared Node, NodeRelation and NodeClosure rows'],
    ['horizontal-node-contexts.json', 'Three parsed NodeContexts and complete authority maps'],
    ['horizontal-operation-results.json', 'Nine positive and thirty cross-node raw request/decision observations'],
    ['horizontal-database-diff.json', 'Authoritative resource, audit and Outbox before/after/rollback rows and diffs'],
    ['horizontal-model-inventory.json', 'Database model, resolver, parser, source-copy and node-name-branch inventories'],
    ['horizontal-artifact-identity.json', 'Scoped source inventory, one build, one artifact and three peer assignments'],
    ['environment.json', 'Disposable PostgreSQL 17, full migration replay, source and artifact environment identity'],
    ['horizontal-independent-recount.json', 'Independent topology, context, operation, database and artifact recomputation'],
    ['migration-replay.txt', 'Complete production migration replay completion output'],
    ['execution-log.json', 'Exact command, source SHA, execution totals and cleanup record'],
  ];
  const artifacts = await Promise.all(artifactDefinitions.map(async ([name, role]) => artifact(
    join(input.evidenceDirectory, name), role, name.endsWith('.json') ? 'application/json' : 'text/plain')));
  const criteriaBytes = await readFile(input.criteriaPath);
  artifacts.push(Object.freeze({
    path_or_uri: criteriaRepositoryPath,
    media_type: 'application/json',
    sha256: `sha256:${sha256(criteriaBytes)}`,
    size_bytes: criteriaBytes.byteLength,
    role: 'Pre-execution locked E01 criteria snapshot',
  }));

  const actor = Object.freeze({
    actor_id: 'codex-task-e01-acceptance-repair-20260914',
    role: 'E01 horizontal shared-node-model test operator',
    organization: 'zhudatuan internal',
    relationship_to_test_item: 'Implemented the missing E01 formal exporter and operated the separate raw-evidence oracle; did not change the production node model and is not an independent reviewer.',
  });
  const gaps = Object.freeze([
    'No stable separately managed staging replay has been performed.',
    'No authorized production observation has been performed.',
    'All H-A, H-B and H-C nodes, identities, scopes, capabilities and resources were synthetic and transaction-rolled-back.',
    'The one shared commerce-api artifact was built and inventoried locally but was not activated on Hosted or Sovereign infrastructure.',
    'No reviewer independent of the E01 fixture, exporter and oracle has recomputed and signed the evidence.',
  ]);
  const evidencePath = join(input.evidenceDirectory, 'E2.0-E01-证据.json');
  const evidence = Object.freeze({
    $schema: '../../E2.0-证据.schema.json',
    schema_version: 'e2.0-evidence-v2',
    evidence_id: `E2-EVID-E01-DEV-${input.completedAt.slice(0, 10).replaceAll('-', '')}`,
    profile_version: '2.0.0',
    non_gating: true,
    claim_ids: ['E2-TOPO-001'],
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
        exact: `npm run evidence:e01 -- --evidence-directory ${runPath}`,
        working_directory: 'repository root',
        exit_code: 0,
        stdout_artifact: repositoryPath(join(input.evidenceDirectory, 'execution-log.json')),
        stderr_artifact: null,
        sensitive_value_handling: 'The disposable PostgreSQL password, connection URL and synthetic session hashes were used only in process memory and were not persisted. Evidence contains only synthetic identifiers and non-secret references.',
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
      summary: `postgres:17-alpine ${input.environment.runtime.docker_image_id}; ${input.environment.runtime.migration_count} migrations; three horizontal L1 peers; ${input.executionSummary.positive_observation_count} positive and ${input.executionSummary.cross_node_observation_count} cross-node observations; one shared commerce-api build.`,
      digest: input.environment.configuration_digest,
      unknown_fields: [],
    },
    raw_observations: oracle.thresholds.map((entry) => ({
      observation_id: `OBS-E01-${entry.threshold_id.toUpperCase().replaceAll('_', '-')}`,
      source: 'horizontal-independent-recount.json',
      value: { expected: entry.expected, actual: entry.actual, met: entry.met },
      unit: 'count',
      captured_at: oracle.executed_at,
      notes: 'Recomputed from the eight required raw artifacts; no runner PASS/status field was read.',
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
        `Run npm run evidence:e01 -- --evidence-directory ${runPath}.`,
        'Read horizontal-independent-recount.json and independently verify its input hashes, raw rows and build inventory.',
      ],
      expected_raw_observations: criteria.prelocked_thresholds,
      cleanup: 'The runner rolls back the complete E01 database transaction, removes the disposable PostgreSQL container and deletes the temporary shared runtime artifact in finally blocks.',
    },
    assessment: {
      claim_outcome: oracle.claim_outcome,
      environment_assurance: oracle.environment_assurance,
      review_assurance: 'NOT REVIEWED',
      alignment_depth: 'PROJECT_CUSTOM',
      applicability_ref: null,
      rationale: oracle.claim_outcome === 'MET'
        ? 'H-A, H-B and H-C shared one Node/Relation/Closure model, one production context parser path and one source/build/artifact identity; all context and authority maps matched; nine positive outcomes followed data, all thirty cross-node requests were denied without business or Outbox leakage, all three writes remained target-local, and rollback left no E01 facts.'
        : `The independent oracle computed ${oracle.claim_outcome}; inspect missing_items and violations in horizontal-independent-recount.json.`,
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
  const statementPath = join(input.evidenceDirectory, 'E2.0-E01-符合性声明.json');
  const statement = Object.freeze({
    $schema: '../../E2.0-符合性声明.schema.json',
    schema_version: 'e2.0-conformity-statement-v2',
    statement_id: `E2-STATEMENT-E01-DEV-${input.completedAt.slice(0, 10).replaceAll('-', '')}`,
    template: false,
    profile_id: 'E2.0',
    profile_version: '2.0.0',
    issued_at: input.completedAt,
    scope: `E2-TOPO-001 / legacy E01 at source SHA ${input.sourceControl.sha}, disposable local PostgreSQL 17 horizontal peer-node execution and local shared runtime build.`,
    claim_ids: ['E2-TOPO-001'],
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
  const [{ default: Ajv2020 }, { default: addFormats }] = await Promise.all([
    import('ajv/dist/2020.js'), import('ajv-formats'),
  ]);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  for (const [name, value, schemaName] of [
    ['evidence', evidence, 'E2.0-证据.schema.json'],
    ['statement', statement, 'E2.0-符合性声明.schema.json'],
  ]) {
    const schema = await readJson(join(repositoryRoot, '05_docs_ziliao', 'docs_wendang', 'architecture', 'evidence', 'e2.0', schemaName));
    const validate = ajv.compile(schema);
    if (!validate(value)) throw new Error(`E01_${name.toUpperCase()}_SCHEMA_INVALID:${JSON.stringify(validate.errors)}`);
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
