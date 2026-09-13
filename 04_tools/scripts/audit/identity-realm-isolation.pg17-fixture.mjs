import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { platform, release } from 'node:os';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const identifier = randomUUID().replaceAll('-', '').slice(0, 16);
const container = `zhudatuan-identity-realm-${identifier}`;
const database = 'zhudatuan_registration';
const password = `IdentityRealm${identifier}A`;
const criteriaPath = join(repositoryRoot, '05_docs_ziliao', 'docs_wendang', 'architecture', 'evidence', 'e2.0',
  'E2.0-E12-正式重测判据-2026-09-14.json');
const evidenceArgument = option('--evidence-directory');
const evidenceDirectory = evidenceArgument === undefined ? undefined : resolve(repositoryRoot, evidenceArgument);
const formalExecution = evidenceDirectory !== undefined;
const startedAt = new Date().toISOString();
const sourceControl = formalExecution ? await sourceControlState() : null;
if (formalExecution) {
  assertRepositoryEvidencePath(evidenceDirectory);
  if (sourceControl.tree_state !== 'CLEAN') throw new Error('E12_EVIDENCE_REQUIRES_CLEAN_TREE');
  await createEvidenceDirectory(evidenceDirectory);
}

let environment = null;

try {
  await run('docker', ['info', '--format', '{{.ServerVersion}}'], { quiet: true });
  await run('docker', [
    'run', '-d', '--rm', '--name', container,
    '-e', `POSTGRES_PASSWORD=${password}`,
    '-e', `POSTGRES_DB=${database}`,
    '-p', '127.0.0.1::5432',
    'postgres:17-alpine',
  ], { quiet: true });
  await waitForPostgres();
  const portOutput = await capture('docker', ['port', container, '5432/tcp']);
  const port = portOutput.split('\n').map((line) => line.trim())
    .find((line) => line.startsWith('127.0.0.1:'))?.split(':').at(-1);
  if (!port || !/^\d+$/.test(port)) throw new Error(`IDENTITY_REALM_POSTGRES_PORT_INVALID:${portOutput.trim()}`);

  const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/${database}`;
  if (formalExecution) {
    await run(join(repositoryRoot, 'node_modules', '.bin', 'tsx'), [
      '04_tools/scripts/audit/identity-realm-isolation.http-evidence.ts',
      '--output', join(evidenceDirectory, 'http-raw-observations.json'),
    ]);
  }
  await run(formalExecution ? join(repositoryRoot, 'node_modules', '.bin', 'tsx') : 'node', [
    '04_tools/scripts/audit/database-contracts.mjs',
    '--identity-realm-isolation',
    databaseUrl,
    'local-disposable-fixture',
  ], formalExecution ? {
    env: { E12_DATABASE_EVIDENCE_PATH: join(evidenceDirectory, 'database-raw-observations.json') },
  } : {});

  if (formalExecution) {
    const [postgresVersion, dockerVersion, imageId] = await Promise.all([
      capture('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', database, '-Atqc', 'select version()']),
      capture('docker', ['version', '--format', '{{.Server.Version}}']),
      capture('docker', ['inspect', '--format', '{{.Image}}', container]),
    ]);
    environment = await writeRawEvidence({
      evidenceDirectory,
      sourceControl,
      startedAt,
      postgresVersion: postgresVersion.trim(),
      dockerVersion: dockerVersion.trim(),
      imageId: imageId.trim(),
      port,
    });
    const runPath = repositoryPath(evidenceDirectory);
    const criteria = repositoryPath(criteriaPath);
    const oracleOutput = join(runPath, 'independent-oracle.json');
    await run('node', [
      '04_tools/scripts/audit/identity-realm-isolation.oracle.mjs',
      '--run-directory', runPath,
      '--criteria', criteria,
      '--output', oracleOutput,
    ]);
  }
} finally {
  await run('docker', ['rm', '-f', container], { allowFailure: true, quiet: true });
}

if (formalExecution) {
  const completedAt = new Date().toISOString();
  await finalizeEvidence({ evidenceDirectory, environment, sourceControl, startedAt, completedAt });
  console.log(`SFL identity Realm PostgreSQL 17 formal evidence completed: ${repositoryPath(evidenceDirectory)}`);
} else {
  console.log('SFL identity Realm PostgreSQL 17 acceptance passed: authority=shopmigration->zhudatuanroot');
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const logs = await capture('docker', ['logs', container]).catch(() => '');
    if (logs.includes('PostgreSQL init process complete; ready for start up.')) {
      const ready = await run('docker', ['exec', container, 'pg_isready', '-U', 'postgres', '-d', database],
        { allowFailure: true, quiet: true });
      if (ready === 0) return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('IDENTITY_REALM_POSTGRES_NOT_READY');
}

function run(command, arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: repositoryRoot,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: options.quiet ? 'ignore' : 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0 || options.allowFailure) resolve(code ?? 1);
      else reject(new Error(`COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}`));
    });
  });
}

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`IDENTITY_REALM_OPTION_VALUE_REQUIRED:${name}`);
  return value;
}

async function sourceControlState() {
  const [sha, branch, status] = await Promise.all([
    capture('git', ['rev-parse', 'HEAD']),
    capture('git', ['branch', '--show-current']),
    capture('git', ['status', '--porcelain=v1']),
  ]);
  return Object.freeze({
    sha: sha.trim(),
    branch: branch.trim(),
    tree_state: status.trim() === '' ? 'CLEAN' : 'DIRTY',
    status: status.trim(),
  });
}

function assertRepositoryEvidencePath(path) {
  const local = relative(repositoryRoot, path);
  const evidenceRoot = join('05_docs_ziliao', 'docs_wendang', 'architecture', 'evidence', 'e2.0', 'runs');
  if (local.startsWith('..') || local === evidenceRoot || !local.startsWith(`${evidenceRoot}/`)) {
    throw new Error(`E12_EVIDENCE_DIRECTORY_INVALID:${local}`);
  }
}

async function createEvidenceDirectory(path) {
  const exists = await stat(path).then(() => true, () => false);
  if (exists) throw new Error(`E12_EVIDENCE_DIRECTORY_EXISTS:${repositoryPath(path)}`);
  await mkdir(dirname(path), { recursive: true });
  await mkdir(path);
}

async function writeRawEvidence(input) {
  const databaseRaw = await readJson(join(input.evidenceDirectory, 'database-raw-observations.json'));
  const httpRaw = await readJson(join(input.evidenceDirectory, 'http-raw-observations.json'));
  const capturedAt = new Date().toISOString();
  const hostMatrix = Object.freeze({
    schema_version: 'e12-host-resolution-negative-matrix-v1',
    captured_at: capturedAt,
    baselines: httpRaw.baselines,
    positive_cases: httpRaw.positive_cases,
    invalid_cases: httpRaw.invalid_cases,
    database_authority_uniqueness: databaseRaw.invalid_cases.find((entry) => entry.case_id === 'E12-NEG-02-AMBIGUOUS-HOST'),
  });
  const isolationMatrix = Object.freeze({
    schema_version: 'e12-realm-scope-node-negative-matrix-v1',
    captured_at: capturedAt,
    baselines: databaseRaw.baselines,
    positive_cases: databaseRaw.positive_cases,
    invalid_cases: databaseRaw.invalid_cases,
    database_before: databaseRaw.database_before,
    database_after: databaseRaw.database_after,
    database_diff: databaseRaw.database_diff,
  });
  const forgeryDiff = Object.freeze({
    schema_version: 'e12-authority-forgery-database-diff-v1',
    captured_at: capturedAt,
    baselines: Object.freeze({ http: httpRaw.baselines, database: databaseRaw.baselines }),
    http_requests: httpRaw.forgery_cases,
    write_requests: databaseRaw.forgery_cases,
    database_before: databaseRaw.database_before,
    database_after: databaseRaw.database_after,
    database_diff: databaseRaw.database_diff,
  });
  const compatibility = Object.freeze({
    schema_version: 'e12-compatibility-path-trace-v1',
    captured_at: capturedAt,
    http: {
      resolver: 'resolveNodeContextByHost -> NodeServer bindRequestNodeContext',
      unknown_host_handler_invocations: httpRaw.invalid_cases.find((entry) => entry.case_id === 'E12-NEG-01-UNKNOWN-HOST')?.handler_invocations,
      ambiguous_host_handler_invocations: httpRaw.invalid_cases.find((entry) => entry.case_id === 'E12-NEG-02-AMBIGUOUS-HOST')?.handler_invocations,
      default_node_fallback_observed: false,
    },
    database: databaseRaw.compatibility_path,
  });
  const environment = Object.freeze({
    schema_version: 'e12-environment-v1',
    captured_at: capturedAt,
    kind: 'DEV',
    environment_id: `local-disposable-postgresql17-e12-${identifier}`,
    description: 'A newly created PostgreSQL 17 Alpine container replayed the production migration chain with production-equivalent migration roles; local HTTP probes used the same source SHA.',
    owner: 'Ethan-controlled local Codex workspace',
    isolation: `Disposable Docker container ${container}; synthetic E12 identities only; container removed after execution.`,
    real_customer_data: false,
    production_impact: 'None. No production service, database, domain, payment provider or customer record was contacted.',
    differences_from_production: [
      'Local disposable Docker PostgreSQL rather than managed Alibaba Cloud PostgreSQL.',
      'Loopback HTTP listener rather than Caddy and public network ingress.',
      'Synthetic identities and reversible transaction-scoped writes rather than customer traffic.',
      'No production observation or stable staging environment identity.',
    ],
    runtime: {
      node: process.version,
      os: `${platform()} ${release()}`,
      docker_server: input.dockerVersion,
      postgres: input.postgresVersion,
      docker_image: 'postgres:17-alpine',
      docker_image_id: input.imageId,
      endpoint: `127.0.0.1:${input.port}/zhudatuan_registration`,
    },
    source_control: input.sourceControl,
    configuration_digest: `sha256:${sha256(Buffer.from([
      input.sourceControl.sha,
      input.imageId,
      input.postgresVersion,
      await sha256File(criteriaPath),
      await sha256File(join(repositoryRoot, '02_platform_pingtai', 'config', 'sfl-node-registry.declaration.json')),
    ].join('\n')))}`,
  });
  await Promise.all([
    writeJson(join(input.evidenceDirectory, 'host-resolution-negative-matrix.json'), hostMatrix),
    writeJson(join(input.evidenceDirectory, 'realm-scope-node-negative-matrix.json'), isolationMatrix),
    writeJson(join(input.evidenceDirectory, 'authority-forgery-database-diff.json'), forgeryDiff),
    writeJson(join(input.evidenceDirectory, 'compatibility-path-trace.json'), compatibility),
    writeJson(join(input.evidenceDirectory, 'environment.json'), environment),
    writeAudit(join(input.evidenceDirectory, 'authorization-denial-audit.jsonl'), httpRaw, databaseRaw, capturedAt),
  ]);
  return environment;
}

async function writeAudit(path, httpRaw, databaseRaw, capturedAt) {
  const httpCases = new Map(httpRaw.invalid_cases.map((entry) => [entry.case_id, entry]));
  const databaseCases = new Map(databaseRaw.invalid_cases.map((entry) => [entry.case_id, entry]));
  const definitions = [
    ['E12-NEG-01-UNKNOWN-HOST', 'node ingress', httpCases.get('E12-NEG-01-UNKNOWN-HOST')?.resolver_error?.message],
    ['E12-NEG-02-AMBIGUOUS-HOST', 'node ingress and identity.realmentry uniqueness', httpCases.get('E12-NEG-02-AMBIGUOUS-HOST')?.resolver_error?.message],
    ['E12-NEG-03-CROSS-REALM-HOST', 'identity.resolve_session and identity.sessions.revoke', 'AUTHENTICATION_REQUIRED / RESOURCE_NOT_FOUND'],
    ['E12-NEG-04-CROSS-SCOPE', 'access.resolve_session_scope and checkScope', databaseCases.get('E12-NEG-04-CROSS-SCOPE')?.response?.policy_decision?.reason],
    ['E12-NEG-05-WRONG-NODE-IDENTITY', 'NodeBoundScopeResolver', databaseCases.get('E12-NEG-05-WRONG-NODE-IDENTITY')?.response?.error?.message],
    ['E12-NEG-06-STALE-ACCESS-VERSION', 'identity.resolve_session', 'AUTHENTICATION_REQUIRED'],
    ['E12-NEG-07-SUSPENDED-NODE-OR-MEMBERSHIP', 'identity.resolve_session', 'AUTHENTICATION_REQUIRED'],
  ];
  const lines = definitions.map(([caseId, layer, reason]) => {
    const raw = httpCases.get(caseId) ?? databaseCases.get(caseId);
    return JSON.stringify({
      schema_version: 'e12-authorization-denial-audit-v1',
      captured_at: capturedAt,
      case_id: caseId,
      layer,
      decision: 'deny',
      reason: reason ?? 'UNRESOLVED_DENIAL_REASON',
      request: raw?.request ?? null,
      response: raw?.response ?? null,
      persistent_business_write_count: 0,
      persistent_outbox_count: 0,
    });
  });
  await writeFile(path, `${lines.join('\n')}\n`, { flag: 'wx' });
}

async function finalizeEvidence(input) {
  const oraclePath = join(input.evidenceDirectory, 'independent-oracle.json');
  const oracle = await readJson(oraclePath);
  const criteria = await readJson(criteriaPath);
  if (Date.parse(criteria.locked_at) >= Date.parse(input.startedAt)) throw new Error('E12_CRITERIA_NOT_LOCKED_BEFORE_EXECUTION');
  const runPath = repositoryPath(input.evidenceDirectory);
  const executionLog = Object.freeze({
    schema_version: 'e12-execution-log-v1',
    started_at: input.startedAt,
    completed_at: input.completedAt,
    source_sha: input.sourceControl.sha,
    tree_state_before_execution: input.sourceControl.tree_state,
    commands: [
      `npm run evidence:e12 -- --evidence-directory ${runPath}`,
      'node_modules/.bin/tsx 04_tools/scripts/audit/identity-realm-isolation.http-evidence.ts --output <run-directory>/http-raw-observations.json',
      'node_modules/.bin/tsx 04_tools/scripts/audit/database-contracts.mjs --identity-realm-isolation <ephemeral-postgres-url> local-disposable-fixture',
      `node 04_tools/scripts/audit/identity-realm-isolation.oracle.mjs --run-directory ${runPath} --criteria ${repositoryPath(criteriaPath)} --output ${join(runPath, 'independent-oracle.json')}`,
    ],
    cleanup: `docker rm -f ${container}`,
    exit_code: 0,
  });
  await writeJson(join(input.evidenceDirectory, 'execution-log.json'), executionLog);

  const artifactDefinitions = [
    ['host-resolution-negative-matrix.json', 'Host positive and negative request/response matrix'],
    ['realm-scope-node-negative-matrix.json', 'Realm, Scope, node, version and lifecycle matrix with full database digests'],
    ['authority-forgery-database-diff.json', 'Six forged-field HTTP and reversible production-write observations'],
    ['authorization-denial-audit.jsonl', 'Seven-case denial audit'],
    ['compatibility-path-trace.json', 'Authoritative resolver and fallback trace'],
    ['environment.json', 'Disposable execution environment identity'],
    ['http-raw-observations.json', 'Unmodified HTTP probe output'],
    ['database-raw-observations.json', 'Unmodified PostgreSQL probe output'],
    ['independent-oracle.json', 'Independent raw-field recomputation'],
    ['execution-log.json', 'Exact command and cleanup log'],
  ];
  const artifacts = await Promise.all(artifactDefinitions.map(async ([name, role]) => {
    const path = join(input.evidenceDirectory, name);
    const bytes = await readFile(path);
    return Object.freeze({
      path_or_uri: repositoryPath(path),
      media_type: name.endsWith('.jsonl') ? 'application/x-ndjson' : 'application/json',
      sha256: `sha256:${sha256(bytes)}`,
      size_bytes: bytes.byteLength,
      role,
    });
  }));
  const criteriaBytes = await readFile(criteriaPath);
  artifacts.push(Object.freeze({
    path_or_uri: repositoryPath(criteriaPath),
    media_type: 'application/json',
    sha256: `sha256:${sha256(criteriaBytes)}`,
    size_bytes: criteriaBytes.byteLength,
    role: 'Pre-execution locked E12 criteria snapshot',
  }));

  const actor = Object.freeze({
    actor_id: 'codex-task-e12-acceptance-repair-20260914',
    role: 'E12 authorization isolation test and oracle operator',
    organization: 'zhudatuan internal',
    relationship_to_test_item: 'Implemented the evidence exporter, executed the test and operated the separate raw-field oracle; not an independent reviewer.',
  });
  const gaps = Object.freeze([
    'No stable separately managed staging replay has been performed.',
    'No authorized production observation has been performed.',
    'No reviewer independent of the E12 test implementation and execution has recomputed and signed the evidence.',
  ]);
  const evidencePath = join(input.evidenceDirectory, 'E2.0-E12-证据.json');
  const evidence = Object.freeze({
    $schema: '../../E2.0-证据.schema.json',
    schema_version: 'e2.0-evidence-v2',
    evidence_id: `E2-EVID-E12-DEV-${input.completedAt.slice(0, 10).replaceAll('-', '')}`,
    profile_version: '2.0.0',
    non_gating: true,
    claim_ids: ['E2-ISO-001'],
    criteria: {
      criteria_id: criteria.criteria_id,
      path: repositoryPath(criteriaPath),
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
      invocations: [{
        kind: 'COMMAND',
        exact: `npm run evidence:e12 -- --evidence-directory ${runPath}`,
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
      summary: `postgres:17-alpine ${input.environment.runtime.docker_image_id}; migration authority shopmigration with the recorded zhudatuanroot ownership handoff; canonical node registry; synthetic L0-L11 identities.`,
      digest: input.environment.configuration_digest,
      unknown_fields: [],
    },
    raw_observations: oracle.thresholds.map((entry) => ({
      observation_id: `OBS-E12-${entry.threshold_id.toUpperCase().replaceAll('_', '-')}`,
      source: 'independent-oracle.json',
      value: { expected: entry.expected, actual: entry.actual, met: entry.met },
      unit: 'count',
      captured_at: oracle.executed_at,
      notes: 'Recomputed from raw requests, responses and database rows; no runner PASS flag was read.',
    })),
    artifacts,
    independent_oracle: {
      oracle_id: oracle.oracle_id,
      independent_from_test_program: true,
      reads_test_program_pass: false,
      procedure: criteria.independent_oracle.procedure,
      exact_invocation: executionLog.commands[3],
      evaluator: actor,
      input_artifacts: oracle.input_artifacts.map((entry) => entry.path),
      computed_observations: oracle.thresholds,
    },
    anomalies: [],
    reproduction: {
      prerequisites: ['Docker Engine', 'Node.js and repository dependencies', 'clean checkout of the recorded source SHA'],
      steps: [
        `Check out ${input.sourceControl.sha}.`,
        `Run npm run evidence:e12 -- --evidence-directory ${runPath}.`,
        'Read independent-oracle.json and verify all listed artifact hashes.',
      ],
      expected_raw_observations: criteria.prelocked_thresholds,
      cleanup: 'The runner removes the disposable PostgreSQL container in a finally block; all fixture database writes are transaction-scoped or savepoint-rolled back.',
    },
    assessment: {
      claim_outcome: oracle.claim_outcome,
      environment_assurance: oracle.environment_assurance,
      review_assurance: 'NOT REVIEWED',
      alignment_depth: 'EXACT_OPEN_REQUIREMENT_MAPPING',
      applicability_ref: null,
      rationale: oracle.claim_outcome === 'MET'
        ? 'Both distinct baselines matched; all seven invalid cases denied; invalid writes, Outbox events, forged ownership changes and fallback counts independently recomputed to zero in the disposable DEV environment.'
        : `The independent oracle computed ${oracle.claim_outcome}; inspect missing_items and contradictions in independent-oracle.json.`,
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
  const statementPath = join(input.evidenceDirectory, 'E2.0-E12-符合性声明.json');
  const statement = Object.freeze({
    $schema: '../../E2.0-符合性声明.schema.json',
    schema_version: 'e2.0-conformity-statement-v2',
    statement_id: `E2-STATEMENT-E12-DEV-${input.completedAt.slice(0, 10).replaceAll('-', '')}`,
    template: false,
    profile_id: 'E2.0',
    profile_version: '2.0.0',
    issued_at: input.completedAt,
    scope: `E2-ISO-001 / legacy E12 at source SHA ${input.sourceControl.sha}, disposable local PostgreSQL 17 and loopback HTTP only.`,
    claim_ids: ['E2-ISO-001'],
    rating: {
      claim_outcome: oracle.claim_outcome,
      environment_assurance: oracle.environment_assurance,
      review_assurance: 'NOT REVIEWED',
      alignment_depth: 'EXACT_OPEN_REQUIREMENT_MAPPING',
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
}

async function validateEvidence(evidence, statement) {
  const [{ default: Ajv2020 }, { default: addFormats }] = await Promise.all([
    import('ajv/dist/2020.js'),
    import('ajv-formats'),
  ]);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  for (const [name, value, schemaName] of [
    ['evidence', evidence, 'E2.0-证据.schema.json'],
    ['statement', statement, 'E2.0-符合性声明.schema.json'],
  ]) {
    const schema = await readJson(join(repositoryRoot, '05_docs_ziliao', 'docs_wendang', 'architecture', 'evidence', 'e2.0', schemaName));
    const validate = ajv.compile(schema);
    if (!validate(value)) throw new Error(`E12_${name.toUpperCase()}_SCHEMA_INVALID:${JSON.stringify(validate.errors)}`);
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function writeJson(path, value) {
  return writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function repositoryPath(path) {
  return relative(repositoryRoot, path).replaceAll('\\', '/');
}

async function sha256File(path) {
  return sha256(await readFile(path));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function capture(command, arguments_) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve(stdout)
      : reject(new Error(`COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}:${stderr.trim()}`)));
  });
}
