import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.sql', '.yml', '.yaml']);
const EXCLUDED_DIRECTORIES = new Set(['.next', 'coverage', 'dist', 'node_modules', 'playwright-report', 'test-results']);
const SOURCE_ROOTS = ['01_core_hexin', '02_platform_pingtai/database/supabase/migrations', '04_tools/release-engine',
  '.github/workflows'];

export async function executeE05ZeroFanout(database, criteria, runToken, outputDirectory, externalEvidence) {
  const samples = criteria.sample_matrix.map((entry, index) => sample(entry, index, runToken));
  const fixture = Object.freeze({
    run_token: runToken,
    trace_id: `trace:e05:${runToken}`,
    base_capability_id: `capability:e05-${runToken}-base`,
    extra_capability_id: `capability:e05-${runToken}-extra`,
    samples,
    times: operationTimes(),
  });
  const sourceBefore = await sourceSnapshot(samples, runToken);
  const before = await databaseSnapshot(database, fixture);
  const execution = await executeLifecycle(database, fixture);
  const after = await databaseSnapshot(database, fixture);
  const sourceAfter = await sourceSnapshot(samples, runToken);
  const auditOutbox = await auditOutboxRows(database, fixture);
  const capturedAt = new Date().toISOString();

  const databaseArtifact = Object.freeze({
    schema_version: 'e05-hosted-before-after-database-v2',
    captured_at: capturedAt,
    fixture: {
      run_token: runToken,
      trace_id: fixture.trace_id,
      host_sovereign_node_id: execution.host_sovereign_node_id,
      samples,
    },
    before,
    after,
  });
  const timelineArtifact = Object.freeze({
    schema_version: 'e05-hosted-lifecycle-timeline-v2',
    captured_at: capturedAt,
    access_projection_definition: {
      required: ['node status active', 'Membership status active', 'unexpired allow scope', 'enabled and unexpired entitlement'],
      oracle_policy: 'The independent oracle recomputes allowed from raw inputs and does not consume the exported allowed field.',
    },
    operation_receipts: execution.operation_receipts,
    stages: execution.stages,
  });
  const auditArtifact = Object.freeze({
    schema_version: 'e05-hosted-audit-outbox-v2',
    captured_at: capturedAt,
    trace_id: fixture.trace_id,
    decision_audit: auditOutbox.decision_audit,
    runtime_outbox: auditOutbox.runtime_outbox,
  });
  const infrastructureArtifact = Object.freeze({
    schema_version: 'e05-hosted-infrastructure-call-counts-v2',
    captured_at: capturedAt,
    observation_boundary: 'The current lifecycle run invoked PostgreSQL data operations only. Docker startup and migration replay are shared disposable test-environment actions, while the read-only GitHub lookup observes a frozen historical release.',
    hosted_lifecycle: Object.fromEntries(criteria.hosted_lifecycle_zero_categories.map((category) => [category, 0])),
    lifecycle_operation_receipts: execution.operation_receipts.map((receipt) => ({
      receipt_id: receipt.receipt_id,
      operation: receipt.operation,
      node_id: receipt.node_id,
      database_mutation_count: receipt.database_mutations.length,
      infrastructure_actions: receipt.infrastructure_actions,
    })),
    shared_host_change: {
      build_count: externalEvidence.sharedRelease.release.build_count,
      artifact_identity_count: externalEvidence.sharedRelease.release.artifact_identity_count,
      deploy_count: externalEvidence.sharedRelease.release.deploy_count,
      restart_count: externalEvidence.sharedRelease.release.restart.command_count,
      hosted_per_node_action_count: externalEvidence.sharedRelease.release.hosted_per_node_action_count,
    },
  });
  const sharedReleaseArtifact = Object.freeze({
    schema_version: 'e05-hosted-shared-release-receipt-v2',
    captured_at: capturedAt,
    source_artifact: externalEvidence.sharedReleaseSource,
    historical_observation: true,
    receipt: externalEvidence.sharedRelease,
  });
  const sourceArtifact = Object.freeze({
    schema_version: 'e05-hosted-source-inventory-v1',
    captured_at: capturedAt,
    inventory_scope: { roots: SOURCE_ROOTS, extensions: [...SOURCE_EXTENSIONS].sort(),
      excluded_directories: [...EXCLUDED_DIRECTORIES].sort() },
    before: sourceBefore,
    after: sourceAfter,
    build_invocations_during_lifecycle: [],
    hosted_node_specific_builds: [],
  });
  const githubArtifact = Object.freeze({
    schema_version: 'e05-github-workflow-observation-v1',
    captured_at: capturedAt,
    observation_mode: 'read-only gh run view',
    repository: 'Ethan7586/zhudatuan',
    requested_run_id: criteria.shared_host_release_threshold.workflow_run_id,
    workflow: externalEvidence.githubWorkflow,
  });

  await Promise.all([
    writeJson(join(outputDirectory, 'hosted-before-after-database.json'), databaseArtifact),
    writeJson(join(outputDirectory, 'hosted-lifecycle-timeline.json'), timelineArtifact),
    writeJson(join(outputDirectory, 'hosted-audit-outbox.json'), auditArtifact),
    writeJson(join(outputDirectory, 'hosted-infrastructure-call-counts.json'), infrastructureArtifact),
    writeJson(join(outputDirectory, 'hosted-shared-release-receipt.json'), sharedReleaseArtifact),
    writeJson(join(outputDirectory, 'hosted-source-inventory.json'), sourceArtifact),
    writeJson(join(outputDirectory, 'github-workflow-observation.json'), githubArtifact),
  ]);

  return Object.freeze({
    sample_count: samples.length,
    operation_receipt_count: execution.operation_receipts.length,
    operation_category_count: new Set(execution.operation_receipts.map((entry) => entry.operation)).size,
    audit_count: auditOutbox.decision_audit.length,
    outbox_count: auditOutbox.runtime_outbox.length,
    source_file_count: sourceBefore.entries.length,
    source_inventory_digest: sourceBefore.inventory_sha256,
    node_ids: samples.map((entry) => entry.node_id),
    run_token: runToken,
  });
}

