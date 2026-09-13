import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.sql']);
const EXCLUDED_DIRECTORIES = new Set(['.next', 'coverage', 'dist', 'node_modules', 'playwright-report', 'test-results']);
const SOURCE_ROOTS = ['01_core_hexin', '02_platform_pingtai/database/supabase/migrations'];

export async function executeE07Continuity(database, criteria, runToken, outputDirectory) {
  const samples = criteria.sample_matrix.map((entry) => sample(entry, runToken));
  const sourceBefore = await sourceSnapshot(samples, runToken);
  const infrastructureBeforeSetup = await infrastructureCount(database);
  const setup = await seedSamples(database, samples, runToken);
  const infrastructureBeforeOpening = await infrastructureCount(database);
  const beforeOpening = await snapshots(database, samples);

  const openingResults = [];
  for (const item of samples) {
    const request = openingRequest(item);
    const response = await roleQuery(database,
      'select row_to_json(result) value from organization.open_hosted_member_mall($1,$2,$3::jsonb) result',
      [item.membership_id, item.node_id, JSON.stringify(request)], `e07:opening:${item.node_id}`);
    openingResults.push(Object.freeze({ sample: item, request, response: response.rows[0]?.value ?? null }));
  }
  const afterOpening = await snapshots(database, samples);
  const infrastructureAfterOpening = await infrastructureCount(database);
  const implementationScan = await hostedOpeningImplementationScan();

  const upgradeResults = [];
  for (const item of samples.filter((entry) => entry.sovereign_upgrade)) {
    const request = upgradeRequest(item, runToken);
    const response = await roleQuery(database,
      'select row_to_json(result) value from organization.upgrade_hosted_mall_to_sovereign($1,$2,$3::jsonb) result',
      [item.membership_id, item.node_id, JSON.stringify(request)], `e07:upgrade:${item.node_id}`);
    upgradeResults.push(Object.freeze({ sample: item, request, response: response.rows[0]?.value ?? null }));
  }
  const afterUpgrade = await snapshots(database, samples);
  const upgradeEvidence = await Promise.all(upgradeResults.map(async (entry) => ({
    sample: entry.sample,
    request: entry.request,
    response: entry.response,
    ...(await upgradeRows(database, entry.sample.node_id)),
  })));

  const rollbackResults = [];
  for (const entry of upgradeResults) {
    const upgradeId = entry.response?.upgrade_id;
    if (!upgradeId) throw new Error(`E07_UPGRADE_ID_MISSING:${entry.sample.node_id}`);
    const response = await database.query('select organization.rollback_sovereign_upgrade($1,$2) value',
      [upgradeId, 'E07 disposable continuity cleanup']);
    rollbackResults.push(Object.freeze({ sample: entry.sample, upgrade_id: upgradeId, result: response.rows[0]?.value ?? null }));
  }
  const afterRollback = await snapshots(database, samples);
  const rollbackEvidence = await Promise.all(rollbackResults.map(async (entry) => ({
    ...entry,
    after_rollback: afterRollback.get(entry.sample.node_id),
    upgrade_rows: await upgradeRows(database, entry.sample.node_id),
  })));
  const sourceAfter = await sourceSnapshot(samples, runToken);
  const databaseRawRows = await continuityRawRows(database, samples);
  const capturedAt = new Date().toISOString();

  const openingArtifact = Object.freeze({
    schema_version: 'e07-mall-opening-lineage-before-after-v1',
    captured_at: capturedAt,
    samples: samples.map((item) => Object.freeze({
      sample: item,
      operation: openingResults.find((entry) => entry.sample.node_id === item.node_id),
      before: beforeOpening.get(item.node_id),
      after: afterOpening.get(item.node_id),
    })),
  });
  const infrastructureArtifact = Object.freeze({
    schema_version: 'e07-mall-opening-infra-counts-v1',
    captured_at: capturedAt,
    fixture_setup: {
      before_hosted_provisioning_rows: infrastructureBeforeSetup,
      after_hosted_provisioning_rows: infrastructureBeforeOpening,
      setup_provisioning_row_delta: infrastructureBeforeOpening - infrastructureBeforeSetup,
      setup_receipts: setup.sample_receipts,
      fixture_parent_receipts: setup.fixture_parent_receipts,
    },
    opening_observation: {
      before_hosted_provisioning_rows: infrastructureBeforeOpening,
      after_hosted_provisioning_rows: infrastructureAfterOpening,
      hosted_provisioning_row_delta: infrastructureAfterOpening - infrastructureBeforeOpening,
      external_infrastructure_calls: [],
      deployment_or_release_pointer_calls: [],
    },
    implementation_scan: implementationScan,
  });
  const timelineArtifact = Object.freeze({
    schema_version: 'e07-sovereign-upgrade-state-timeline-v1',
    captured_at: capturedAt,
    upgrades: upgradeEvidence.map((entry) => Object.freeze({
      sample: entry.sample,
      request: entry.request,
      response: entry.response,
      upgrade: entry.upgrade,
      sovereignty_versions: entry.sovereignty_versions,
      steps: entry.steps,
      relation_history: entry.relation_history,
    })),
  });
  const manifestArtifact = Object.freeze({
    schema_version: 'e07-sovereign-upgrade-manifest-pointers-v1',
    captured_at: capturedAt,
    resource_boundary: 'Synthetic non-production references persisted by the production upgrade transaction; no DNS, TLS, tunnel, runtime, secret or payment provider was called.',
    upgrades: upgradeEvidence.map((entry) => Object.freeze({
      sample: entry.sample,
      upgrade_id: entry.response?.upgrade_id ?? null,
      domain_binding_sets: entry.domain_binding_sets,
      domain_bindings: entry.domain_bindings,
      resource_binding_sets: entry.resource_binding_sets,
      manifests: entry.manifests,
    })),
  });
  const historyArtifact = Object.freeze({
    schema_version: 'e07-history-digests-v1',
    captured_at: capturedAt,
    digest_definition: 'SHA-256 over canonical node/Realm/Membership/account/principal identity, parent/original-parent/level/current lineage, initial relation, initial capability and Hosted provisioning rows. Lifecycle timestamps and allowed appended versions are excluded.',
    samples: samples.map((item) => Object.freeze({
      node_id: item.node_id,
      before_opening: historyObservation(beforeOpening.get(item.node_id)),
      after_opening: historyObservation(afterOpening.get(item.node_id)),
      after_upgrade: historyObservation(afterUpgrade.get(item.node_id)),
      after_rollback: historyObservation(afterRollback.get(item.node_id)),
    })),
  });
  const nonTargetArtifact = Object.freeze({
    schema_version: 'e07-nontarget-transition-diff-v1',
    captured_at: capturedAt,
    target_node_ids: samples.filter((entry) => entry.sovereign_upgrade).map((entry) => entry.node_id),
    non_target_node_ids: samples.filter((entry) => !entry.sovereign_upgrade).map((entry) => entry.node_id),
    comparisons: samples.map((item) => Object.freeze({
      node_id: item.node_id,
      role: item.sovereign_upgrade ? 'target' : 'non_target',
      before_upgrade: afterOpening.get(item.node_id),
      after_upgrade: afterUpgrade.get(item.node_id),
      before_upgrade_sha256: objectDigest(afterOpening.get(item.node_id)),
      after_upgrade_sha256: objectDigest(afterUpgrade.get(item.node_id)),
    })),
  });
  const sourceBuildArtifact = Object.freeze({
    schema_version: 'e07-source-build-counts-v1',
    captured_at: capturedAt,
    inventory_scope: { roots: SOURCE_ROOTS, extensions: [...SOURCE_EXTENSIONS].sort(), excluded_directories: [...EXCLUDED_DIRECTORIES].sort() },
    before: sourceBefore,
    after: sourceAfter,
    build_invocations: [],
    node_specific_builds: [],
  });
  const rollbackArtifact = Object.freeze({
    schema_version: 'e07-rollback-receipts-v1',
    captured_at: capturedAt,
    rollback_reason: 'E07 disposable continuity cleanup',
    receipts: rollbackEvidence,
    non_target_after_rollback: samples.filter((entry) => !entry.sovereign_upgrade).map((entry) => Object.freeze({
      node_id: entry.node_id,
      after_opening_sha256: objectDigest(afterOpening.get(entry.node_id)),
      after_rollback_sha256: objectDigest(afterRollback.get(entry.node_id)),
      after_rollback: afterRollback.get(entry.node_id),
    })),
  });
  const rawArtifact = Object.freeze({
    schema_version: 'e07-continuity-database-raw-rows-v1',
    captured_at: capturedAt,
    ...databaseRawRows,
  });

  await Promise.all([
    writeJson(join(outputDirectory, 'mall-opening-lineage-before-after.json'), openingArtifact),
    writeJson(join(outputDirectory, 'mall-opening-infra-counts.json'), infrastructureArtifact),
    writeJson(join(outputDirectory, 'sovereign-upgrade-state-timeline.json'), timelineArtifact),
    writeJson(join(outputDirectory, 'sovereign-upgrade-manifest-pointers.json'), manifestArtifact),
    writeJson(join(outputDirectory, 'history-digests.json'), historyArtifact),
    writeJson(join(outputDirectory, 'nontarget-transition-diff.json'), nonTargetArtifact),
    writeJson(join(outputDirectory, 'source-build-counts.json'), sourceBuildArtifact),
    writeJson(join(outputDirectory, 'rollback-receipts.json'), rollbackArtifact),
    writeJson(join(outputDirectory, 'continuity-database-raw-rows.json'), rawArtifact),
  ]);

  return Object.freeze({
    sample_count: samples.length,
    opening_count: openingResults.length,
    sovereign_upgrade_count: upgradeResults.length,
    rollback_count: rollbackResults.length,
    non_target_count: samples.filter((entry) => !entry.sovereign_upgrade).length,
    source_file_count: sourceBefore.entries.length,
    source_inventory_digest: sourceBefore.inventory_sha256,
  });
}

