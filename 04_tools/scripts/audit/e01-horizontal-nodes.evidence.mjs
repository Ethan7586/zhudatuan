import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const permissionByKind = Object.freeze({
  read: 'e01.horizontal.read',
  write: 'e01.horizontal.write',
  capability_probe: 'e01.horizontal.variant',
});

export function createHorizontalFixture(criteria, runToken) {
  if (criteria.claim_id !== 'E2-TOPO-001' || criteria.legacy_trace_id !== 'E01') {
    throw new Error('E01_CRITERIA_IDENTITY_INVALID');
  }
  if (criteria.fixture?.peer_count !== 3 || criteria.operation_matrix?.cross_node_observation_count !== 30) {
    throw new Error('E01_CRITERIA_MATRIX_INVALID');
  }
  const lineId = `line:e01-${runToken}:v1`;
  const parent = Object.freeze({
    label: 'H-PARENT',
    line_id: lineId,
    node_id: `node:e01-parent-${runToken}:l0`,
    parent_node_id: null,
    signed_level: 'L0',
    sovereignty_tier: 'sovereign',
    node_profile: 'operating_mall',
    realm_id: `realm:e01-parent-${runToken}`,
    scope_id: `mall:e01-parent-${runToken}`,
  });
  const peers = criteria.fixture.peer_nodes.map((criterion, index) => {
    const key = String.fromCharCode(97 + index);
    const sovereign = criterion.sovereignty_tier === 'sovereign';
    return Object.freeze({
      label: criterion.label,
      line_id: lineId,
      node_id: `node:e01-h${key}-${runToken}:l1`,
      parent_node_id: parent.node_id,
      signed_level: 'L1',
      sovereignty_tier: criterion.sovereignty_tier,
      node_profile: 'operating_mall',
      host_sovereign_node_id: sovereign ? `node:e01-h${key}-${runToken}:l1` : parent.node_id,
      realm_id: `realm:e01-h${key}-${runToken}`,
      account_id: `account:e01-h${key}-${runToken}`,
      principal_id: `principal:e01-h${key}-${runToken}`,
      credential_id: `credential:e01-h${key}-${runToken}`,
      member_id: `member:e01-h${key}-${runToken}`,
      membership_id: `membership:e01-h${key}-${runToken}`,
      scope_id: `mall:e01-h${key}-${runToken}`,
      role_id: `role:e01-h${key}-${runToken}`,
      scope_grant_id: `scopegrant:e01-h${key}-${runToken}`,
      session_id: `session:e01-h${key}-${runToken}`,
      token_hash: sha256(`e01-token:${key}:${runToken}`),
      subject_hash: sha256(`e01-subject:${key}:${runToken}`),
      resource_id: `order:e01-h${key}-${runToken}`,
      order_number: `E01-H${key.toUpperCase()}-${runToken}`,
      checkout_id: `checkout:e01-h${key}-${runToken}`,
      accounts_host: `accounts.e01-h${key}-${runToken}.test`,
      auth_target: `e01-h${key}-${runToken}`,
      variant_capability_expected: criterion.variant_capability_expected,
    });
  });
  const operations = criteria.operation_matrix.positive_operations_per_peer.map((entry) => Object.freeze({ ...entry }));
  return Object.freeze({ run_token: runToken, line_id: lineId, parent, peers: Object.freeze(peers), operations });
}

export async function collectHorizontalSourceInventory(criteria, fixture, capturedAt) {
  const entries = [];
  const nodeSpecificSourceFiles = [];
  const nodeNameBusinessBranches = [];
  const symbols = {
    parse_authoritative_node_context: [],
    pg_authoritative_node_context_resolver: [],
  };
  const generatedTokens = [fixture.run_token, fixture.line_id, fixture.parent.node_id,
    ...fixture.peers.flatMap((peer) => [peer.node_id, peer.realm_id, peer.membership_id, peer.scope_id, peer.resource_id])];
  for (const root of criteria.source_inventory_scope.roots) {
    await collectSourceEntries(join(repositoryRoot, root), criteria.source_inventory_scope, entries, async (path, text) => {
      const repositoryPath = relative(repositoryRoot, path).replaceAll('\\', '/');
      const lines = text.split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.includes('export function parseAuthoritativeNodeContext(')) {
          symbols.parse_authoritative_node_context.push({ path: repositoryPath, line: index + 1 });
        }
        if (line.includes('export class PgAuthoritativeNodeContextResolver')) {
          symbols.pg_authoritative_node_context_resolver.push({ path: repositoryPath, line: index + 1 });
        }
        if (generatedTokens.some((token) => line.includes(token))) {
          nodeSpecificSourceFiles.push({ path: repositoryPath, line: index + 1, reason: 'generated-fixture-identifier' });
        }
        if (/(?:if|switch|case|\?|===|==).*['"`](?:H-A|H-B|H-C)['"`]/i.test(line)) {
          nodeNameBusinessBranches.push({ path: repositoryPath, line: index + 1, reason: 'peer-label-conditional' });
        }
      }
    });
  }
  entries.sort((left, right) => left.path.localeCompare(right.path));
  return Object.freeze({
    schema_version: 'e01-horizontal-source-inventory-v1',
    captured_at: capturedAt,
    scope: criteria.source_inventory_scope,
    file_count: entries.length,
    inventory_digest: `sha256:${inventoryDigest(entries)}`,
    entries,
    symbols,
    node_specific_source_files: uniqueLocations(nodeSpecificSourceFiles),
    node_name_business_branches: uniqueLocations(nodeNameBusinessBranches),
    source_copy_ledger: [],
  });
}