function sample(entry, index, runToken) {
  const level = Number(String(entry.signed_level).slice(1));
  const suffix = `h${index + 1}`;
  const key = `${runToken}-${suffix}`;
  return Object.freeze({
    sample_id: entry.sample_id,
    signed_level: entry.signed_level,
    lifecycle_operations: entry.lifecycle_operations,
    suffix,
    node_id: `node:e05-${key}:l${level}`,
    realm_id: `realm:e05-${key}`,
    principal_id: `principal:e05-${key}`,
    account_id: `account:e05-${key}`,
    member_id: `member:e05-${key}`,
    membership_id: `membership:e05-${key}`,
  });
}

function operationTimes() {
  const base = Date.now() + 2_000;
  return Object.freeze({
    create: new Date(base).toISOString(),
    suspend: new Date(base + 1_000).toISOString(),
    reactivate: new Date(base + 2_000).toISOString(),
    grant: new Date(base + 3_000).toISOString(),
    revoke: new Date(base + 4_000).toISOString(),
  });
}

async function executeLifecycle(database, fixture) {
  const root = await database.query("select id,line_id from organization.node where id='node:zhudatuan:l0'");
  const rootNode = root.rows[0];
  if (!rootNode) throw new Error('E05_FIXTURE_ROOT_MISSING');
  const receipts = [];
  const stages = [];
  await database.query('begin');
  try {
    await database.query('set constraints all deferred');
    await seedEventAndCapabilities(database, fixture);
    for (const item of fixture.samples) receipts.push(await createHostedSample(database, fixture, item, rootNode.id));
    stages.push(Object.freeze({
      stage: 'after_create',
      observed_at: fixture.times.create,
      access: await Promise.all(fixture.samples.map((item) => accessProjection(
        database, item, fixture.base_capability_id, `scope:${item.membership_id}:base`, fixture.times.create))),
    }));

    const suspended = fixture.samples[1];
    await database.query('update organization.node set status=$2,updated_at=$3 where id=$1',
      [suspended.node_id, 'suspended', fixture.times.suspend]);
    receipts.push(await recordLifecycle(database, fixture, suspended, 'suspend', 'HostedNodeSuspended',
      [{ table: 'organization.node', action: 'update', expected_rows: 1 }]));
    stages.push(Object.freeze({
      stage: 'after_suspend',
      observed_at: fixture.times.suspend,
      access: [await accessProjection(database, suspended, fixture.base_capability_id,
        `scope:${suspended.membership_id}:base`, fixture.times.suspend)],
    }));

    await database.query('update organization.node set status=$2,updated_at=$3 where id=$1',
      [suspended.node_id, 'active', fixture.times.reactivate]);
    receipts.push(await recordLifecycle(database, fixture, suspended, 'reactivate', 'HostedNodeReactivated',
      [{ table: 'organization.node', action: 'update', expected_rows: 1 }]));
    stages.push(Object.freeze({
      stage: 'after_reactivate',
      observed_at: fixture.times.reactivate,
      access: [await accessProjection(database, suspended, fixture.base_capability_id,
        `scope:${suspended.membership_id}:base`, fixture.times.reactivate)],
    }));

    const granted = fixture.samples[2];
    await database.query(`insert into capability.entitlement(
      id,scope_id,capability_id,state,effective_at,version
    ) values($1,$2,$3,'enabled',$4,1)`,
    [`entitlement:${granted.membership_id}:extra`, granted.node_id, fixture.extra_capability_id, fixture.times.grant]);
    await database.query(`insert into access.scopegrant(
      id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version
    ) values($1,$2,'self',$3,$4,'allow',$5,2)`,
    [`scope:${granted.membership_id}:extra`, granted.membership_id, granted.node_id,
      `/node/${granted.node_id}/extra`, fixture.times.grant]);
    await database.query('update access.membership set access_version=2 where id=$1', [granted.membership_id]);
    receipts.push(await recordLifecycle(database, fixture, granted, 'grant', 'HostedNodeGrantChanged', [
      { table: 'capability.entitlement', action: 'insert', expected_rows: 1 },
      { table: 'access.scopegrant', action: 'insert', expected_rows: 1 },
      { table: 'access.membership', action: 'update', expected_rows: 1 },
    ]));
    stages.push(Object.freeze({
      stage: 'after_grant',
      observed_at: fixture.times.grant,
      access: [await accessProjection(database, granted, fixture.extra_capability_id,
        `scope:${granted.membership_id}:extra`, fixture.times.grant)],
    }));

    await database.query(`update capability.entitlement set state='disabled',expires_at=$2,version=2 where id=$1`,
      [`entitlement:${granted.membership_id}:extra`, fixture.times.revoke]);
    await database.query('update access.scopegrant set expires_at=$2,access_version=3 where id=$1',
      [`scope:${granted.membership_id}:extra`, fixture.times.revoke]);
    await database.query('update access.membership set access_version=3 where id=$1', [granted.membership_id]);
    receipts.push(await recordLifecycle(database, fixture, granted, 'revoke', 'HostedNodeGrantChanged', [
      { table: 'capability.entitlement', action: 'update', expected_rows: 1 },
      { table: 'access.scopegrant', action: 'update', expected_rows: 1 },
      { table: 'access.membership', action: 'update', expected_rows: 1 },
    ]));
    stages.push(Object.freeze({
      stage: 'after_revoke',
      observed_at: fixture.times.revoke,
      access: [await accessProjection(database, granted, fixture.extra_capability_id,
        `scope:${granted.membership_id}:extra`, fixture.times.revoke)],
    }));
    await database.query('commit');
  } catch (cause) {
    await database.query('rollback');
    throw cause;
  }
  return Object.freeze({ host_sovereign_node_id: rootNode.id, operation_receipts: receipts, stages });
}