function sample(entry, runToken) {
  const level = Number(String(entry.signed_level).slice(1));
  const key = `${runToken}-l${level}`;
  return Object.freeze({
    signed_level: entry.signed_level,
    opening: entry.opening,
    sovereign_upgrade: entry.sovereign_upgrade,
    key,
    node_id: `node:e07-${key}:l${level}`,
    realm_id: `realm:e07-${key}`,
    principal_id: `principal:e07-${key}`,
    account_id: `account:e07-${key}`,
    member_id: `member:e07-${key}`,
    membership_id: `membership:e07-${key}`,
  });
}

async function seedSamples(database, samples, runToken) {
  const root = await database.query("select id,line_id from organization.node where id='node:zhudatuan:l0'");
  const rootNode = root.rows[0];
  if (!rootNode) throw new Error('E07_FIXTURE_ROOT_MISSING');
  const effectiveAt = new Date().toISOString();
  const sampleReceipts = [];
  const fixtureParentReceipts = [];
  const fixtureParents = [6, 7, 8, 9, 10].map((level) => Object.freeze({
    level,
    node_id: `node:e07-${runToken}-parent:l${level}`,
    realm_id: `realm:e07-${runToken}-parent-l${level}`,
  }));
  await database.query('begin');
  try {
    await database.query('set constraints all deferred');
    for (const parent of fixtureParents) {
      await database.query(`insert into identity.realm(
        id,node_id,status,created_at,updated_at,version,node_profile,mall_id,host_node_id,host_node_profile
      ) values($1,$2,'active',clock_timestamp(),clock_timestamp(),0,'consumer',null,$3,'operating_mall')`,
      [parent.realm_id, parent.node_id, rootNode.id]);
      const request = {
        idempotency_key: `seed:e07:${runToken}:parent-l${parent.level}`,
        node_id: parent.node_id,
        parent_node_id: parent.level === 6 ? rootNode.id : fixtureParents.find((entry) => entry.level === parent.level - 1).node_id,
        realm_id: parent.realm_id,
        node_profile: 'consumer',
        mall_id: null,
        signed_level: `L${parent.level}`,
        effective_at: effectiveAt,
        requested_by: 'e07-formal-fixture',
        trace_id: `e07:seed:parent-l${parent.level}`,
      };
      const provisioned = await database.query(
        'select row_to_json(result) value from organization.provision_hosted_node($1::jsonb) result', [JSON.stringify(request)]);
      fixtureParentReceipts.push(Object.freeze({ fixture_parent: parent, request, response: provisioned.rows[0]?.value ?? null }));
    }
    for (const item of samples) {
      await database.query(`insert into identity.realm(
      id,node_id,status,created_at,updated_at,version,node_profile,mall_id,host_node_id,host_node_profile
    ) values($1,$2,'active',clock_timestamp(),clock_timestamp(),0,'consumer',null,$3,'operating_mall')`,
      [item.realm_id, item.node_id, rootNode.id]);
      const request = {
        idempotency_key: `seed:${item.key}`,
        node_id: item.node_id,
        parent_node_id: item.signed_level === 'L8'
          ? fixtureParents.find((entry) => entry.level === 7).node_id
          : item.signed_level === 'L11' ? fixtureParents.find((entry) => entry.level === 10).node_id : rootNode.id,
        realm_id: item.realm_id,
        node_profile: 'consumer',
        mall_id: null,
        signed_level: item.signed_level,
        effective_at: effectiveAt,
        requested_by: 'e07-formal-fixture',
        trace_id: `e07:seed:${item.key}`,
      };
      const provisioned = await database.query('select row_to_json(result) value from organization.provision_hosted_node($1::jsonb) result',
        [JSON.stringify(request)]);
      await database.query(`insert into identity.principal(id,status,credential_version,created_at,updated_at)
      values($1,'active',1,clock_timestamp(),clock_timestamp())`, [item.principal_id]);
      await database.query(`insert into identity.account(
      id,realm_id,legacy_principal_id,status,credential_version,assurance_level,created_at,updated_at
    ) values($1,$2,$3,'active',1,2,clock_timestamp(),clock_timestamp())`, [item.account_id, item.realm_id, item.principal_id]);
      await database.query(`insert into identity.credential(
      id,principal_id,provider,subject_hash,secret_hash,status,created_at,realm_id,account_id
    ) values($1,$2,'password',$3,$4,'active',clock_timestamp(),$5,$6)`, [`credential:e07-${item.key}`, item.principal_id,
        digest(`subject:${item.key}`), `fixture-hash:${item.key}`, item.realm_id, item.account_id]);
      await database.query(`insert into member.profile(id,principal_id,display_name,status,created_at,updated_at)
      values($1,$2,$3,'active',clock_timestamp(),clock_timestamp())`, [item.member_id, item.principal_id, `E07 ${item.signed_level}`]);
      await database.query(`insert into access.membership(
      id,member_id,organization_id,client,status,access_version,joined_at
    ) values($1,$2,'mall-zhudatuan','storefront','active',1,clock_timestamp())`, [item.membership_id, item.member_id]);
      await database.query(`update access.membership set realm_id=$2,account_id=$3,node_profile='consumer' where id=$1`,
        [item.membership_id, item.realm_id, item.account_id]);
      await database.query(`insert into identity.realmtarget(
      realm_id,surface,target,membership_client,membership_organization_id,application_slug,return_origin,created_at,node_profile
    ) values($1,'consumer',$2,'storefront','mall-zhudatuan',$3,$4,clock_timestamp(),'consumer')`, [item.realm_id,
        `storefront-e07-${item.key}`, `e07-${item.key}`, `https://${item.key}.e07.test`]);
      sampleReceipts.push(Object.freeze({ sample: item, request, response: provisioned.rows[0]?.value ?? null }));
    }
    await database.query('commit');
  } catch (cause) {
    await database.query('rollback');
    throw cause;
  }
  return Object.freeze({ sample_receipts: sampleReceipts, fixture_parent_receipts: fixtureParentReceipts });
}

