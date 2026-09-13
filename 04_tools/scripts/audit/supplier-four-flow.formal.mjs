import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

export async function finalizeE08Evidence(input) {
  const oraclePath = join(input.evidenceDirectory, 'inventory-and-finance-reconciliation.json');
  const oracle = await readJson(oraclePath);
  const criteria = await readJson(input.criteriaPath);
  if (Date.parse(criteria.locked_at) >= Date.parse(input.startedAt)) throw new Error('E08_CRITERIA_NOT_LOCKED_BEFORE_EXECUTION');
  const runPath = repositoryPath(input.evidenceDirectory);
  const criteriaRepositoryPath = repositoryPath(input.criteriaPath);
  const oracleInvocation = `node 04_tools/scripts/audit/supplier-four-flow.oracle.mjs --run-directory ${runPath} --criteria ${criteriaRepositoryPath} --output ${join(runPath, 'inventory-and-finance-reconciliation.json')}`;
  const executionLog = Object.freeze({
    schema_version: 'e08-execution-log-v1',
    started_at: input.startedAt,
    completed_at: input.completedAt,
    source_sha: input.sourceControl.sha,
    tree_state_before_execution: input.sourceControl.tree_state,
    commands: [
      `npm run evidence:e08 -- --evidence-directory ${runPath}`,
      'node 04_tools/scripts/audit/database-contracts.mjs --postgres-fresh <ephemeral-postgres-url>',
      'Execute supplier_four_flow_business_contract.sql with only terminal cleanup ROLLBACK materialized as COMMIT inside the disposable database.',
      `Execute supplier_four_flow_concurrent_replay.sql in ${criteria.expected_fixture.concurrent_replay_attempts} simultaneous PostgreSQL sessions.`,
      oracleInvocation,
    ],
    cleanup: `docker rm -f ${input.container}`,
    exit_code: 0,
  });
  await writeJson(join(input.evidenceDirectory, 'execution-log.json'), executionLog);

  const artifactDefinitions = [
    ['supplier-route-snapshot.json', 'Authoritative order, line, supplier-leg and frozen/current route rows'],
    ['four-flow-forward-facts.json', 'Inventory, fulfillment, payment and finance forward facts'],
    ['partial-refund-replay.json', 'Refund, return, restock, reversal, replay uniqueness and atomicity rows'],
    ['inventory-and-finance-reconciliation.json', 'Independent raw-ledger reconciliation and negative oracle probes'],
    ['environment.json', 'Disposable execution environment identity'],
    ['migration-replay.log', 'Full migration replay completion output'],
    ['contract-execution.json', 'Fixture source digests and replay-session execution record'],
    ['execution-log.json', 'Exact command, source SHA and cleanup log'],
  ];
  const artifacts = await Promise.all(artifactDefinitions.map(async ([name, role]) => artifact(join(input.evidenceDirectory, name), role, name.endsWith('.log') ? 'text/plain' : 'application/json')));
  const criteriaBytes = await readFile(input.criteriaPath);
  artifacts.push(
    Object.freeze({
      path_or_uri: criteriaRepositoryPath,
      media_type: 'application/json',
      sha256: `sha256:${sha256(criteriaBytes)}`,
      size_bytes: criteriaBytes.byteLength,
      role: 'Pre-execution locked E08 criteria snapshot',
    })
  );

  const actor = Object.freeze({
    actor_id: 'codex-task-e08-acceptance-repair-20260914',
    role: 'E08 transaction test and oracle operator',
    organization: 'zhudatuan internal',
    relationship_to_test_item: 'Implemented the formal fixture orchestration and evidence exporter, executed the SQL contracts and operated the separate raw-ledger oracle; not an independent reviewer.',
  });
  const gaps = Object.freeze([
    'No stable separately managed staging replay has been performed.',
    'No authorized production observation has been performed.',
    'No finance/domain reviewer independent of the E08 test implementation and execution has recomputed and signed the evidence.',
  ]);
  const evidencePath = join(input.evidenceDirectory, 'E2.0-E08-证据.json');
  const evidence = Object.freeze({
    $schema: '../../E2.0-证据.schema.json',
    schema_version: 'e2.0-evidence-v2',
    evidence_id: `E2-EVID-E08-DEV-${input.completedAt.slice(0, 10).replaceAll('-', '')}`,
    profile_version: '2.0.0',
    non_gating: true,
    claim_ids: ['E2-TXN-001'],
    criteria: {
      criteria_id: criteria.criteria_id,
      path: criteriaRepositoryPath,
      sha256: `sha256:${sha256(criteriaBytes)}`,
      locked_at: criteria.locked_at,
      locked_before_execution: true,
      test_designer: actor,
    },
    test_basis_refs: criteria.authoritative_basis.map((entry) => entry.path),
    execution: {
      started_at: input.startedAt,
      completed_at: input.completedAt,
      executor: actor,
      invocations: [
        {
          kind: 'COMMAND',
          exact: `npm run evidence:e08 -- --evidence-directory ${runPath}`,
          working_directory: 'repository root',
          exit_code: 0,
          stdout_artifact: repositoryPath(join(input.evidenceDirectory, 'execution-log.json')),
          stderr_artifact: null,
          sensitive_value_handling: 'The generated disposable PostgreSQL password and connection URL were used only in process memory and were not persisted in evidence.',
        },
      ],
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
      summary: `postgres:17-alpine ${input.environment.runtime.docker_image_id}; ${input.environment.runtime.migration_count} migrations; locked E08 SQL contracts; ${input.contractExecution.replay_attempts} simultaneous replay sessions.`,
      digest: input.environment.configuration_digest,
      unknown_fields: [],
    },
    raw_observations: oracle.thresholds.map((entry) => ({
      observation_id: `OBS-E08-${entry.threshold_id.toUpperCase().replaceAll('_', '-')}`,
      source: 'inventory-and-finance-reconciliation.json',
      value: { expected: entry.expected, actual: entry.actual, met: entry.met },
      unit: entry.threshold_id === 'money_difference_minor' ? 'minor currency unit' : 'count',
      captured_at: oracle.executed_at,
      notes: 'Recomputed from authoritative rows; SQL assertion and runner PASS/status fields were not read.',
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
      steps: [`Check out ${input.sourceControl.sha}.`, `Run npm run evidence:e08 -- --evidence-directory ${runPath}.`, 'Read inventory-and-finance-reconciliation.json and verify all listed artifact hashes.'],
      expected_raw_observations: criteria.prelocked_thresholds,
      cleanup: 'The runner removes the disposable PostgreSQL container in a finally block; only synthetic E08 rows exist in that container.',
    },
    assessment: {
      claim_outcome: oracle.claim_outcome,
      environment_assurance: oracle.environment_assurance,
      review_assurance: 'NOT REVIEWED',
      alignment_depth: 'PROJECT_CUSTOM',
      applicability_ref: null,
      rationale:
        oracle.claim_outcome === 'MET'
          ? 'Three supplier legs, all four forward flows, both selected refunds, five-way replay uniqueness, atomic failure probes and frozen route versions independently reconciled with zero differences; all three negative oracle mutations were detected.'
          : `The independent oracle computed ${oracle.claim_outcome}; inspect missing_items, violations and negative_probes in inventory-and-finance-reconciliation.json.`,
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
  const statementPath = join(input.evidenceDirectory, 'E2.0-E08-符合性声明.json');
  const statement = Object.freeze({
    $schema: '../../E2.0-符合性声明.schema.json',
    schema_version: 'e2.0-conformity-statement-v2',
    statement_id: `E2-STATEMENT-E08-DEV-${input.completedAt.slice(0, 10).replaceAll('-', '')}`,
    template: false,
    profile_id: 'E2.0',
    profile_version: '2.0.0',
    issued_at: input.completedAt,
    scope: `E2-TXN-001 / legacy E08 at source SHA ${input.sourceControl.sha}, disposable local PostgreSQL 17 only.`,
    claim_ids: ['E2-TXN-001'],
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
    if (!validate(value)) throw new Error(`E08_${name.toUpperCase()}_SCHEMA_INVALID:${JSON.stringify(validate.errors)}`);
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