export async function buildHorizontalArtifact(criteria, sourceSha, outputDirectory, peers) {
  await mkdir(outputDirectory, { recursive: true });
  const markerPath = join(outputDirectory, 'e01-shared-version-marker.txt');
  await writeFile(markerPath, `${criteria.shared_build.marker}\n`, { flag: 'wx' });
  const commandArguments = [
    '04_tools/scripts/release/build-runtime-bundle.mjs',
    criteria.shared_build.target,
    outputDirectory,
    sourceSha,
  ];
  const startedAt = new Date().toISOString();
  const stdout = await capture('node', commandArguments);
  const completedAt = new Date().toISOString();
  const files = await collectArtifactEntries(outputDirectory);
  const artifactIdentity = `sha256:${inventoryDigest(files)}`;
  const releaseVersion = JSON.parse(await readFile(join(outputDirectory, 'release-version.json'), 'utf8'));
  const buildId = `e01-${criteria.shared_build.target}-${sourceSha}`;
  return Object.freeze({
    build_invocations: [{
      invocation_id: 'e01-shared-horizontal-build-1',
      build_id: buildId,
      scope: 'shared-runtime',
      assigned_node_id: null,
      command: `node 04_tools/scripts/release/build-runtime-bundle.mjs ${criteria.shared_build.target} <temporary-output-directory> ${sourceSha}`,
      source_sha: sourceSha,
      started_at: startedAt,
      completed_at: completedAt,
      exit_code: 0,
      stdout: stdout.trim(),
    }],
    artifacts: [{
      artifact_identity: artifactIdentity,
      build_id: buildId,
      target: releaseVersion.target,
      source_sha: releaseVersion.sourceSha,
      marker: (await readFile(markerPath, 'utf8')).trim(),
      files,
    }],
    peer_artifact_assignments: peers.map((peer) => ({
      peer_label: peer.label,
      node_id: peer.node_id,
      source_sha: sourceSha,
      build_id: buildId,
      artifact_identity: artifactIdentity,
    })),
    node_specific_builds: [],
  });
}

export async function executeHorizontalNodes(database, criteria, fixture, sourceInventory, outputDirectory) {
  const outsideBefore = await snapshotState(database, fixture);
  let topology;
  let contexts;
  let authority;
  let seeded;
  let afterPositive;
  let afterNegative;
  let positiveResults;
  let crossNodeResults;
  let modelInventory;

  await database.query('begin');
  try {
    await database.query('set constraints all deferred');
    await seedFixture(database, fixture);
    topology = await collectTopology(database, fixture);
    contexts = await collectContexts(database, fixture);
    authority = await collectAuthority(database, fixture);
    modelInventory = await collectModelInventory(database, fixture, sourceInventory);
    seeded = await snapshotState(database, fixture);
    positiveResults = await executePositiveMatrix(database, fixture);
    afterPositive = await snapshotState(database, fixture);
    crossNodeResults = await executeCrossNodeMatrix(database, fixture, criteria);
    afterNegative = await snapshotState(database, fixture);
  } catch (cause) {
    await database.query('rollback');
    throw cause;
  }
  await database.query('rollback');
  const outsideAfterRollback = await snapshotState(database, fixture);
  const capturedAt = new Date().toISOString();

  const inputManifest = Object.freeze({
    schema_version: 'e01-horizontal-input-manifest-v1',
    captured_at: capturedAt,
    run_token: fixture.run_token,
    line_id: fixture.line_id,
    parent: publicNode(fixture.parent),
    peers: fixture.peers.map(publicPeer),
    operation_matrix: criteria.operation_matrix,
  });
  const topologyArtifact = Object.freeze({
    schema_version: 'e01-horizontal-topology-v1',
    captured_at: capturedAt,
    node_model: 'organization.node',
    relation_model: 'organization.noderelation',
    closure_model: 'organization.nodeclosure',
    ...topology,
  });
  const contextArtifact = Object.freeze({
    schema_version: 'e01-horizontal-node-contexts-v1',
    captured_at: capturedAt,
    resolver: 'PgAuthoritativeNodeContextResolver.resolve',
    database_function: 'organization.resolve_node_context(text)',
    parser: 'parseAuthoritativeNodeContext',
    path_identity: 'organization.resolve_node_context(text)->PgAuthoritativeNodeContextResolver.resolve->parseAuthoritativeNodeContext',
    observations: contexts,
    authority_map: authority,
  });
  const operationArtifact = Object.freeze({
    schema_version: 'e01-horizontal-operation-results-v1',
    captured_at: capturedAt,
    production_authority_path: [
      'identity.resolve_session(token_hash,host)',
      'access.resolve_session_membership(membership,realm,client,organization)',
      'access.resolve_session_scope(membership,realm,client,organization,operation,resource,scope)',
      'capability.session_membership_operations(membership,realm,client,organization)',
      'PgAuthoritativeNodeContextResolver.resolve(node)',
      'NodeBoundScopeResolver.resolve(actor,operation)',
      'ordering.orderrecord identity predicate',
    ],
    positive_results: positiveResults,
    cross_node_results: crossNodeResults,
  });
  const databaseArtifact = Object.freeze({
    schema_version: 'e01-horizontal-database-diff-v1',
    captured_at: capturedAt,
    observation_scope: 'Synthetic E01 rows in production tables, all enclosed by one rolled-back transaction.',
    fixture_before: outsideBefore,
    seeded_before_operations: seeded,
    after_positive_operations: afterPositive,
    after_cross_node_operations: afterNegative,
    after_transaction_rollback: outsideAfterRollback,
    positive_operation_diff: diffSnapshots(seeded, afterPositive),
    cross_node_operation_diff: diffSnapshots(afterPositive, afterNegative),
    rollback_diff: diffSnapshots(outsideBefore, outsideAfterRollback),
  });
  await Promise.all([
    writeJson(join(outputDirectory, 'horizontal-input-manifest.json'), inputManifest),
    writeJson(join(outputDirectory, 'horizontal-topology.json'), topologyArtifact),
    writeJson(join(outputDirectory, 'horizontal-node-contexts.json'), contextArtifact),
    writeJson(join(outputDirectory, 'horizontal-operation-results.json'), operationArtifact),
    writeJson(join(outputDirectory, 'horizontal-database-diff.json'), databaseArtifact),
    writeJson(join(outputDirectory, 'horizontal-model-inventory.json'), modelInventory),
  ]);

  return Object.freeze({
    peer_count: fixture.peers.length,
    positive_observation_count: positiveResults.length,
    cross_node_observation_count: crossNodeResults.length,
    successful_business_write_count: positiveResults.filter((entry) => entry.kind === 'write' && entry.status === 200).length,
    rollback_residual_fact_count: totalRows(outsideAfterRollback),
  });
}