function openingRequest(item) {
  return Object.freeze({
    idempotency_key: `opening:e07:${item.key}`,
    mall_name: `E07 ${item.signed_level} Mall`,
    operating_entity_name: `E07 ${item.signed_level} Operating Entity`,
  });
}

function upgradeRequest(item, runToken) {
  const hostToken = `${item.key}.${runToken}.e07.test`;
  return Object.freeze({
    idempotency_key: `sovereign-upgrade:e07:${item.key}`,
    brand_ref: `brand:e07:${item.key}:v1`,
    public_api_host: `api.${hostToken}`,
    storefront_host: `shop.${hostToken}`,
    accounts_host: `accounts.${hostToken}`,
    console_host: `console.${hostToken}`,
    payment_callback_host: `pay.${hostToken}`,
    edge_binding_ref: `edge:e07:${item.key}:v1`,
    tunnel_ref: `tunnel:e07:${item.key}:v1`,
    gateway_ref: `gateway:e07:${item.key}:v1`,
    runtime_identity_ref: `runtime:e07:${item.key}:v1`,
    data_scope_ref: `scope:e07:${item.key}:v1`,
    secret_binding_set_ref: `secrets:e07:${item.key}:v1`,
    payment_binding_ref: `payment:e07:${item.key}:v1`,
    callback_binding_ref: `callback:e07:${item.key}:v1`,
    runtime_config_ref: `runtime-config:e07:${item.key}:v1`,
  });
}

