import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

export async function finalizeE10Evidence(input) {
  const oraclePath = join(input.evidenceDirectory, 'release-feature-independent-recount.json');
  const oracle = await readJson(oraclePath);
  const criteriaBytes = await readFile(input.criteriaPath);
  if (Date.parse(input.criteria.locked_at) >= Date.parse(input.startedAt)) throw new Error('E10_CRITERIA_NOT_LOCKED_BEFORE_EXECUTION');
  const runPath = repositoryPath(input.evidenceDirectory);
  const criteriaRepositoryPath = repositoryPath(input.criteriaPath);
  const oracleInvocation = `node 04_tools/scripts/audit/e10-release.oracle.mjs --run-directory ${runPath} --criteria ${criteriaRepositoryPath} --output ${join(runPath, 'release-feature-independent-recount.json')}`;
  const executionLog = Object.freeze({
    schema_version: 'e10-execution-log-v1',
    started_at: input.startedAt,
    completed_at: input.completedAt,
    source_sha: input.sourceControl.sha,
    source_pair: input.sourcePair,
    tree_state_before_execution: input.sourceControl.tree_state,
    commands: [
      `npm run evidence:e10 -- --evidence-directory ${runPath}`,
      `node 04_tools/scripts/audit/e10-shared-build.mjs <temporary-artifact-B-directory> ${input.sourcePair.to_sha}`,
      'Run one Hosted host process for H-A/H-B/H-C and one process for each of S-A/S-B/S-C in network-isolated Docker containers.',
      'Atomically switch Hosted A→B once, S-A A→B, S-B A→B, leave S-C on A, probe three identities over page/API/task/service, then roll back S-B B→A and reprobe all controls.',
      oracleInvocation,
    ],
    observed_execution: input.executionSummary,
    cleanup: input.cleanup,
    exit_code: 0,
  });
  await writeJson(join(input.evidenceDirectory, 'execution-log.json'), executionLog);

  const roles = new Map([
    ['shared-change.patch-id.txt', 'Exact source A/B marker patch identity and Git diff digest'],
    ['single-build-provenance.json', 'One candidate build invocation and shared artifact assignments'],
    ['immutable-artifact-manifest.json', 'Recountable baseline and candidate artifact tree manifests'],
    ['node-pointer-timeline.json', 'Hosted and Sovereign pointer actions plus five fleet snapshots'],
    ['identity-feature-matrix.expected.json', 'Locked raw policies and declared expected identity/node/surface intersections'],
    ['identity-feature-matrix.observed.json', 'Raw responses from the bundled production authorization kernel on four probe routes'],
    ['single-node-rollback-and-isolation.json', 'S-B rollback receipt and non-target state/feature diffs'],
    ['environment.json', 'Disposable Docker environment identity and external-contact counters'],
    ['release-feature-independent-recount.json', 'Independent provenance, pointer, capability-set and rollback recount with negative mutations'],
    ['execution-log.json', 'Exact execution stages, source pair, summary and cleanup'],
  ]);
  const artifactNames = [...input.rawArtifactNames, 'release-feature-independent-recount.json', 'execution-log.json'];
  const artifacts = await Promise.all(artifactNames.map(async (name) => artifact(
    join(input.evidenceDirectory, name),
    roles.get(name),
    name.endsWith('.json') ? 'application/json' : 'text/plain',
  )));
  artifacts.push(Object.freeze({
    path_or_uri: criteriaRepositoryPath,
    media_type: 'application/json',
    sha256: `sha256:${sha256(criteriaBytes)}`,
    size_bytes: criteriaBytes.byteLength,
    role: 'Pre-execution locked E10 criteria snapshot',
  }));

  const actor = Object.freeze({
    actor_id: 'codex-task-e10-acceptance-repair-20260914',
    role: 'E10 release probe and independent recount operator',
    organization: 'zhudatuan internal',
    relationship_to_test_item: 'Implemented and operated the disposable E10 build/release fixture and the separate raw-evidence oracle; not an independent reviewer.',
  });
  const gaps = Object.freeze([
    'No stable separately managed staging release replay has been performed.',
    'No authorized production deployment or production cloud audit-log observation has been performed.',
    'The page, API, task and service observations are isolated read-only probe transports around the production authorization kernel, not full production adapters with real traffic.',
    'No reviewer independent of the E10 build, release fixture and oracle has recomputed and signed the evidence.',
  ]);
  const patch = parseProperties(await readFile(join(input.evidenceDirectory, 'shared-change.patch-id.txt'), 'utf8'));
  const evidencePath = join(input.evidenceDirectory, 'E2.0-E10-证据.json');
  const evidence = Object.freeze({
    $schema: '../../E2.0-证据.schema.json',
    schema_version: 'e2.0-evidence-v2',
    evidence_id: `E2-EVID-E10-DEV-${input.completedAt.slice(0, 10).replaceAll('-', '')}`,
    profile_version: '2.0.0',
    non_gating: true,
    claim_ids: ['E2-REL-003'],
    criteria: {
      criteria_id: input.criteria.criteria_id,
      path: criteriaRepositoryPath,
      sha256: `sha256:${sha256(criteriaBytes)}`,
      locked_at: input.criteria.locked_at,
      locked_before_execution: true,
      test_designer: actor,
    },
    test_basis_refs: [...input.criteria.authoritative_basis, ...input.criteria.implementation_basis].map((entry) => entry.path),
    execution: {
      started_at: input.startedAt,
      completed_at: input.completedAt,
      executor: actor,
      invocations: [
        {
          kind: 'COMMAND',
          exact: `npm run evidence:e10 -- --evidence-directory ${runPath}`,
          working_directory: 'repository root',
          exit_code: 0,
          stdout_artifact: repositoryPath(join(input.evidenceDirectory, 'execution-log.json')),
          stderr_artifact: null,
          sensitive_value_handling: 'No credential, customer record or external endpoint was used. Container names and temporary paths contain only random run tokens.',
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
      test_item_shas: [input.sourcePair.from_sha, input.sourcePair.to_sha],
      execution_tree_state: input.sourceControl.tree_state,
      diff_sha256: patch.diff_sha256,
    },
    configuration: {
      summary: `${input.environment.runtime.docker_image} ${input.environment.runtime.docker_image_id}; one Hosted host plus three Sovereign processes; six logical nodes; three identities; four surfaces; two full feature-matrix phases; one candidate build.`,
      digest: input.environment.configuration_digest,
      unknown_fields: [],
    },
    raw_observations: oracle.thresholds.map((entry) => ({
      observation_id: `OBS-E10-${entry.threshold_id.toUpperCase().replaceAll('_', '-')}`,
      source: 'release-feature-independent-recount.json',
      value: { expected: entry.expected, actual: entry.actual, met: entry.met },
      unit: 'count',
      captured_at: oracle.executed_at,
      notes: 'Recomputed from the eight required raw artifacts. The oracle did not consume a runner PASS/status field.',
    })),
    artifacts,
    independent_oracle: {
      oracle_id: oracle.oracle_id,
      independent_from_test_program: true,
      reads_test_program_pass: false,
      procedure: input.criteria.independent_oracle.procedure,
      exact_invocation: oracleInvocation,
      evaluator: actor,
      input_artifacts: [criteriaRepositoryPath, ...input.criteria.required_input_artifacts.map((name) => join(runPath, name))],
      computed_observations: oracle.thresholds,
    },
    anomalies: [],
    reproduction: {
      prerequisites: ['Docker Engine', 'Node.js and repository dependencies', 'clean checkout of the recorded source B SHA with source A in Git history'],
      steps: [
        `Check out ${input.sourcePair.to_sha}.`,
        `Run npm run evidence:e10 -- --evidence-directory ${runPath}.`,
        'Read release-feature-independent-recount.json and independently verify each listed artifact hash.',
      ],
      expected_raw_observations: input.criteria.prelocked_thresholds,
      cleanup: 'The runner removes all four disposable containers and its temporary artifact/pointer tree in finally blocks.',
    },
    assessment: {
      claim_outcome: oracle.claim_outcome,
      environment_assurance: oracle.environment_assurance,
      review_assurance: 'NOT REVIEWED',
      alignment_depth: 'PROJECT_CUSTOM',
      applicability_ref: null,
      rationale: oracle.claim_outcome === 'MET'
        ? 'The independent recount verified one marker-only source transition, one candidate build and identity, one Hosted host switch with zero Hosted per-node actions, staggered S-A/S-B activation with S-C retained on A, complete equality across 144 identity/node/surface/phase cells, isolated S-B rollback and detection of all three negative mutations.'
        : `The independent oracle computed ${oracle.claim_outcome}; inspect missing_items, violations and negative_probes in release-feature-independent-recount.json.`,
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
  const statementPath = join(input.evidenceDirectory, 'E2.0-E10-符合性声明.json');
  const statement = Object.freeze({
    $schema: '../../E2.0-符合性声明.schema.json',
    schema_version: 'e2.0-conformity-statement-v2',
    statement_id: `E2-STATEMENT-E10-DEV-${input.completedAt.slice(0, 10).replaceAll('-', '')}`,
    template: false,
    profile_id: 'E2.0',
    profile_version: '2.0.0',
    issued_at: input.completedAt,
    scope: `E2-REL-003 / legacy E10 at marker transition ${input.sourcePair.from_sha}→${input.sourcePair.to_sha}, disposable local Docker release simulation and read-only authorization probes only.`,
    claim_ids: ['E2-REL-003'],
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
    if (!validate(value)) throw new Error(`E10_${name.toUpperCase()}_SCHEMA_INVALID:${JSON.stringify(validate.errors)}`);
  }
}

function parseProperties(value) {
  return Object.fromEntries(value.trim().split('\n').filter(Boolean).map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
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