async function seedFixture(database, fixture) {
  const organizations = [fixture.parent, ...fixture.peers];
  for (const item of organizations) {
    await database.query(`insert into organization.organization(
      id,kind,parent_id,name,timezone,status,version,created_at,updated_at
    ) values($1,'mall','enterprise-zhudatuan',$2,'Asia/Shanghai','active',1,clock_timestamp(),clock_timestamp())`,
    [item.scope_id, `E01 ${item.label} ${fixture.run_token}`]);
    await database.query(`insert into organization.unitclosure(ancestor_id,descendant_id,depth)
      values($1,$1,0)`, [item.scope_id]);
  }

  await insertRealm(database, fixture.parent, null);
  for (const peer of fixture.peers) {
    await insertRealm(database, peer, peer.sovereignty_tier === 'hosted' ? fixture.parent.node_id : null);
  }
  for (const item of [fixture.parent, ...fixture.peers]) {
    await database.query(`insert into organization.node(
      id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at
    ) values($1,$2,$3,$4,$5,$6,'active',clock_timestamp(),clock_timestamp())`,
    [item.node_id, item.line_id, item.sovereignty_tier, item.node_profile, item.realm_id, item.scope_id]);
  }
  await insertRelation(database, fixture.parent, fixture.parent.node_id);
  for (const peer of fixture.peers) await insertRelation(database, peer, peer.host_sovereign_node_id);

  for (const operation of fixture.operations) {
    const permissionCode = permissionByKind[operation.kind];
    await database.query(`insert into runtime.operation(id,owner,method,path,contract_version)
      values($1,'e01',$2,$3,'1.0.0')`, [
      operation.operation_id,
      operation.kind === 'read' ? 'GET' : 'POST',
      `/__e01__/${fixture.run_token}/${operation.kind}`,
    ]);
    await database.query(`insert into access.permission(id,code,risk,status)
      values($1,$2,'low','active')`, [`permission:${operation.kind}:e01:${fixture.run_token}`, permissionCode]);
    await database.query(`insert into capability.capability(id,kind,name,version,status)
      values($1,'operation',$2,1,'active')`, [operation.operation_id, `E01 ${operation.kind} ${fixture.run_token}`]);
    await database.query(`insert into capability.operation(operation_id,capability_id,permission_code,audience)
      values($1,$1,$2,'operator')`, [operation.operation_id, permissionCode]);
  }

  for (const peer of fixture.peers) {
    await database.query(`insert into identity.realmentry(host,realm_id,kind,status,created_at)
      values($1,$2,'accounts','active',clock_timestamp())`, [peer.accounts_host, peer.realm_id]);
    await database.query(`insert into identity.realmtarget(
      realm_id,surface,target,membership_client,membership_organization_id,application_slug,
      return_origin,created_at,node_profile
    ) values($1,'admin',$2,'operator',$3,null,$4,clock_timestamp(),'operating_mall')`,
    [peer.realm_id, peer.auth_target, peer.scope_id, `https://${peer.auth_target}.test`]);
    await database.query(`insert into identity.principal(id,status,credential_version,created_at,updated_at)
      values($1,'active',1,clock_timestamp(),clock_timestamp())`, [peer.principal_id]);
    await database.query(`insert into identity.account(
      id,realm_id,legacy_principal_id,status,credential_version,assurance_level,created_at,updated_at,
      mobile_ciphertext,mobile_token,mobile_masked,phone_verified_at
    ) values($1,$2,$3,'active',1,2,clock_timestamp(),clock_timestamp(),$4,$5,'+86 138****8000',clock_timestamp())`,
    [peer.account_id, peer.realm_id, peer.principal_id, `synthetic-mobile-${peer.label}-${fixture.run_token}`, peer.subject_hash]);
    await database.query(`insert into identity.credential(
      id,principal_id,provider,subject_hash,secret_hash,status,created_at,realm_id,account_id
    ) values($1,$2,'password',$3,$4,'active',clock_timestamp(),$5,$6)`,
    [peer.credential_id, peer.principal_id, peer.subject_hash,
      `synthetic-one-way-hash-${peer.label}-${fixture.run_token}`, peer.realm_id, peer.account_id]);
    await database.query(`insert into member.profile(id,principal_id,display_name,status,created_at,updated_at)
      values($1,$2,$3,'active',clock_timestamp(),clock_timestamp())`,
    [peer.member_id, peer.principal_id, `E01 ${peer.label}`]);
    await database.query(`insert into access.membership(
      id,member_id,organization_id,client,status,access_version,joined_at,realm_id,account_id,node_profile
    ) values($1,$2,$3,'operator','active',1,clock_timestamp(),$4,$5,'operating_mall')`,
    [peer.membership_id, peer.member_id, peer.scope_id, peer.realm_id, peer.account_id]);
    await database.query(`insert into access.role(id,scope_id,name,status,version)
      values($1,$2,$3,'active',1)`, [peer.role_id, peer.scope_id, `E01 ${peer.label} role`]);
    for (const operation of fixture.operations) {
      await database.query(`insert into access.rolepermission(role_id,permission_id,effect)
        select $1,id,'allow' from access.permission where code=$2`, [peer.role_id, permissionByKind[operation.kind]]);
    }
    await database.query(`insert into access.membershiprole(membership_id,role_id,effective_at)
      values($1,$2,'1970-01-01T00:00:00Z')`, [peer.membership_id, peer.role_id]);
    await database.query(`insert into access.scopegrant(
      id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version
    ) values($1,$2,'mall',$3,$3,'allow','1970-01-01T00:00:00Z',1)`,
    [peer.scope_grant_id, peer.membership_id, peer.scope_id]);
    for (const operation of fixture.operations) {
      const enabled = operation.kind !== 'capability_probe' || peer.variant_capability_expected;
      await database.query(`insert into capability.entitlement(
        id,scope_id,capability_id,state,quota,effective_at,expires_at,version
      ) values($1,$2,$3,$4,null,'1970-01-01T00:00:00Z',null,1)`,
      [`entitlement:${operation.kind}:e01:${peer.label.toLowerCase()}:${fixture.run_token}`,
        peer.scope_id, operation.operation_id, enabled ? 'enabled' : 'disabled']);
    }
    await database.query(`insert into identity.session(
      id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,
      user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at,realm_id,account_id,auth_target
    ) values($1,$2,$3,$4,1,1,'operator',$5,$6,'e01',2,clock_timestamp()+interval '1 hour',
      clock_timestamp(),clock_timestamp(),$7,$8,$9)`, [
      peer.session_id, peer.principal_id, peer.membership_id, peer.token_hash,
      sha256(`e01-ip:${peer.label}:${fixture.run_token}`), `e01-${peer.label}`, peer.realm_id,
      peer.account_id, peer.auth_target,
    ]);
    await database.query(`insert into ordering.orderrecord(
      id,order_number,scope_id,member_id,mall_id,checkout_id,currency,total_minor,payment_state,
      fulfillment_state,aftersale_state,lifecycle_state,evidence,created_at,updated_at,version,
      operating_node_id,operating_line_id,participant_node_id,participant_membership_id,
      participant_realm_id,participant_account_id,participant_snapshot
    ) values($1,$2,$3,$4,$3,$5,'CNY',100,'unpaid','unallocated','none','created',$6,
      clock_timestamp(),clock_timestamp(),1,$7,$8,$7,$9,$10,$11,$12)`, [
      peer.resource_id, peer.order_number, peer.scope_id, peer.member_id, peer.checkout_id,
      { fixture: 'E01', peer: peer.label }, peer.node_id, peer.line_id, peer.membership_id,
      peer.realm_id, peer.account_id, { peer: peer.label, synthetic: true },
    ]);
  }
}