async function roleQuery(database, sql, values, trace) {
  await database.query('begin');
  try {
    await database.query('set local role zhudatuanwebapi');
    await database.query("select set_config('request.trace_id',$1,true)", [trace]);
    const result = await database.query(sql, values);
    await database.query('commit');
    return result;
  } catch (cause) {
    await database.query('rollback');
    throw cause;
  }
}

async function snapshots(database, samples) {
  return new Map(await Promise.all(samples.map(async (item) => [item.node_id, await nodeSnapshot(database, item)])));
}

async function nodeSnapshot(database, item) {
  const [context, relations, closure, capabilities, provisioning, openings, upgrades, changes, outbox] = await Promise.all([
    database.query(`select node.id node_id,node.line_id,node.realm_id,node.sovereignty_tier,node.node_profile,node.mall_id,node.status,
      relation.parent_node_id,relation.original_parent_node_id,relation.signed_level,relation.host_sovereign_node_id,
      relation.relation_version,realm.node_profile realm_node_profile,realm.mall_id realm_mall_id,
      realm.host_node_id realm_host_node_id,realm.host_node_profile realm_host_node_profile,realm.version realm_version,
      membership.id membership_id,membership.account_id,membership.node_profile membership_node_profile,
      account.legacy_principal_id principal_id,account.status account_status,principal.status principal_status
    from organization.node node
    join organization.noderelation relation on relation.line_id=node.line_id and relation.node_id=node.id and relation.superseded_at is null
    join identity.realm realm on realm.id=node.realm_id
    join access.membership membership on membership.id=$2 and membership.realm_id=realm.id
    join identity.account account on account.id=membership.account_id and account.realm_id=realm.id
    join identity.principal principal on principal.id=account.legacy_principal_id
    where node.id=$1`, [item.node_id, item.membership_id]),
    database.query(`select line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
      relation_version,effective_at,superseded_at from organization.noderelation where node_id=$1 order by relation_version`, [item.node_id]),
    database.query(`select line_id,ancestor_node_id,descendant_node_id,depth,descendant_relation_version,effective_at,superseded_at
      from organization.nodeclosure where descendant_node_id=$1 and superseded_at is null order by depth desc`, [item.node_id]),
    database.query(`select node_id,line_id,capability_version,capabilities,prior_node_profile,node_profile,relation_version,
      source_operation_id,opening_id,effective_at,created_at from organization.nodecapabilityversion where node_id=$1
      order by capability_version`, [item.node_id]),
    database.query(`select idempotency_key,request_hash,node_id,line_id,realm_id,node_profile,
      mall_id,parent_node_id,signed_level,host_sovereign_node_id,relation_version,
      effective_at,requested_by,trace_id,created_at from organization.hostednodeprovisioning where node_id=$1`, [item.node_id]),
    database.query('select * from organization.hostedmallopening where node_id=$1 order by opened_at', [item.node_id]),
    database.query('select * from organization.sovereignupgrade where node_id=$1 order by upgraded_at', [item.node_id]),
    database.query(`select change.* from organization.change change where change.actor_id=$2
      or change.organization_id in(select mall_id from organization.hostedmallopening where node_id=$1) order by change.occurred_at,change.id`,
    [item.node_id, item.principal_id]),
    database.query(`select * from runtime.outbox where aggregate_id=$1 or payload->>'node_id'=$1 order by occurred_at,id`, [item.node_id]),
  ]);
  const row = context.rows[0];
  if (!row) throw new Error(`E07_NODE_CONTEXT_MISSING:${item.node_id}`);
  return Object.freeze({
    context: row,
    current_lineage: closure.rows.map((entry) => entry.ancestor_node_id),
    relation_history: relations.rows,
    current_closure: closure.rows,
    capability_history: capabilities.rows,
    provisioning_history: provisioning.rows,
    opening_history: openings.rows,
    upgrade_history: upgrades.rows,
    change_history: changes.rows,
    outbox_history: outbox.rows,
  });
}