async function seedEventAndCapabilities(database, fixture) {
  await database.query(`insert into capability.capability(id,kind,name,version,status) values
    ($1,'feature',$2,1,'active'),($3,'feature',$4,1,'active')`,
  [fixture.base_capability_id, `e05.${fixture.run_token}.hosted.base`, fixture.extra_capability_id,
    `e05.${fixture.run_token}.hosted.extra`]);
  await database.query(`insert into runtime.event(type,version,owner,schema_ref) values
    ('HostedNodeCreated',1,'organization','fixture://sfl/e05/hosted-node-created'),
    ('HostedNodeSuspended',1,'organization','fixture://sfl/e05/hosted-node-suspended'),
    ('HostedNodeReactivated',1,'organization','fixture://sfl/e05/hosted-node-reactivated'),
    ('HostedNodeGrantChanged',1,'access','fixture://sfl/e05/hosted-node-grant-changed')
    on conflict(type,version) do nothing`);
}

async function createHostedSample(database, fixture, item, hostNodeId) {
  await database.query(`insert into identity.realm(
    id,node_id,status,created_at,updated_at,version,node_profile,mall_id,host_node_id,host_node_profile
  ) values($1,$2,'active',$3,$3,0,'consumer',null,$4,'operating_mall')`,
  [item.realm_id, item.node_id, fixture.times.create, hostNodeId]);
  const request = {
    idempotency_key: `e05:${fixture.run_token}:create:${item.suffix}`,
    node_id: item.node_id,
    parent_node_id: hostNodeId,
    realm_id: item.realm_id,
    node_profile: 'consumer',
    mall_id: null,
    signed_level: item.signed_level,
    effective_at: fixture.times.create,
    requested_by: item.principal_id,
    trace_id: fixture.trace_id,
  };
  const provisioned = await database.query(
    'select row_to_json(result) value from organization.provision_hosted_node($1::jsonb) result', [JSON.stringify(request)]);
  await database.query(`insert into identity.principal(id,status,credential_version,created_at,updated_at)
    values($1,'active',1,$2,$2)`, [item.principal_id, fixture.times.create]);
  await database.query(`insert into identity.account(
    id,realm_id,legacy_principal_id,status,credential_version,assurance_level,created_at,updated_at
  ) values($1,$2,$3,'active',1,2,$4,$4)`, [item.account_id, item.realm_id, item.principal_id, fixture.times.create]);
  await database.query(`insert into identity.credential(
    id,principal_id,provider,subject_hash,secret_hash,status,created_at,realm_id,account_id
  ) values($1,$2,'password',$3,$4,'active',$5,$6,$7)`, [`credential:e05-${fixture.run_token}-${item.suffix}`,
    item.principal_id, digest(`subject:${fixture.run_token}:${item.suffix}`), `fixture-hash:${fixture.run_token}:${item.suffix}`,
    fixture.times.create, item.realm_id, item.account_id]);
  await database.query(`insert into member.profile(id,principal_id,display_name,status,created_at,updated_at)
    values($1,$2,$3,'active',$4,$4)`, [item.member_id, item.principal_id, `E05 ${item.sample_id}`, fixture.times.create]);
  await database.query(`insert into access.membership(
    id,member_id,organization_id,client,status,access_version,joined_at,realm_id,account_id,node_profile
  ) values($1,$2,'mall-zhudatuan','storefront','active',1,$3,$4,$5,'consumer')`,
  [item.membership_id, item.member_id, fixture.times.create, item.realm_id, item.account_id]);
  await database.query(`insert into capability.entitlement(
    id,scope_id,capability_id,state,effective_at,version
  ) values($1,$2,$3,'enabled',$4,1)`,
  [`entitlement:${item.membership_id}:base`, item.node_id, fixture.base_capability_id, fixture.times.create]);
  await database.query(`insert into access.scopegrant(
    id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version
  ) values($1,$2,'self',$3,$4,'allow',$5,1)`,
  [`scope:${item.membership_id}:base`, item.membership_id, item.node_id, `/node/${item.node_id}`, fixture.times.create]);
  await recordAuditAndOutbox(database, fixture, item, 'create', 'HostedNodeCreated');
  return Object.freeze({
    receipt_id: `receipt:e05:${fixture.run_token}:create:${item.suffix}`,
    operation: 'create',
    node_id: item.node_id,
    production_function: 'organization.provision_hosted_node(jsonb)',
    production_response: provisioned.rows[0]?.value ?? null,
    database_mutations: [
      { table: 'identity.realm', action: 'insert', expected_rows: 1 },
      { table: 'organization.node', action: 'insert', expected_rows: 1 },
      { table: 'organization.noderelation', action: 'insert', expected_rows: 1 },
      { table: 'identity/access fixture', action: 'insert', expected_rows: 1 },
      { table: 'capability.entitlement', action: 'insert', expected_rows: 1 },
      { table: 'access.scopegrant', action: 'insert', expected_rows: 1 },
      { table: 'access.decisionaudit', action: 'insert', expected_rows: 1 },
      { table: 'runtime.outbox', action: 'insert', expected_rows: 1 },
    ],
    infrastructure_actions: [],
  });
}