async function insertRealm(database, item, hostNodeId) {
  await database.query(`insert into identity.realm(
    id,node_id,status,created_at,updated_at,node_profile,mall_id,host_node_id,host_node_profile
  ) values($1,$2,'active',clock_timestamp(),clock_timestamp(),'operating_mall',$3,$4,$5)`,
  [item.realm_id, item.node_id, item.scope_id, hostNodeId, hostNodeId === null ? null : 'operating_mall']);
}

async function insertRelation(database, item, hostSovereignNodeId) {
  await database.query(`insert into organization.noderelation(
    line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
    relation_version,effective_at
  ) values($1,$2,$3,$3,$4,$5,1,'2026-09-14T00:00:00Z')`,
  [item.line_id, item.node_id, item.parent_node_id, item.signed_level, hostSovereignNodeId]);
}

async function collectTopology(database, fixture) {
  const nodeIds = [fixture.parent.node_id, ...fixture.peers.map((peer) => peer.node_id)];
  const nodes = await rows(database, `select id node_id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status
    from organization.node where id=any($1::text[]) order by id`, [nodeIds]);
  const relations = await rows(database, `select line_id,node_id,parent_node_id,original_parent_node_id,signed_level,
      host_sovereign_node_id,relation_version::integer,effective_at,superseded_at
    from organization.noderelation where node_id=any($1::text[]) order by node_id,relation_version`, [nodeIds]);
  const closure = await rows(database, `select line_id,descendant_node_id,ancestor_node_id,depth,superseded_at
    from organization.nodeclosure where descendant_node_id=any($1::text[]) order by descendant_node_id,depth`, [nodeIds]);
  return Object.freeze({ parent_node_id: fixture.parent.node_id, nodes, relations, closure });
}