async function upgradeRows(database, nodeId) {
  const upgrade = await database.query('select * from organization.sovereignupgrade where node_id=$1 order by upgraded_at', [nodeId]);
  const upgradeIds = upgrade.rows.map((entry) => entry.upgrade_id);
  const [sovereignty, steps, bindingSets, bindings, resources, manifests, relations] = await Promise.all([
    database.query('select * from organization.nodesovereigntyversion where node_id=$1 order by sovereignty_version', [nodeId]),
    database.query(`select step.* from organization.sovereignupgradestep step where step.upgrade_id=any($1::text[])
      order by step.upgrade_id,step.ordinal`, [upgradeIds]),
    database.query('select * from organization.domainbindingset where node_id=$1 order by binding_version', [nodeId]),
    database.query(`select binding.* from organization.domainbinding binding join organization.domainbindingset binding_set
      using(binding_set_id,binding_version) where binding_set.node_id=$1 order by binding.surface`, [nodeId]),
    database.query('select * from organization.noderesourcebindingset where node_id=$1 order by resource_binding_version', [nodeId]),
    database.query(`select manifest.*,manifest.manifest->'release_pointer_ref' release_pointer_ref,
      'sha256:'||encode(public.digest(convert_to(manifest.manifest::text,'UTF8'),'sha256'),'hex') recomputed_manifest_digest
      from organization.nodemanifestversion manifest where node_id=$1 order by manifest_version`, [nodeId]),
    database.query(`select line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
      relation_version,effective_at,superseded_at from organization.noderelation where node_id=$1 order by relation_version`, [nodeId]),
  ]);
  return Object.freeze({
    upgrade: upgrade.rows,
    sovereignty_versions: sovereignty.rows,
    steps: steps.rows,
    domain_binding_sets: bindingSets.rows,
    domain_bindings: bindings.rows,
    resource_binding_sets: resources.rows,
    manifests: manifests.rows,
    relation_history: relations.rows,
  });
}