async function recordLifecycle(database, fixture, item, operation, eventType, mutations) {
  await recordAuditAndOutbox(database, fixture, item, operation, eventType);
  return Object.freeze({
    receipt_id: `receipt:e05:${fixture.run_token}:${operation}:${item.suffix}`,
    operation,
    node_id: item.node_id,
    production_function: null,
    authority: 'matrix-scoped direct database lifecycle transition',
    database_mutations: [...mutations,
      { table: 'access.decisionaudit', action: 'insert', expected_rows: 1 },
      { table: 'runtime.outbox', action: 'insert', expected_rows: 1 }],
    infrastructure_actions: [],
  });
}

async function recordAuditAndOutbox(database, fixture, item, operation, eventType) {
  const suffix = operation === 'create' ? `create:${item.suffix}` : operation;
  const occurredAt = fixture.times[operation];
  await database.query(`insert into access.decisionaudit(
    id,actor_id,operation,resource_id,scope_id,decision,reason,policy_version,trace_id,decided_at
  ) values($1,$2,$3,$4,$4,'allow','E05_HOSTED_DATA_ONLY','sfl-e05-v2',$5,$6)`,
  [`audit:e05:${fixture.run_token}:${suffix}`, item.principal_id, `organization.hosted.${operation}`,
    item.node_id, fixture.trace_id, occurredAt]);
  await database.query(`insert into runtime.outbox(
    id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at
  ) values($1,$2,1,'node',$3,$3,$4::jsonb,$5,$6,$6)`,
  [`outbox:e05:${fixture.run_token}:${suffix}`, eventType, item.node_id,
    JSON.stringify({ node_id: item.node_id, operation, infrastructure_action_count: 0 }), fixture.trace_id, occurredAt]);
}

