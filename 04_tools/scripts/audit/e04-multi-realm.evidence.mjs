import { createHash, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const AUTHORIZATION_OPERATION = 'access.scopes.manage';
const AUTHORIZATION_PERMISSION = 'access.scope.manage';

export async function executeE04MultiRealm(database, criteria, runToken, outputDirectory) {
  if (criteria.claim_id !== 'E2-ID-001' || criteria.legacy_trace_id !== 'E04') {
    throw new Error('E04_CRITERIA_IDENTITY_INVALID');
  }
  if (criteria.realm_matrix?.length !== 3 || criteria.negative_matrix?.expected_observation_count !== 48) {
    throw new Error('E04_CRITERIA_MATRIX_INVALID');
  }

  const fixtureBefore = await snapshotState(database, runToken);
  let fixture;
  let discovery;
  let identityMap;
  let positiveCases;
  let transitions;
  let negativeCases;
  let beforeNegative;
  let afterNegative;
  await database.query('begin');
  try {
    await database.query('set constraints all deferred');
    fixture = await seedFixture(database, runToken);
    discovery = await collectCredentialDiscovery(database, fixture);
    identityMap = await collectIdentityMap(database, fixture, discovery);
    positiveCases = await executePositiveCases(database, fixture);
    transitions = await executeTransitions(database, fixture);
    beforeNegative = await snapshotState(database, runToken);
    negativeCases = await executeNegativeMatrix(database, fixture, transitions);
    afterNegative = await snapshotState(database, runToken);
    await database.query('commit');
  } catch (cause) {
    await database.query('rollback');
    throw cause;
  }

  const capturedAt = new Date().toISOString();
  const identityArtifact = Object.freeze({
    schema_version: 'e04-multi-realm-identity-map-v1',
    captured_at: capturedAt,
    credential_ref: `credential:experiment:shared:${runToken}`,
    shared_subject_hash: fixture.shared_subject_hash,
    discovery,
    realms: identityMap,
  });
  const positiveArtifact = Object.freeze({
    schema_version: 'e04-multi-realm-positive-results-v1',
    captured_at: capturedAt,
    authority_boundary: authorityBoundary(),
    cases: positiveCases,
  });
  const transitionArtifact = Object.freeze({
    schema_version: 'e04-multi-realm-session-transitions-v1',
    captured_at: capturedAt,
    directed_pairs: transitions,
  });
  const negativeArtifact = Object.freeze({
    schema_version: 'e04-multi-realm-negative-results-v1',
    captured_at: capturedAt,
    authority_boundary: authorityBoundary(),
    dimensions: {
      realm_labels: fixture.realms.map(({ label }) => label),
      misuse_variants: criteria.negative_matrix.misuse_variants,
      operation_kinds: criteria.negative_matrix.operation_kinds,
    },
    observations: negativeCases,
  });
  const databaseArtifact = Object.freeze({
    schema_version: 'e04-multi-realm-database-diff-v1',
    captured_at: capturedAt,
    observation_scope: 'Synthetic E04 rows in production tables plus matching runtime.outbox trace rows.',
    fixture_before: fixtureBefore,
    established_before_negative_matrix: beforeNegative,
    after_negative_matrix: afterNegative,
    negative_matrix_diff: diffSnapshots(beforeNegative, afterNegative),
  });
  await Promise.all([
    writeJson(join(outputDirectory, 'multi-realm-identity-map.json'), identityArtifact),
    writeJson(join(outputDirectory, 'multi-realm-positive-results.json'), positiveArtifact),
    writeJson(join(outputDirectory, 'multi-realm-session-transitions.json'), transitionArtifact),
    writeJson(join(outputDirectory, 'multi-realm-negative-results.json'), negativeArtifact),
    writeJson(join(outputDirectory, 'multi-realm-database-diff.json'), databaseArtifact),
  ]);

  return Object.freeze({
    realm_count: fixture.realms.length,
    discovery_positive_count: discovery.positive_cases.length,
    discovery_cross_count: discovery.cross_realm_cases.length,
    positive_case_count: positiveCases.length,
    transition_count: transitions.length,
    negative_observation_count: negativeCases.length,
    run_token: runToken,
  });
}

async function seedFixture(database, runToken) {
  const root = (await database.query(`select node.id,node.line_id,node.realm_id,node.node_profile,node.mall_id
    from organization.node node where node.id='node:zhudatuan:l0'`)).rows[0];
  if (!root) throw new Error('E04_ROOT_NODE_MISSING');

  const organizationB = `mall:e04b-${runToken}`;
  const organizationC = `mall:e04c-${runToken}`;
  const bRoot = Object.freeze({
    realm_id: `realm:e04b-root-${runToken}`,
    node_id: `node:e04b-root-${runToken}:l0`,
    line_id: `line:e04b-${runToken}:v1`,
  });
  const bParent = Object.freeze({
    realm_id: `realm:e04b-parent-${runToken}`,
    node_id: `node:e04b-parent-${runToken}:l7`,
  });
  const sharedSubjectHash = sha256(`e04-shared-subject:${runToken}`);
  const realms = [
    realmFixture('A', runToken, {
      realm_id: `realm:e04a-${runToken}`,
      node_id: `node:e04a-${runToken}:l6`,
      line_id: root.line_id,
      parent_node_id: root.id,
      signed_level: 'L6',
      host_sovereign_node_id: root.id,
      node_profile: 'consumer',
      membership_client: 'storefront',
      organization_id: root.mall_id,
      auth_target: `e04-a-${runToken}`,
      surface: 'consumer',
      application_slug: `e04-a-${runToken}`,
    }),
    realmFixture('B', runToken, {
      realm_id: `realm:e04b-${runToken}`,
      node_id: `node:e04b-${runToken}:l8`,
      line_id: bRoot.line_id,
      parent_node_id: bParent.node_id,
      signed_level: 'L8',
      host_sovereign_node_id: bRoot.node_id,
      node_profile: 'consumer',
      membership_client: 'storefront',
      organization_id: organizationB,
      auth_target: `e04-b-${runToken}`,
      surface: 'consumer',
      application_slug: `e04-b-${runToken}`,
    }),
    realmFixture('C', runToken, {
      realm_id: `realm:e04c-${runToken}`,
      node_id: `node:e04c-${runToken}:l0`,
      line_id: `line:e04c-${runToken}:v1`,
      parent_node_id: null,
      signed_level: 'L0',
      host_sovereign_node_id: `node:e04c-${runToken}:l0`,
      node_profile: 'operating_mall',
      membership_client: 'operator',
      organization_id: organizationC,
      auth_target: `e04-c-${runToken}`,
      surface: 'admin',
      application_slug: null,
    }),
  ];

  for (const [id, name] of [[organizationB, 'E04 Realm B Mall'], [organizationC, 'E04 Realm C Mall']]) {
    await database.query(`insert into organization.organization(
      id,kind,parent_id,name,timezone,status,version,created_at,updated_at
    ) values($1,'mall','enterprise-zhudatuan',$2,'Asia/Shanghai','active',1,clock_timestamp(),clock_timestamp())`, [id, name]);
  }

  await insertRealm(database, {
    realm_id: bRoot.realm_id, node_id: bRoot.node_id, node_profile: 'operating_mall', mall_id: organizationB,
    host_node_id: null,
  });
  await insertRealm(database, {
    realm_id: bParent.realm_id, node_id: bParent.node_id, node_profile: 'consumer', mall_id: null,
    host_node_id: bRoot.node_id,
  });
  for (const item of realms) {
    await insertRealm(database, {
      realm_id: item.realm_id,
      node_id: item.node_id,
      node_profile: item.node_profile,
      mall_id: item.node_profile === 'operating_mall' ? item.organization_id : null,
      host_node_id: item.label === 'A' ? root.id : item.label === 'B' ? bRoot.node_id : null,
    });
  }

  const nodes = [
    { node_id: bRoot.node_id, line_id: bRoot.line_id, tier: 'sovereign', profile: 'operating_mall', realm_id: bRoot.realm_id, mall_id: organizationB },
    { node_id: bParent.node_id, line_id: bRoot.line_id, tier: 'hosted', profile: 'consumer', realm_id: bParent.realm_id, mall_id: null },
    ...realms.map((item) => ({
      node_id: item.node_id,
      line_id: item.line_id,
      tier: item.signed_level === 'L0' ? 'sovereign' : 'hosted',
      profile: item.node_profile,
      realm_id: item.realm_id,
      mall_id: item.node_profile === 'operating_mall' ? item.organization_id : null,
    })),
  ];
  for (const node of nodes) {
    await database.query(`insert into organization.node(
      id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at
    ) values($1,$2,$3,$4,$5,$6,'active',clock_timestamp(),clock_timestamp())`,
    [node.node_id, node.line_id, node.tier, node.profile, node.realm_id, node.mall_id]);
  }
  const relations = [
    { line_id: bRoot.line_id, node_id: bRoot.node_id, parent: null, level: 'L0', host: bRoot.node_id },
    { line_id: bRoot.line_id, node_id: bParent.node_id, parent: bRoot.node_id, level: 'L7', host: bRoot.node_id },
    ...realms.map((item) => ({
      line_id: item.line_id,
      node_id: item.node_id,
      parent: item.parent_node_id,
      level: item.signed_level,
      host: item.host_sovereign_node_id,
    })),
  ];
  for (const relation of relations) {
    await database.query(`insert into organization.noderelation(
      line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
      relation_version,effective_at
    ) values($1,$2,$3,$3,$4,$5,1,clock_timestamp())`,
    [relation.line_id, relation.node_id, relation.parent, relation.level, relation.host]);
  }

  for (const item of realms) {
    await database.query(`insert into identity.realmentry(host,realm_id,kind,status,created_at)
      values($1,$2,'accounts','active',clock_timestamp())`, [item.accounts_host, item.realm_id]);
    await database.query(`insert into identity.realmtarget(
      realm_id,surface,target,membership_client,membership_organization_id,application_slug,
      return_origin,created_at,node_profile
    ) values($1,$2,$3,$4,$5,$6,$7,clock_timestamp(),$8)`, [
      item.realm_id, item.surface, item.auth_target, item.membership_client, item.organization_id,
      item.application_slug, item.return_origin, item.node_profile,
    ]);
    await database.query(`insert into identity.principal(
      id,status,credential_version,created_at,updated_at
    ) values($1,'active',1,clock_timestamp(),clock_timestamp())`, [item.principal_id]);
    await database.query(`insert into identity.account(
      id,realm_id,legacy_principal_id,status,credential_version,assurance_level,created_at,updated_at,
      mobile_ciphertext,mobile_token,mobile_masked,phone_verified_at
    ) values($1,$2,$3,'active',1,$4,clock_timestamp(),clock_timestamp(),$5,$6,'+86 138****8000',clock_timestamp())`,
    [item.account_id, item.realm_id, item.principal_id, item.label === 'C' ? 3 : 2,
      `synthetic-mobile-${item.label}-${runToken}`, sharedSubjectHash]);
    await database.query(`insert into identity.credential(
      id,principal_id,provider,subject_hash,secret_hash,status,created_at,realm_id,account_id
    ) values($1,$2,'password',$3,$4,'active',clock_timestamp(),$5,$6)`,
    [item.credential_id, item.principal_id, sharedSubjectHash,
      `synthetic-secret-hash-${item.label}-${runToken}`, item.realm_id, item.account_id]);
    await database.query(`insert into member.profile(
      id,principal_id,display_name,status,created_at,updated_at
    ) values($1,$2,$3,'active',clock_timestamp(),clock_timestamp())`,
    [item.member_id, item.principal_id, `E04 Realm ${item.label}`]);
    await database.query(`insert into access.membership(
      id,member_id,organization_id,client,status,access_version,joined_at,realm_id,account_id,node_profile
    ) values($1,$2,$3,$4,'active',1,clock_timestamp(),$5,$6,$7)`,
    [item.membership_id, item.member_id, item.organization_id, item.membership_client,
      item.realm_id, item.account_id, item.node_profile]);
    await database.query(`insert into access.role(id,scope_id,name,status,version)
      values($1,$2,$3,'active',1)`, [item.role_id, item.organization_id, `E04 Realm ${item.label} Scope Manager`]);
    await database.query(`insert into access.rolepermission(role_id,permission_id,effect)
      select $1,id,'allow' from access.permission where code=$2`, [item.role_id, AUTHORIZATION_PERMISSION]);
    await database.query(`insert into access.membershiprole(membership_id,role_id,effective_at)
      values($1,$2,clock_timestamp())`, [item.membership_id, item.role_id]);
    await database.query(`insert into access.scopegrant(
      id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version
    ) values($1,$2,'mall',$3,$3,'allow',clock_timestamp(),1)`,
    [item.scope_grant_id, item.membership_id, item.organization_id]);
    await database.query(`insert into identity.session(
      id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,
      user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at,realm_id,account_id,auth_target
    ) values($1,$2,$3,$4,1,1,$5,$6,$7,'e04-base',1,clock_timestamp()+interval '1 hour',
      clock_timestamp(),clock_timestamp(),$8,$9,$10)`, [
      item.base_session_id, item.principal_id, item.membership_id, item.base_token_hash,
      item.membership_client, sha256(`e04-ip:${item.label}:${runToken}`), `e04-base-${item.label}`,
      item.realm_id, item.account_id, item.auth_target,
    ]);
    await database.query(`insert into ordering.orderrecord(
      id,order_number,scope_id,member_id,mall_id,checkout_id,currency,total_minor,payment_state,
      fulfillment_state,aftersale_state,lifecycle_state,evidence,created_at,updated_at,version,
      operating_node_id,operating_line_id,participant_node_id,participant_membership_id,
      participant_realm_id,participant_account_id,participant_snapshot
    ) values($1,$2,$3,$4,$3,$5,'CNY',100,'unpaid','unallocated','none','created',$6,
      clock_timestamp(),clock_timestamp(),1,$7,$8,$7,$9,$10,$11,$12)`, [
      item.asset_id, item.order_number, item.organization_id, item.member_id, item.checkout_id,
      { fixture: 'E04', realm: item.label }, item.node_id, item.line_id, item.membership_id,
      item.realm_id, item.account_id, { realm: item.label, synthetic: true },
    ]);
  }
  return Object.freeze({ run_token: runToken, shared_subject_hash: sharedSubjectHash, realms: Object.freeze(realms) });
}

function realmFixture(label, runToken, input) {
  const lower = label.toLowerCase();
  return Object.freeze({
    label,
    ...input,
    accounts_host: `accounts.e04${lower}-${runToken}.test`,
    return_origin: `https://e04${lower}-${runToken}.test`,
    principal_id: `principal:e04${lower}:${runToken}`,
    account_id: `account:e04${lower}:${runToken}`,
    credential_id: `credential:e04${lower}:${runToken}`,
    member_id: `member:e04${lower}:${runToken}`,
    membership_id: `membership:e04${lower}:${runToken}`,
    role_id: `role:e04${lower}:${runToken}`,
    scope_grant_id: `scope:e04${lower}:${runToken}`,
    base_session_id: `session:e04${lower}:${runToken}:base`,
    base_token_hash: sha256(`e04-base-token:${label}:${runToken}`),
    asset_id: `order:e04${lower}:${runToken}`,
    order_number: `E04-${label}-${runToken}`,
    checkout_id: `checkout:e04${lower}:${runToken}`,
  });
}

async function insertRealm(database, input) {
  await database.query(`insert into identity.realm(
    id,node_id,status,created_at,updated_at,node_profile,mall_id,host_node_id,host_node_profile
  ) values($1,$2,'active',clock_timestamp(),clock_timestamp(),$3,$4,$5,$6)`, [
    input.realm_id, input.node_id, input.node_profile, input.mall_id, input.host_node_id,
    input.host_node_id === null ? null : 'operating_mall',
  ]);
}

async function collectCredentialDiscovery(database, fixture) {
  const { resolvePasswordLoginCredential } = await import(
    '../../../01_core_hexin/services/commerce/src/modules/identity/03_application_yingyong/services_fuwu/SmsLogin.ts'
  );
  const positiveCases = [];
  for (const target of fixture.realms) {
    const found = await resolvePasswordLoginCredential(database, {
      realmId: target.realm_id,
      subjectHash: fixture.shared_subject_hash,
      membershipClient: target.membership_client,
      membershipOrganizationId: target.organization_id,
    });
    positiveCases.push(Object.freeze({
      case_id: `E04-DISCOVERY-${target.label}`,
      request: discoveryRequest(fixture, target.realm_id, target),
      expected: identityExpectation(target),
      response: sanitizeCredential(found),
    }));
  }
  const crossRealmCases = [];
  for (const source of fixture.realms) {
    for (const target of fixture.realms) {
      if (source === target) continue;
      const found = await resolvePasswordLoginCredential(database, {
        realmId: source.realm_id,
        subjectHash: fixture.shared_subject_hash,
        membershipClient: target.membership_client,
        membershipOrganizationId: target.organization_id,
      });
      crossRealmCases.push(Object.freeze({
        case_id: `E04-DISCOVERY-${source.label}-AS-${target.label}`,
        source_realm_label: source.label,
        requested_identity_label: target.label,
        request: discoveryRequest(fixture, source.realm_id, target),
        response: sanitizeCredential(found),
      }));
    }
  }
  return Object.freeze({ positive_cases: Object.freeze(positiveCases), cross_realm_cases: Object.freeze(crossRealmCases) });
}

function discoveryRequest(fixture, realmId, target) {
  return Object.freeze({
    boundary: 'resolvePasswordLoginCredential',
    entry_realm_id: realmId,
    shared_subject_hash: fixture.shared_subject_hash,
    membership_client: target.membership_client,
    membership_organization_id: target.organization_id,
  });
}

function sanitizeCredential(found) {
  if (!found) return null;
  return Object.freeze({
    account_id: found.account_id,
    realm_id: found.realm_id,
    principal_id: found.principal_id,
    credential_version: Number(found.credential_version),
    secret_hash_present: typeof found.secret_hash === 'string' && found.secret_hash.length > 0,
  });
}

async function collectIdentityMap(database, fixture) {
  const mapped = [];
  for (const item of fixture.realms) {
    const [identity, scopes, permissions, asset] = await Promise.all([
      database.query(`select credential.id credential_id,credential.subject_hash,account.id account_id,
          account.legacy_principal_id principal_id,membership.id membership_id,session.id base_session_id,
          session.token_hash base_token_hash,
          realm.id realm_id,node.id node_id,relation.line_id,relation.parent_node_id,relation.signed_level,
          relation.host_sovereign_node_id
        from identity.credential credential
        join identity.account account on account.id=credential.account_id and account.realm_id=credential.realm_id
        join access.membership membership on membership.account_id=account.id and membership.realm_id=account.realm_id
        join identity.session session on session.membership_id=membership.id and session.id=$2
        join identity.realm realm on realm.id=account.realm_id
        join organization.node node on node.realm_id=realm.id
        join organization.noderelation relation on relation.node_id=node.id and relation.superseded_at is null
        where credential.id=$1`, [item.credential_id, item.base_session_id]),
      database.query(`select id,membership_id,scope_kind,scope_id,scope_path,effect,access_version
        from access.scopegrant where membership_id=$1 order by id`, [item.membership_id]),
      database.query(`select role.id role_id,permission.code,effect
        from access.membershiprole assignment join access.role role on role.id=assignment.role_id
        join access.rolepermission mapping on mapping.role_id=role.id
        join access.permission permission on permission.id=mapping.permission_id
        where assignment.membership_id=$1 order by role.id,permission.code`, [item.membership_id]),
      database.query(`select id,scope_id,member_id,mall_id,operating_node_id,operating_line_id,
          participant_node_id,participant_membership_id,participant_realm_id,participant_account_id,version,evidence
        from ordering.orderrecord where id=$1`, [item.asset_id]),
    ]);
    mapped.push(Object.freeze({
      realm_label: item.label,
      expected: identityExpectation(item),
      identity: identity.rows[0] ?? null,
      scope_grants: scopes.rows,
      permissions: permissions.rows,
      asset: asset.rows[0] ?? null,
    }));
  }
  return Object.freeze(mapped);
}

async function executePositiveCases(database, fixture) {
  const cases = [];
  for (const target of fixture.realms) {
    const presented = presentedAuthority(target, target.base_token_hash);
    const read = await executeAssetProbe(database, fixture, target, presented, 'read', `e04-${fixture.run_token}-positive-${target.label}-read`);
    const write = await executeAssetProbe(database, fixture, target, presented, 'write', `e04-${fixture.run_token}-positive-${target.label}-write`);
    cases.push(Object.freeze({
      case_id: `E04-POS-${target.label}`,
      realm_label: target.label,
      expected_asset_id: target.asset_id,
      expected_membership_id: target.membership_id,
      request: presented,
      read_response: read,
      write_response: write,
    }));
  }
  return Object.freeze(cases);
}

async function executeTransitions(database, fixture) {
  const transitions = [];
  for (const source of fixture.realms) {
    for (const target of fixture.realms) {
      if (source === target) continue;
      const intentId = `loginintent:${randomUUID()}`;
      const intentTokenHash = sha256(`e04-intent:${fixture.run_token}:${source.label}:${target.label}`);
      const issued = await database.query(`select * from identity.issue_login_intent($1,$2,$3,$4,$5,$6,$7,$8)`, [
        intentId, intentTokenHash, source.base_session_id, source.account_id, source.realm_id,
        target.node_id, target.surface, target.application_slug,
      ]);
      const targetSessionId = `session:e04:${fixture.run_token}:switch:${source.label.toLowerCase()}:${target.label.toLowerCase()}`;
      const targetTokenHash = sha256(`e04-switch-token:${fixture.run_token}:${source.label}:${target.label}`);
      await database.query(`insert into identity.session(
        id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,
        user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at,realm_id,account_id,auth_target
      ) values($1,$2,$3,$4,1,1,$5,$6,$7,'e04-switch',1,clock_timestamp()+interval '1 hour',
        clock_timestamp(),clock_timestamp(),$8,$9,$10)`, [
        targetSessionId, target.principal_id, target.membership_id, targetTokenHash, target.membership_client,
        sha256(`e04-switch-ip:${fixture.run_token}:${source.label}:${target.label}`),
        `e04-switch-${source.label}-${target.label}`, target.realm_id, target.account_id, target.auth_target,
      ]);
      const consumed = await database.query(`select * from identity.consume_login_intent($1,$2,$3,$4,$5,$6)`, [
        intentTokenHash, target.realm_id, target.auth_target, target.application_slug, target.account_id, targetSessionId,
      ]);
      const [intent, sourceAtSource, sourceAtTarget, targetAtTarget, targetMembership, targetScope] = await Promise.all([
        database.query(`select id,source_realm_id,source_node_id,source_account_id,source_session_id,
          target_realm_id,target_node_id,target_surface,target_target,target_application,target_accounts_host,
          target_account_id,target_session_id,consumed_at,expires_at,created_at
          from identity.loginintent where id=$1`, [intentId]),
        resolveSession(database, source.base_token_hash, source.accounts_host),
        resolveSession(database, source.base_token_hash, target.accounts_host),
        resolveSession(database, targetTokenHash, target.accounts_host),
        resolveMembership(database, target.membership_id, target.realm_id, target.membership_client, target.organization_id),
        resolveScope(database, target.membership_id, target.realm_id, target.membership_client,
          target.organization_id, target.organization_id),
      ]);
      transitions.push(Object.freeze({
        pair_id: `${source.label}->${target.label}`,
        source_realm_label: source.label,
        target_realm_label: target.label,
        source_identifiers: identityExpectation(source),
        target_expected_identifiers: { ...identityExpectation(target), scope_id: target.organization_id },
        issue_request: {
          boundary: 'identity.issue_login_intent', intent_id: intentId, source_session_id: source.base_session_id,
          source_account_id: source.account_id, source_realm_id: source.realm_id, target_node_id: target.node_id,
          target_surface: target.surface, target_application: target.application_slug,
        },
        issue_response: { row_count: issued.rows.length, rows: issued.rows },
        fresh_target_session: { id: targetSessionId, token_hash: targetTokenHash },
        consume_response: { row_count: consumed.rows.length, rows: consumed.rows },
        login_intent_row: intent.rows[0] ?? null,
        source_session_at_source: sessionResponse(sourceAtSource),
        source_session_at_target: sessionResponse(sourceAtTarget),
        target_session_at_target: sessionResponse(targetAtTarget),
        target_membership_resolution: membershipResponse(targetMembership),
        target_scope_resolution: scopeResponse(targetScope),
      }));
    }
  }
  return Object.freeze(transitions);
}

async function executeNegativeMatrix(database, fixture, transitions) {
  const byLabel = new Map(fixture.realms.map((entry) => [entry.label, entry]));
  const observations = [];
  let index = 0;
  for (const transition of transitions) {
    const source = byLabel.get(transition.source_realm_label);
    const target = byLabel.get(transition.target_realm_label);
    if (!source || !target) throw new Error(`E04_TRANSITION_FIXTURE_MISSING:${transition.pair_id}`);
    for (const variant of ['source_session', 'source_membership', 'source_scope', 'source_node_identity']) {
      for (const operation of ['read', 'write']) {
        index += 1;
        const presented = presentedAuthority(target, transition.fresh_target_session.token_hash);
        presented.session_id = transition.fresh_target_session.id;
        if (variant === 'source_session') {
          presented.token_hash = source.base_token_hash;
          presented.session_id = source.base_session_id;
        }
        if (variant === 'source_membership') presented.membership_id = source.membership_id;
        if (variant === 'source_scope') presented.scope_id = source.organization_id;
        if (variant === 'source_node_identity') presented.node_id = source.node_id;
        const traceId = `e04-${fixture.run_token}-negative-${String(index).padStart(2, '0')}`;
        if (operation === 'write') await database.query(`savepoint e04_negative_${index}`);
        let response;
        try {
          response = await executeAssetProbe(database, fixture, target, presented, operation, traceId);
        } finally {
          if (operation === 'write') {
            await database.query(`rollback to savepoint e04_negative_${index}`);
            await database.query(`release savepoint e04_negative_${index}`);
          }
        }
        observations.push(Object.freeze({
          case_id: `E04-NEG-${source.label}-${target.label}-${variant.toUpperCase().replaceAll('_', '-')}-${operation.toUpperCase()}`,
          pair_id: transition.pair_id,
          source_realm_label: source.label,
          target_realm_label: target.label,
          misuse_variant: variant,
          operation_kind: operation,
          request: {
            target_asset_id: target.asset_id,
            target_host: target.accounts_host,
            presented_authority: presented,
            source_authority: presentedAuthority(source, source.base_token_hash),
          },
          response,
        }));
      }
    }
  }
  return Object.freeze(observations);
}

async function executeAssetProbe(database, fixture, target, presented, operation, traceId) {
  const authorization = {
    session_resolution: null,
    membership_resolution: null,
    scope_resolution: null,
    policy_decision: null,
    node_boundary: null,
  };
  let denial = null;
  const session = await resolveSession(database, presented.token_hash, target.accounts_host);
  authorization.session_resolution = sessionResponse(session);
  const actor = session.rows[0] ?? null;
  if (session.rows.length !== 1) {
    denial = { stage: 'session', reason: session.rows.length === 0 ? 'AUTHENTICATION_REQUIRED' : 'MULTIPLE_SESSION_CONTEXTS' };
  }

  let membership = { rows: [] };
  if (denial === null) {
    membership = await resolveMembership(database, presented.membership_id, actor.realm_id,
      actor.membership_client, actor.governance_organization_id);
    authorization.membership_resolution = membershipResponse(membership);
    if (membership.rows.length !== 1 || membership.rows[0]?.active !== true) {
      denial = { stage: 'membership', reason: membership.rows.length > 1 ? 'MULTIPLE_ACTIVE_MEMBERSHIPS' : 'MEMBERSHIP_INACTIVE' };
    }
  }

  let resolvedScope = { rows: [] };
  if (denial === null) {
    resolvedScope = await resolveScope(database, presented.membership_id, actor.realm_id,
      actor.membership_client, actor.governance_organization_id, presented.scope_id);
    authorization.scope_resolution = scopeResponse(resolvedScope);
    if (resolvedScope.rows.length !== 1 || !resolvedScope.rows[0]?.scope) {
      denial = { stage: 'scope', reason: 'SCOPE_DENIED' };
    } else {
      const { checkScope } = await import('@shop/authz');
      const decision = checkScope(membershipAccess(membership.rows[0]), AUTHORIZATION_PERMISSION,
        resolvedScope.rows[0].scope, new Date());
      authorization.policy_decision = decision;
      if ('reason' in decision) denial = { stage: 'scope', reason: decision.reason };
    }
  }

  if (denial === null) {
    const presentedNode = fixture.realms.find(({ node_id }) => node_id === presented.node_id);
    const nodeScope = presentedNode === undefined
      ? null
      : (await database.query('select access.scope_object($1) scope', [presentedNode.organization_id])).rows[0]?.scope ?? null;
    let nodeError = null;
    if (nodeScope === null) {
      nodeError = { name: 'Error', message: 'NODE_SCOPE_MISMATCH' };
    } else {
      const { NodeBoundScopeResolver } = await import(
        '../../../01_core_hexin/services/commerce/src/foundation/security/NodeBoundScopeResolver.ts'
      );
      const resolver = new NodeBoundScopeResolver({ resolve: async () => nodeScope }, target.organization_id);
      try {
        await resolver.resolve({ id: actor.actor_id }, AUTHORIZATION_OPERATION);
      } catch (cause) {
        nodeError = serializeError(cause);
      }
    }
    authorization.node_boundary = {
      presented_node_id: presented.node_id,
      mapped_data_scope: nodeScope,
      expected_target_scope_id: target.organization_id,
      error: nodeError,
    };
    if (nodeError !== null) denial = { stage: 'node', reason: nodeError.message };
  }

  const outboxBefore = await outboxRows(database, traceId);
  let assetRows = [];
  let writeRows = [];
  if (denial === null) {
    const parameters = [target.asset_id, actor.realm_id, actor.account_id, presented.membership_id,
      presented.node_id, presented.scope_id];
    if (operation === 'read') {
      assetRows = (await database.query(`select id,scope_id,participant_realm_id,participant_account_id,
          participant_membership_id,participant_node_id,version,evidence
        from ordering.orderrecord where id=$1 and participant_realm_id=$2 and participant_account_id=$3
          and participant_membership_id=$4 and participant_node_id=$5 and scope_id=$6`, parameters)).rows;
    } else {
      writeRows = (await database.query(`update ordering.orderrecord
        set evidence=evidence||jsonb_build_object('e04_probe',$7::text),version=version+1,updated_at=clock_timestamp()
        where id=$1 and participant_realm_id=$2 and participant_account_id=$3
          and participant_membership_id=$4 and participant_node_id=$5 and scope_id=$6
        returning id,scope_id,participant_realm_id,participant_account_id,participant_membership_id,
          participant_node_id,version,evidence`, [...parameters, traceId])).rows;
    }
  }
  const outboxAfter = await outboxRows(database, traceId);
  return Object.freeze({
    status: denial === null ? 200 : 403,
    denial,
    authorization,
    asset_rows: assetRows,
    write_rows: writeRows,
    outbox_before: outboxBefore,
    outbox_after: outboxAfter,
  });
}

function presentedAuthority(item, tokenHash) {
  return {
    token_hash: tokenHash,
    session_id: item.base_session_id,
    membership_id: item.membership_id,
    scope_id: item.organization_id,
    node_id: item.node_id,
    realm_id: item.realm_id,
    account_id: item.account_id,
  };
}

function identityExpectation(item) {
  return Object.freeze({
    realm_id: item.realm_id,
    account_id: item.account_id,
    principal_id: item.principal_id,
    membership_id: item.membership_id,
    base_session_id: item.base_session_id,
    node_id: item.node_id,
    line_id: item.line_id,
    parent_node_id: item.parent_node_id,
    signed_level: item.signed_level,
    scope_id: item.organization_id,
    asset_id: item.asset_id,
    accounts_host: item.accounts_host,
  });
}

function authorityBoundary() {
  return Object.freeze([
    'resolvePasswordLoginCredential Realm-contained lookup',
    'identity.resolve_session(token_hash,target_host)',
    'access.resolve_session_membership(session-bound context)',
    'access.resolve_session_scope + @shop/authz checkScope',
    'NodeBoundScopeResolver mapped node data Scope',
    'ordering.orderrecord participant Realm/Account/Membership/node/Scope predicate',
  ]);
}

function resolveSession(database, tokenHash, host) {
  return database.query(`select actor_id,account_id,realm_id,session_id,membership_id,credential_version,
      access_version,target,membership_client,governance_organization_id,entry_realm_id,line_id,node_id,
      parent_node_id,signed_level,node_profile,mall_id,host_sovereign_node_id,relation_version
    from identity.resolve_session($1,$2)`, [tokenHash, host]);
}

function resolveMembership(database, membershipId, realmId, client, organizationId) {
  return database.query(`select resolved.id,resolved.active,resolved.access_version,resolved.denies,resolved.grants
    from access.resolve_session_membership($1,$2,$3,$4) resolved`,
  [membershipId, realmId, client, organizationId]);
}

function resolveScope(database, membershipId, realmId, client, organizationId, scopeId) {
  return database.query(`select resolved.scope from access.resolve_session_scope(
      $1,$2,$3,$4,$5,null,$6
    ) resolved`, [membershipId, realmId, client, organizationId, AUTHORIZATION_OPERATION, scopeId]);
}

function sessionResponse(result) {
  return Object.freeze({ row_count: result.rows.length, rows: result.rows });
}

function membershipResponse(result) {
  return Object.freeze({ row_count: result.rows.length, rows: result.rows });
}

function scopeResponse(result) {
  return Object.freeze({ row_count: result.rows.length, rows: result.rows });
}

function membershipAccess(row) {
  return Object.freeze({
    id: row.id,
    active: row.active,
    accessVersion: Number(row.access_version),
    denies: row.denies,
    grants: row.grants,
  });
}

function outboxRows(database, traceId) {
  return database.query(`select event_type,aggregate_type,aggregate_id,scope_id,trace_id,payload
    from runtime.outbox where trace_id=$1 order by id`, [traceId]).then(({ rows }) => rows);
}

async function snapshotState(database, runToken) {
  const pattern = `%${runToken}%`;
  const definitions = [
    ['identity.account', `select id,realm_id,legacy_principal_id,status,credential_version,assurance_level
      from identity.account where id like $1 order by id`],
    ['identity.credential', `select id,principal_id,provider,subject_hash,status,realm_id,account_id
      from identity.credential where id like $1 order by id`],
    ['identity.session', `select id,principal_id,membership_id,token_hash,credential_version,access_version,client,
      assurance_level,realm_id,account_id,auth_target,revoked_at
      from identity.session where id like $1 order by id`],
    ['identity.loginintent', `select id,source_realm_id,source_node_id,source_account_id,source_session_id,
      target_realm_id,target_node_id,target_account_id,target_session_id,consumed_at
      from identity.loginintent where source_account_id like $1 order by id`],
    ['access.membership', `select id,member_id,organization_id,client,status,access_version,realm_id,account_id,node_profile
      from access.membership where id like $1 order by id`],
    ['access.scopegrant', `select id,membership_id,scope_kind,scope_id,scope_path,effect,access_version
      from access.scopegrant where id like $1 order by id`],
    ['access.role', `select id,scope_id,name,status,version from access.role where id like $1 order by id`],
    ['access.membershiprole', `select membership_id,role_id,effective_at,expires_at
      from access.membershiprole where membership_id like $1 order by membership_id,role_id,effective_at`],
    ['identity.realm', `select id,node_id,status,node_profile,mall_id,host_node_id,host_node_profile
      from identity.realm where id like $1 order by id`],
    ['organization.node', `select id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status
      from organization.node where id like $1 order by id`],
    ['organization.noderelation', `select line_id,node_id,parent_node_id,original_parent_node_id,signed_level,
      host_sovereign_node_id,relation_version,effective_at,superseded_at
      from organization.noderelation where node_id like $1 order by line_id,node_id,relation_version`],
    ['ordering.orderrecord', `select id,scope_id,member_id,mall_id,version,evidence,operating_node_id,operating_line_id,
      participant_node_id,participant_membership_id,participant_realm_id,participant_account_id
      from ordering.orderrecord where id like $1 order by id`],
    ['runtime.outbox', `select event_type,aggregate_type,aggregate_id,scope_id,trace_id,payload
      from runtime.outbox where trace_id like $1 order by id`],
  ];
  const tables = {};
  for (const [name, sql] of definitions) tables[name] = (await database.query(sql, [pattern])).rows;
  return Object.freeze({
    tables,
    table_digests: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, `sha256:${sha256(JSON.stringify(rows))}`])),
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
      changed: JSON.stringify(beforeRows) !== JSON.stringify(afterRows),
      before_sha256: `sha256:${sha256(JSON.stringify(beforeRows))}`,
      after_sha256: `sha256:${sha256(JSON.stringify(afterRows))}`,
    });
  });
  return Object.freeze({ changed_table_count: tables.filter(({ changed }) => changed).length, tables });
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