function historyObservation(snapshot) {
  const anchor = historyAnchor(snapshot);
  const identityLineage = identityLineageAnchor(snapshot);
  return Object.freeze({
    identity_lineage: identityLineage,
    identity_lineage_sha256: objectDigest(identityLineage),
    immutable_history: anchor,
    immutable_history_sha256: objectDigest(anchor),
  });
}

function identityLineageAnchor(snapshot) {
  const context = snapshot.context;
  return Object.freeze({
    node_id: context.node_id,
    line_id: context.line_id,
    realm_id: context.realm_id,
    parent_node_id: context.parent_node_id,
    original_parent_node_id: context.original_parent_node_id,
    signed_level: context.signed_level,
    membership_id: context.membership_id,
    account_id: context.account_id,
    principal_id: context.principal_id,
    lineage: snapshot.current_lineage,
  });
}

function historyAnchor(snapshot) {
  const baselineRelation = snapshot.relation_history.find((entry) => Number(entry.relation_version) === 1);
  const baselineCapability = snapshot.capability_history.find((entry) => Number(entry.capability_version) === 1);
  return Object.freeze({
    identity: identityLineageAnchor(snapshot),
    baseline_relation: baselineRelation ? pick(baselineRelation, ['line_id', 'node_id', 'parent_node_id', 'original_parent_node_id',
      'signed_level', 'host_sovereign_node_id', 'relation_version', 'effective_at']) : null,
    baseline_capability: baselineCapability ? pick(baselineCapability, ['node_id', 'line_id', 'capability_version', 'capabilities',
      'prior_node_profile', 'node_profile', 'relation_version', 'source_operation_id', 'opening_id', 'effective_at', 'created_at']) : null,
    hosted_provisioning: snapshot.provisioning_history.map((entry) => pick(entry, ['idempotency_key', 'request_hash', 'node_id',
      'line_id', 'realm_id', 'node_profile', 'mall_id', 'parent_node_id', 'signed_level', 'host_sovereign_node_id',
      'relation_version', 'effective_at', 'requested_by', 'trace_id', 'created_at'])),
  });
}