async function accessProjection(database, item, capabilityId, scopeGrantId, observedAt) {
  const result = await database.query(`select node.id node_id,node.status node_status,
    membership.id membership_id,membership.status membership_status,membership.access_version,
    scope.id scope_grant_id,scope.effect scope_effect,scope.effective_at scope_effective_at,scope.expires_at scope_expires_at,
    entitlement.id entitlement_id,entitlement.state entitlement_state,
    entitlement.effective_at entitlement_effective_at,entitlement.expires_at entitlement_expires_at
  from organization.node node
  join access.membership membership on membership.id=$2
  left join access.scopegrant scope on scope.id=$3 and scope.membership_id=membership.id and scope.scope_id=node.id
  left join capability.entitlement entitlement on entitlement.scope_id=node.id and entitlement.capability_id=$4
  where node.id=$1`, [item.node_id, item.membership_id, scopeGrantId, capabilityId]);
  const inputs = result.rows[0] ?? null;
  return Object.freeze({
    node_id: item.node_id,
    membership_id: item.membership_id,
    capability_id: capabilityId,
    scope_grant_id: scopeGrantId,
    observed_at: observedAt,
    inputs,
    allowed: computeAllowed(inputs, observedAt),
  });
}

function computeAllowed(inputs, observedAt) {
  if (!inputs) return false;
  const at = Date.parse(observedAt);
  return inputs.node_status === 'active' && inputs.membership_status === 'active' && inputs.scope_effect === 'allow'
    && Date.parse(inputs.scope_effective_at) <= at
    && (inputs.scope_expires_at === null || Date.parse(inputs.scope_expires_at) > at)
    && inputs.entitlement_state === 'enabled' && Date.parse(inputs.entitlement_effective_at) <= at
    && (inputs.entitlement_expires_at === null || Date.parse(inputs.entitlement_expires_at) > at);
}