async function collectContexts(database, fixture) {
  const { PgAuthoritativeNodeContextResolver } = await import(
    '../../../01_core_hexin/services/commerce/src/foundation/security/AuthoritativeNodeContextResolver.ts'
  );
  const resolver = new PgAuthoritativeNodeContextResolver(database);
  const observations = [];
  for (const peer of fixture.peers) {
    observations.push(Object.freeze({
      peer_label: peer.label,
      expected: expectedContext(peer),
      observed: await resolver.resolve(peer.node_id),
      path_identity: 'organization.resolve_node_context(text)->PgAuthoritativeNodeContextResolver.resolve->parseAuthoritativeNodeContext',
    }));
  }
  return Object.freeze(observations);
}

async function collectAuthority(database, fixture) {
  const output = [];
  for (const peer of fixture.peers) {
    const identity = await rows(database, `select node.id node_id,node.line_id,node.realm_id,node.mall_id scope_id,
        realm.host_node_id,account.id account_id,account.legacy_principal_id principal_id,
        membership.id membership_id,membership.organization_id,membership.client,membership.status,
        scope.id scope_grant_id,scope.scope_id granted_scope_id,session.id session_id
      from organization.node node
      join identity.realm realm on realm.id=node.realm_id
      join identity.account account on account.realm_id=realm.id
      join access.membership membership on membership.account_id=account.id and membership.realm_id=realm.id
      join access.scopegrant scope on scope.membership_id=membership.id
      join identity.session session on session.membership_id=membership.id
      where node.id=$1`, [peer.node_id]);
    const capabilities = await rows(database, `select entitlement.capability_id,entitlement.state,entitlement.scope_id
      from capability.entitlement entitlement where entitlement.scope_id=$1
        and entitlement.capability_id=any($2::text[]) order by entitlement.capability_id`,
    [peer.scope_id, fixture.operations.map((operation) => operation.operation_id)]);
    const resources = await rows(database, `select id resource_id,scope_id,member_id,mall_id,operating_node_id,
        operating_line_id,participant_node_id,participant_membership_id,participant_realm_id,
        participant_account_id,version,evidence
      from ordering.orderrecord where id=$1`, [peer.resource_id]);
    output.push(Object.freeze({
      peer_label: peer.label,
      expected: publicPeer(peer),
      identity: identity[0] ?? null,
      capabilities,
      resources,
    }));
  }
  return Object.freeze(output);
}

async function collectModelInventory(database, fixture, sourceInventory) {
  const tables = await rows(database, `select namespace.nspname schema_name,class.relname table_name,class.oid::integer oid
    from pg_class class join pg_namespace namespace on namespace.oid=class.relnamespace
    where namespace.nspname='organization' and class.relname=any($1::text[]) and class.relkind='r'
    order by class.relname`, [['node', 'noderelation', 'nodeclosure']]);
  const resolvers = await rows(database, `select procedure.oid::integer oid,procedure.proname function_name,
      pg_get_function_identity_arguments(procedure.oid) identity_arguments,
      encode(digest(pg_get_functiondef(procedure.oid),'sha256'),'hex') definition_sha256
    from pg_proc procedure join pg_namespace namespace on namespace.oid=procedure.pronamespace
    where namespace.nspname='organization' and procedure.proname='resolve_node_context'
    order by procedure.oid`);
  return Object.freeze({
    schema_version: 'e01-horizontal-model-inventory-v1',
    captured_at: new Date().toISOString(),
    database_model: { tables, context_resolvers: resolvers },
    source_inventory: sourceInventory,
    peer_model_assignments: fixture.peers.map((peer) => ({
      peer_label: peer.label,
      node_id: peer.node_id,
      model_identity: 'organization.node+organization.noderelation+organization.nodeclosure',
      path_identity: 'organization.resolve_node_context(text)->PgAuthoritativeNodeContextResolver.resolve->parseAuthoritativeNodeContext',
    })),
  });
}

async function executePositiveMatrix(database, fixture) {
  const results = [];
  for (const peer of fixture.peers) {
    for (const operation of fixture.operations) {
      const request = requestFor(peer, operation);
      results.push(await executeOperation(database, fixture, peer, operation, request,
        `trace:e01:${fixture.run_token}:positive:${peer.label.toLowerCase()}:${operation.kind}`));
    }
  }
  return Object.freeze(results);
}

async function executeCrossNodeMatrix(database, fixture, criteria) {
  const results = [];
  for (let index = 0; index < fixture.peers.length; index += 1) {
    const source = fixture.peers[index];
    const donor = fixture.peers[(index + 1) % fixture.peers.length];
    for (const dimension of criteria.operation_matrix.cross_node_dimensions) {
      for (const kind of criteria.operation_matrix.cross_node_operation_kinds) {
        const operation = fixture.operations.find((entry) => entry.kind === kind);
        if (!operation) throw new Error(`E01_OPERATION_KIND_MISSING:${kind}`);
        const request = { ...requestFor(source, operation) };
        if (dimension === 'realm') request.endpoint_host = donor.accounts_host;
        if (dimension === 'membership') request.membership_id = donor.membership_id;
        if (dimension === 'scope') request.scope_id = donor.scope_id;
        if (dimension === 'node') request.node_id = donor.node_id;
        if (dimension === 'resource') request.resource_id = donor.resource_id;
        const result = await executeOperation(database, fixture, source, operation, request,
          `trace:e01:${fixture.run_token}:cross:${source.label.toLowerCase()}:${dimension}:${kind}`);
        results.push(Object.freeze({ ...result, donor_peer_label: donor.label, misuse_dimension: dimension }));
      }
    }
  }
  return Object.freeze(results);
}