async function hostedOpeningImplementationScan() {
  const paths = [
    '02_platform_pingtai/database/supabase/migrations/20260912040000_create_sfl_hosted_mall_opening.sql',
    '01_core_hexin/services/commerce/src/modules/member/01_public_gongkai/MemberPort.ts',
    '01_core_hexin/services/commerce/src/modules/member/03_application_yingyong/HostedMallOpeningOperation.ts',
    '01_core_hexin/services/commerce/src/modules/member/03_application_yingyong/MemberOperations.ts',
  ];
  const forbiddenPattern = /NodeManifest|Domain Binding Set|\bDNS\b|\bTLS\b|\bTunnel\b|runtime_instance|release_pointer|systemd|rsync|deploy|provision_hosted_node\s*\(/gi;
  const files = await Promise.all(paths.map(async (path) => {
    const source = await readFile(join(repositoryRoot, path), 'utf8');
    return Object.freeze({
      path,
      sha256: `sha256:${digest(source)}`,
      forbidden_infrastructure_references: [...new Set(source.match(forbiddenPattern) ?? [])].sort(),
      shared_host_marker_present: source.includes('host_sovereign_node_id'),
      shared_infrastructure_mode_present: source.includes("infrastructure_mode='shared_host'") || source.includes('shared_host'),
    });
  }));
  return Object.freeze({ files });
}

async function infrastructureCount(database) {
  const result = await database.query('select count(*)::integer value from organization.hostednodeprovisioning');
  return Number(result.rows[0]?.value ?? 0);
}

async function sourceSnapshot(samples, runToken) {
  const paths = [];
  for (const root of SOURCE_ROOTS) await collectFiles(join(repositoryRoot, root), paths);
  paths.sort((left, right) => left.localeCompare(right));
  const tokens = [runToken, ...samples.map((entry) => entry.node_id)];
  const entries = await Promise.all(paths.map(async (path) => {
    const bytes = await readFile(path);
    const repositoryPath = relative(repositoryRoot, path).replaceAll('\\', '/');
    const text = bytes.toString('utf8');
    const matches = tokens.filter((token) => repositoryPath.includes(token) || text.includes(token));
    return Object.freeze({ path: repositoryPath, size_bytes: bytes.byteLength, sha256: `sha256:${digest(bytes)}`,
      node_specific_tokens: matches });
  }));
  return Object.freeze({
    file_count: entries.length,
    inventory_sha256: inventoryDigest(entries),
    node_specific_file_count: entries.filter((entry) => entry.node_specific_tokens.length > 0).length,
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

async function continuityRawRows(database, samples) {
  const nodeIds = samples.map((entry) => entry.node_id);
  const membershipIds = samples.map((entry) => entry.membership_id);
  const realmIds = samples.map((entry) => entry.realm_id);
  const principalIds = samples.map((entry) => entry.principal_id);
  const accountIds = samples.map((entry) => entry.account_id);
  const [nodes, relations, closure, realms, memberships, accounts, principals, capabilities, provisioning, openings,
    configurations, entityBindings, upgrades, sovereignty, domainSets, domains, resources, manifests, steps, outbox] = await Promise.all([
    rows(database, 'select * from organization.node where id=any($1::text[]) order by id', [nodeIds]),
    rows(database, 'select * from organization.noderelation where node_id=any($1::text[]) order by node_id,relation_version', [nodeIds]),
    rows(database, `select * from organization.nodeclosure where descendant_node_id=any($1::text[])
      order by descendant_node_id,descendant_relation_version,depth`, [nodeIds]),
    rows(database, 'select * from identity.realm where id=any($1::text[]) order by id', [realmIds]),
    rows(database, 'select * from access.membership where id=any($1::text[]) order by id', [membershipIds]),
    rows(database, 'select * from identity.account where id=any($1::text[]) order by id', [accountIds]),
    rows(database, 'select * from identity.principal where id=any($1::text[]) order by id', [principalIds]),
    rows(database, 'select * from organization.nodecapabilityversion where node_id=any($1::text[]) order by node_id,capability_version', [nodeIds]),
    rows(database, 'select * from organization.hostednodeprovisioning where node_id=any($1::text[]) order by node_id', [nodeIds]),
    rows(database, 'select * from organization.hostedmallopening where node_id=any($1::text[]) order by node_id', [nodeIds]),
    rows(database, 'select * from organization.hostedmallconfiguration where node_id=any($1::text[]) order by node_id', [nodeIds]),
    rows(database, 'select * from organization.malloperatingentitybinding where node_id=any($1::text[]) order by node_id', [nodeIds]),
    rows(database, 'select * from organization.sovereignupgrade where node_id=any($1::text[]) order by node_id', [nodeIds]),
    rows(database, 'select * from organization.nodesovereigntyversion where node_id=any($1::text[]) order by node_id,sovereignty_version', [nodeIds]),
    rows(database, 'select * from organization.domainbindingset where node_id=any($1::text[]) order by node_id,binding_version', [nodeIds]),
    rows(database, `select binding.* from organization.domainbinding binding join organization.domainbindingset binding_set
      using(binding_set_id,binding_version) where binding_set.node_id=any($1::text[]) order by binding_set.node_id,binding.surface`, [nodeIds]),
    rows(database, 'select * from organization.noderesourcebindingset where node_id=any($1::text[]) order by node_id,resource_binding_version', [nodeIds]),
    rows(database, `select manifest.*,manifest.manifest->'release_pointer_ref' release_pointer_ref,
      'sha256:'||encode(public.digest(convert_to(manifest.manifest::text,'UTF8'),'sha256'),'hex') recomputed_manifest_digest
      from organization.nodemanifestversion manifest where node_id=any($1::text[]) order by node_id,manifest_version`, [nodeIds]),
    rows(database, `select step.* from organization.sovereignupgradestep step join organization.sovereignupgrade upgrade using(upgrade_id)
      where upgrade.node_id=any($1::text[]) order by upgrade.node_id,step.ordinal`, [nodeIds]),
    rows(database, `select * from runtime.outbox where aggregate_id=any($1::text[]) or payload->>'node_id'=any($1::text[])
      order by aggregate_id,event_type,id`, [nodeIds]),
  ]);
  return Object.freeze({ nodes, relations, closure, realms, memberships, accounts, principals, capabilities, provisioning,
    openings, configurations, entity_bindings: entityBindings, upgrades, sovereignty_versions: sovereignty,
    domain_binding_sets: domainSets, domain_bindings: domains, resource_binding_sets: resources, manifests, upgrade_steps: steps, outbox });
}

async function rows(database, sql, values) {
  return (await database.query(sql, values)).rows;
}

function pick(value, keys) {
  return Object.fromEntries(keys.map((key) => [key, value?.[key] ?? null]));
}

function objectDigest(value) {
  return `sha256:${digest(canonical(value))}`;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function writeJson(path, value) {
  return writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}