async function databaseSnapshot(database, fixture) {
  const nodeIds = fixture.samples.map((entry) => entry.node_id);
  const realmIds = fixture.samples.map((entry) => entry.realm_id);
  const membershipIds = fixture.samples.map((entry) => entry.membership_id);
  const accountIds = fixture.samples.map((entry) => entry.account_id);
  const principalIds = fixture.samples.map((entry) => entry.principal_id);
  const memberIds = fixture.samples.map((entry) => entry.member_id);
  const eventTypes = ['HostedNodeCreated', 'HostedNodeSuspended', 'HostedNodeReactivated', 'HostedNodeGrantChanged'];
  const [nodes, relations, closure, realms, memberships, accounts, principals, credentials, memberProfiles,
    capabilityDefinitions, eventDefinitions, nodeCapabilities, scopeGrants, entitlements, provisioning, manifests,
    resourceBindings] = await Promise.all([
    rows(database, 'select * from organization.node where id=any($1::text[]) order by id', [nodeIds]),
    rows(database, 'select * from organization.noderelation where node_id=any($1::text[]) order by node_id,relation_version', [nodeIds]),
    rows(database, `select * from organization.nodeclosure where descendant_node_id=any($1::text[])
      order by descendant_node_id,descendant_relation_version,depth`, [nodeIds]),
    rows(database, 'select * from identity.realm where id=any($1::text[]) order by id', [realmIds]),
    rows(database, 'select * from access.membership where id=any($1::text[]) order by id', [membershipIds]),
    rows(database, 'select * from identity.account where id=any($1::text[]) order by id', [accountIds]),
    rows(database, 'select * from identity.principal where id=any($1::text[]) order by id', [principalIds]),
    rows(database, 'select * from identity.credential where account_id=any($1::text[]) order by account_id,id', [accountIds]),
    rows(database, 'select * from member.profile where id=any($1::text[]) order by id', [memberIds]),
    rows(database, 'select * from capability.capability where id=any($1::text[]) order by id',
      [[fixture.base_capability_id, fixture.extra_capability_id]]),
    rows(database, 'select * from runtime.event where type=any($1::text[]) order by type,version', [eventTypes]),
    rows(database, 'select * from organization.nodecapabilityversion where node_id=any($1::text[]) order by node_id,capability_version', [nodeIds]),
    rows(database, 'select * from access.scopegrant where membership_id=any($1::text[]) order by membership_id,id', [membershipIds]),
    rows(database, 'select * from capability.entitlement where scope_id=any($1::text[]) order by scope_id,id', [nodeIds]),
    rows(database, 'select * from organization.hostednodeprovisioning where node_id=any($1::text[]) order by node_id', [nodeIds]),
    rows(database, 'select * from organization.nodemanifestversion where node_id=any($1::text[]) order by node_id,manifest_version', [nodeIds]),
    rows(database, 'select * from organization.noderesourcebindingset where node_id=any($1::text[]) order by node_id,resource_binding_version', [nodeIds]),
  ]);
  return Object.freeze({
    counts: {
      hosted_nodes: nodes.length,
      current_relations: relations.filter((entry) => entry.superseded_at === null).length,
      active_nodes: nodes.filter((entry) => entry.status === 'active').length,
      memberships: memberships.length,
      active_memberships: memberships.filter((entry) => entry.status === 'active').length,
      active_base_scopes: scopeGrants.filter((entry) => entry.id.endsWith(':base') && activeAt(entry, fixture.times.revoke)).length,
      enabled_base_entitlements: entitlements.filter((entry) => entry.id.endsWith(':base') && entry.state === 'enabled').length,
      extra_scope_rows: scopeGrants.filter((entry) => entry.id.endsWith(':extra')).length,
      active_extra_scopes: scopeGrants.filter((entry) => entry.id.endsWith(':extra') && activeAt(entry, fixture.times.revoke)).length,
      audit_rows: Number((await database.query('select count(*)::integer value from access.decisionaudit where trace_id=$1',
        [fixture.trace_id])).rows[0]?.value ?? 0),
      outbox_rows: Number((await database.query('select count(*)::integer value from runtime.outbox where trace_id=$1',
        [fixture.trace_id])).rows[0]?.value ?? 0),
      manifest_rows: manifests.length,
      resource_binding_rows: resourceBindings.length,
    },
    nodes,
    relations,
    closure,
    realms,
    memberships,
    accounts,
    principals,
    credentials,
    member_profiles: memberProfiles,
    capability_definitions: capabilityDefinitions,
    event_definitions: eventDefinitions,
    node_capabilities: nodeCapabilities,
    scope_grants: scopeGrants,
    entitlements,
    provisioning,
    manifests,
    resource_bindings: resourceBindings,
  });
}