async function executeOperation(database, fixture, source, operation, request, traceId) {
  const authorization = {
    session: null,
    membership: null,
    scope: null,
    capabilities: null,
    node_context: null,
    node_boundary: null,
  };
  let denial = null;
  const session = await database.query(`select actor_id,account_id,realm_id,session_id,membership_id,
      credential_version,access_version,target,membership_client,governance_organization_id,entry_realm_id,
      line_id,node_id,parent_node_id,signed_level,node_profile,mall_id,host_sovereign_node_id,relation_version
    from identity.resolve_session($1,$2)`, [source.token_hash, request.endpoint_host]);
  authorization.session = resultRows(session);
  const actor = session.rows[0] ?? null;
  if (session.rows.length !== 1) denial = { stage: 'realm', reason: 'AUTHENTICATION_REQUIRED' };

  let membership = { rows: [] };
  if (denial === null) {
    membership = await database.query(`select resolved.id,resolved.active,resolved.access_version,
        resolved.denies,resolved.grants
      from access.resolve_session_membership($1,$2,$3,$4) resolved`,
    [request.membership_id, actor.realm_id, actor.membership_client, actor.governance_organization_id]);
    authorization.membership = resultRows(membership);
    if (membership.rows.length !== 1 || membership.rows[0]?.active !== true) {
      denial = { stage: 'membership', reason: 'MEMBERSHIP_CONTEXT_MISMATCH' };
    }
  }

  let scope = { rows: [] };
  if (denial === null) {
    scope = await database.query(`select resolved.scope from access.resolve_session_scope(
        $1,$2,$3,$4,$5,$6,$7
      ) resolved`, [request.membership_id, actor.realm_id, actor.membership_client,
      actor.governance_organization_id, operation.operation_id, request.resource_id, request.scope_id]);
    authorization.scope = resultRows(scope);
    if (scope.rows.length !== 1 || !scope.rows[0]?.scope) denial = { stage: 'scope', reason: 'SCOPE_DENIED' };
  }

  let capabilities = { rows: [] };
  if (denial === null) {
    capabilities = await database.query(`select operation_id from capability.session_membership_operations(
      $1,$2,$3,$4) order by operation_id`, [request.membership_id, actor.realm_id,
    actor.membership_client, actor.governance_organization_id]);
    authorization.capabilities = resultRows(capabilities);
    if (!capabilities.rows.some((entry) => entry.operation_id === operation.operation_id)) {
      denial = { stage: 'capability', reason: 'CAPABILITY_UNAVAILABLE' };
    }
  }

  if (denial === null) {
    const { PgAuthoritativeNodeContextResolver } = await import(
      '../../../01_core_hexin/services/commerce/src/foundation/security/AuthoritativeNodeContextResolver.ts'
    );
    const { NodeBoundScopeResolver } = await import(
      '../../../01_core_hexin/services/commerce/src/foundation/security/NodeBoundScopeResolver.ts'
    );
    try {
      const context = await new PgAuthoritativeNodeContextResolver(database).resolve(request.node_id);
      authorization.node_context = context;
      const scopeRow = (await database.query(`select access.scope_object(node.mall_id) scope
        from organization.node node where node.id=$1`, [request.node_id])).rows[0];
      if (!scopeRow?.scope) throw new Error('NODE_SCOPE_MISMATCH');
      const resolver = new NodeBoundScopeResolver({ resolve: async () => scopeRow.scope }, actor.governance_organization_id);
      const resolved = await resolver.resolve({ id: actor.actor_id }, operation.operation_id);
      authorization.node_boundary = { expected_scope_id: actor.governance_organization_id, resolved_scope: resolved };
    } catch (cause) {
      denial = { stage: 'node', reason: serializeError(cause).message };
    }
  }

  let readRows = [];
  let writeRows = [];
  if (denial === null) {
    const parameters = [request.resource_id, actor.realm_id, actor.account_id, request.membership_id,
      request.node_id, request.scope_id];
    const matched = await rows(database, `select id,scope_id,participant_realm_id,participant_account_id,
        participant_membership_id,participant_node_id,version,evidence
      from ordering.orderrecord where id=$1 and participant_realm_id=$2 and participant_account_id=$3
        and participant_membership_id=$4 and participant_node_id=$5 and scope_id=$6`, parameters);
    if (matched.length !== 1) {
      denial = { stage: 'resource', reason: 'RESOURCE_ISOLATED' };
    } else if (operation.kind === 'write') {
      writeRows = await rows(database, `update ordering.orderrecord
        set evidence=evidence||jsonb_build_object('e01_trace',$7::text),version=version+1,
          updated_at=clock_timestamp()
        where id=$1 and participant_realm_id=$2 and participant_account_id=$3
          and participant_membership_id=$4 and participant_node_id=$5 and scope_id=$6
        returning id,scope_id,participant_realm_id,participant_account_id,participant_membership_id,
          participant_node_id,version,evidence`, [...parameters, traceId]);
    } else {
      readRows = matched;
    }
  }

  const status = denial === null ? 200 : 403;
  await database.query(`insert into access.decisionaudit(
    id,actor_id,operation,resource_id,scope_id,decision,reason,policy_version,trace_id,decided_at
  ) values($1,$2,$3,$4,$5,$6,$7,'sfl-e01-v1',$8,clock_timestamp())`, [
    `audit:${traceId}`, actor?.actor_id ?? source.principal_id, operation.operation_id, request.resource_id,
    source.scope_id, status === 200 ? 'allow' : 'deny', denial?.reason ?? 'E01_HORIZONTAL_ALLOWED', traceId,
  ]);
  let emittedOutbox = null;
  if (status === 200 && operation.kind === 'write') {
    emittedOutbox = (await database.query(`insert into runtime.outbox(
      id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at
    ) values($1,'runtime.operation.completed',1,'operation',$2,$3,$4::jsonb,$5,clock_timestamp(),clock_timestamp())
    returning id,event_type,aggregate_type,aggregate_id,scope_id,trace_id,payload`, [
      `outbox:${traceId}`, request.resource_id, source.scope_id,
      JSON.stringify({ operation_id: operation.operation_id, node_id: source.node_id, synthetic: true }), traceId,
    ])).rows[0];
  }
  return Object.freeze({
    case_id: traceId.replace('trace:', 'case:'),
    source_peer_label: source.label,
    kind: operation.kind,
    operation_id: operation.operation_id,
    request: evidenceRequest(request, source),
    status,
    denial,
    authorization,
    read_rows: readRows,
    write_rows: writeRows,
    emitted_outbox: emittedOutbox,
    audit_scope_id: source.scope_id,
  });
}