function activeAt(row, observedAt) {
  const at = Date.parse(observedAt);
  return Date.parse(row.effective_at) <= at && (row.expires_at === null || Date.parse(row.expires_at) > at);
}

async function auditOutboxRows(database, fixture) {
  const [decisionAudit, runtimeOutbox] = await Promise.all([
    rows(database, 'select * from access.decisionaudit where trace_id=$1 order by decided_at,id', [fixture.trace_id]),
    rows(database, 'select * from runtime.outbox where trace_id=$1 order by occurred_at,id', [fixture.trace_id]),
  ]);
  return Object.freeze({ decision_audit: decisionAudit, runtime_outbox: runtimeOutbox });
}

async function sourceSnapshot(samples, runToken) {
  const paths = [];
  for (const root of SOURCE_ROOTS) await collectFiles(join(repositoryRoot, root), paths);
  paths.sort((left, right) => left.localeCompare(right));
  const tokens = [runToken, ...samples.flatMap((entry) => [entry.node_id, entry.realm_id, entry.membership_id])];
  const entries = await Promise.all(paths.map(async (path) => {
    const bytes = await readFile(path);
    const repositoryPath = relative(repositoryRoot, path).replaceAll('\\', '/');
    const text = bytes.toString('utf8');
    return Object.freeze({
      path: repositoryPath,
      size_bytes: bytes.byteLength,
      sha256: `sha256:${digest(bytes)}`,
      hosted_node_specific_tokens: tokens.filter((token) => repositoryPath.includes(token) || text.includes(token)),
    });
  }));
  return Object.freeze({
    file_count: entries.length,
    inventory_sha256: inventoryDigest(entries),
    hosted_node_specific_file_count: entries.filter((entry) => entry.hosted_node_specific_tokens.length > 0).length,
    entries,
  });
}

async function collectFiles(directory, output) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collectFiles(path, output);
    else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name)) && !/\.(test|spec)\./.test(entry.name)
      && !path.includes('/06_tests_ceshi/') && !path.includes('/__tests__/')) output.push(path);
  }
}

function inventoryDigest(entries) {
  return `sha256:${digest(entries.map((entry) => `${entry.path}\0${entry.size_bytes}\0${entry.sha256}\n`).join(''))}`;
}

async function rows(database, sql, values) {
  return (await database.query(sql, values)).rows;
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function writeJson(path, value) {
  return writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}