function requestFor(peer, operation) {
  return {
    endpoint_host: peer.accounts_host,
    membership_id: peer.membership_id,
    scope_id: peer.scope_id,
    node_id: peer.node_id,
    realm_id: peer.realm_id,
    resource_id: peer.resource_id,
    operation_id: operation.operation_id,
  };
}

function evidenceRequest(request, source) {
  return Object.freeze({
    ...request,
    synthetic_session_ref: source.session_id,
    credential_material_persisted: false,
  });
}

async function snapshotState(database, fixture) {
  const pattern = `%${fixture.run_token}%`;
  const definitions = [
    ['runtime.operation', `select id,owner,method,path,contract_version from runtime.operation
      where id like 'e01.horizontal.%' and path like $1 order by id`],
    ['access.permission', `select id,code,risk,status from access.permission where id like $1 order by id`],
    ['capability.capability', `select id,kind,name,version,status from capability.capability
      where id like 'e01.horizontal.%' and name like $1 order by id`],
    ['capability.operation', `select operation.operation_id,operation.capability_id,operation.permission_code,operation.audience
      from capability.operation operation join runtime.operation runtime_operation
        on runtime_operation.id=operation.operation_id
      where operation.operation_id like 'e01.horizontal.%' and runtime_operation.path like $1
      order by operation.operation_id`],
    ['organization.organization', `select id,kind,parent_id,name,status,version from organization.organization
      where id like $1 order by id`],
    ['identity.realm', `select id,node_id,status,node_profile,mall_id,host_node_id,host_node_profile
      from identity.realm where id like $1 order by id`],
    ['identity.realmentry', `select host,realm_id,kind,status from identity.realmentry where host like $1 order by host`],
    ['identity.realmtarget', `select realm_id,surface,target,membership_client,membership_organization_id,node_profile
      from identity.realmtarget where target like $1 order by target`],
    ['organization.node', `select id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status
      from organization.node where id like $1 order by id`],
    ['organization.noderelation', `select line_id,node_id,parent_node_id,original_parent_node_id,signed_level,
      host_sovereign_node_id,relation_version,effective_at,superseded_at
      from organization.noderelation where node_id like $1 order by node_id,relation_version`],
    ['organization.nodeclosure', `select line_id,descendant_node_id,ancestor_node_id,depth,superseded_at
      from organization.nodeclosure where descendant_node_id like $1 or ancestor_node_id like $1
      order by descendant_node_id,depth,ancestor_node_id`],
    ['identity.principal', `select id,status,credential_version from identity.principal where id like $1 order by id`],
    ['identity.account', `select id,realm_id,legacy_principal_id,status,credential_version,assurance_level
      from identity.account where id like $1 order by id`],
    ['identity.credential', `select id,principal_id,provider,status,realm_id,account_id
      from identity.credential where id like $1 order by id`],
    ['member.profile', `select id,principal_id,display_name,status from member.profile where id like $1 order by id`],
    ['access.membership', `select id,member_id,organization_id,client,status,access_version,realm_id,account_id,node_profile
      from access.membership where id like $1 order by id`],
    ['access.role', `select id,scope_id,name,status,version from access.role where id like $1 order by id`],
    ['access.rolepermission', `select mapping.role_id,mapping.permission_id,mapping.effect
      from access.rolepermission mapping where mapping.role_id like $1 order by mapping.role_id,mapping.permission_id`],
    ['access.membershiprole', `select membership_id,role_id,effective_at,expires_at
      from access.membershiprole where membership_id like $1 order by membership_id,role_id`],
    ['access.scopegrant', `select id,membership_id,scope_kind,scope_id,scope_path,effect,access_version
      from access.scopegrant where id like $1 order by id`],
    ['capability.entitlement', `select id,scope_id,capability_id,state,quota,version
      from capability.entitlement where id like $1 order by id`],
    ['identity.session', `select id,principal_id,membership_id,credential_version,access_version,client,
      assurance_level,realm_id,account_id,auth_target,revoked_at
      from identity.session where id like $1 order by id`],
    ['ordering.orderrecord', `select id,scope_id,member_id,mall_id,version,evidence,operating_node_id,
      operating_line_id,participant_node_id,participant_membership_id,participant_realm_id,
      participant_account_id from ordering.orderrecord where id like $1 order by id`],
    ['access.decisionaudit', `select id,actor_id,operation,resource_id,scope_id,decision,reason,policy_version,trace_id
      from access.decisionaudit where id like $1 order by id`],
    ['runtime.outbox', `select id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id
      from runtime.outbox where id like $1 order by id`],
  ];
  const tables = {};
  for (const [name, sql] of definitions) tables[name] = await rows(database, sql, [pattern]);
  return Object.freeze({
    tables,
    table_counts: Object.fromEntries(Object.entries(tables).map(([name, value]) => [name, value.length])),
    table_digests: Object.fromEntries(Object.entries(tables).map(([name, value]) => [name, `sha256:${sha256(JSON.stringify(value))}`])),
  });
}

function diffSnapshots(before, after) {
  const names = [...new Set([...Object.keys(before.tables), ...Object.keys(after.tables)])].sort();
  const tables = names.map((name) => {
    const beforeRows = before.tables[name] ?? [];
    const afterRows = after.tables[name] ?? [];
    return Object.freeze({
      table: name,
      before_count: beforeRows.length,
      after_count: afterRows.length,
      count_delta: afterRows.length - beforeRows.length,
      changed: JSON.stringify(beforeRows) !== JSON.stringify(afterRows),
      before_sha256: `sha256:${sha256(JSON.stringify(beforeRows))}`,
      after_sha256: `sha256:${sha256(JSON.stringify(afterRows))}`,
    });
  });
  return Object.freeze({ changed_table_count: tables.filter((entry) => entry.changed).length, tables });
}

function expectedContext(peer) {
  return Object.freeze({
    line_id: peer.line_id,
    node_id: peer.node_id,
    parent_node_id: peer.parent_node_id,
    signed_level: peer.signed_level,
    sovereignty_tier: peer.sovereignty_tier,
    node_profile: peer.node_profile,
    realm_id: peer.realm_id,
    mall_id: peer.scope_id,
    host_sovereign_node_id: peer.host_sovereign_node_id,
    relation_version: 1,
    effective_at: '2026-09-14T00:00:00.000Z',
    status: 'active',
  });
}

function publicNode(item) {
  return Object.freeze({
    label: item.label,
    line_id: item.line_id,
    node_id: item.node_id,
    parent_node_id: item.parent_node_id,
    signed_level: item.signed_level,
    sovereignty_tier: item.sovereignty_tier,
    node_profile: item.node_profile,
    realm_id: item.realm_id,
    scope_id: item.scope_id,
  });
}

function publicPeer(peer) {
  return Object.freeze({
    ...publicNode(peer),
    host_sovereign_node_id: peer.host_sovereign_node_id,
    account_id: peer.account_id,
    principal_id: peer.principal_id,
    membership_id: peer.membership_id,
    resource_id: peer.resource_id,
    accounts_host: peer.accounts_host,
    variant_capability_expected: peer.variant_capability_expected,
  });
}

function resultRows(result) {
  return Object.freeze({ row_count: result.rows.length, rows: result.rows });
}

async function rows(database, sql, parameters = []) {
  return (await database.query(sql, parameters)).rows;
}

function totalRows(snapshot) {
  return Object.values(snapshot.tables).reduce((total, value) => total + value.length, 0);
}

async function collectSourceEntries(directory, scope, output, inspect) {
  const names = await readdir(directory, { withFileTypes: true });
  for (const entry of names) {
    if (scope.excluded_directory_names.includes(entry.name)) continue;
    const path = join(directory, entry.name);
    const repositoryPath = relative(repositoryRoot, path).replaceAll('\\', '/');
    if (scope.excluded_path_segments.some((segment) => repositoryPath.split('/').includes(segment))) continue;
    if (entry.isDirectory()) {
      await collectSourceEntries(path, scope, output, inspect);
    } else if (entry.isFile() && scope.extensions.includes(extname(entry.name))
      && !scope.excluded_filename_patterns.some((pattern) => entry.name.includes(pattern))) {
      const bytes = await readFile(path);
      output.push(Object.freeze({
        path: repositoryPath,
        size_bytes: bytes.byteLength,
        sha256: `sha256:${sha256(bytes)}`,
      }));
      await inspect(path, bytes.toString('utf8'));
    }
  }
}

async function collectArtifactEntries(directory) {
  const output = [];
  await collectArtifactDirectory(directory, directory, output);
  output.sort((left, right) => left.path.localeCompare(right.path));
  return output;
}

async function collectArtifactDirectory(root, directory, output) {
  const names = await readdir(directory, { withFileTypes: true });
  for (const entry of names) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collectArtifactDirectory(root, path, output);
    else if (entry.isFile()) {
      const bytes = await readFile(path);
      output.push(Object.freeze({
        path: relative(root, path).replaceAll('\\', '/'),
        size_bytes: bytes.byteLength,
        sha256: `sha256:${sha256(bytes)}`,
      }));
    }
  }
}

function uniqueLocations(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = `${value.path}:${value.line}:${value.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inventoryDigest(entries) {
  return sha256(Buffer.from(entries.map((entry) => `${entry.path}\0${entry.size_bytes}\0${entry.sha256}\n`).join('')));
}

function capture(command, arguments_) {
  return new Promise((resolveCapture, reject) => {
    const child = spawn(command, arguments_, { cwd: repositoryRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code, signal) => (code === 0
      ? resolveCapture(stdout)
      : reject(new Error(`COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}:${stderr.trim()}`))));
  });
}

function serializeError(cause) {
  if (cause instanceof Error) return Object.freeze({ name: cause.name, message: cause.message });
  return Object.freeze({ name: 'Error', message: String(cause) });
}

function writeJson(path, value) {
  return writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
