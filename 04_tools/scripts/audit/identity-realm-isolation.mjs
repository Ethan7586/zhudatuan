import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const registryDeclaration = JSON.parse(readFileSync(resolve(import.meta.dirname,
  '../../../02_platform_pingtai/config/sfl-node-registry.declaration.json'), 'utf8'));
const manifestsByNode = new Map(registryDeclaration.manifests.map((manifest) => [manifest.node_id, manifest]));
const bindingKind = (binding) => binding.surface_ref === 'surface:api'
  ? 'api'
  : binding.surface_ref === 'surface:identity'
    ? 'accounts'
    : 'storefront';
const bindingOrigin = (manifest, bindingRef) => {
  const binding = manifest.domain_bindings.find((candidate) => candidate.binding_ref.ref === bindingRef);
  if (!binding) throw new Error(`IDENTITY_NODE_BINDING_MISSING:${manifest.node_id}:${bindingRef}`);
  return `https://${binding.host}`;
};
const identityNodeManifest = Object.freeze({
  revision: registryDeclaration.registry_version,
  nodes: registryDeclaration.node_bindings.map((nodeBinding) => {
    const manifest = manifestsByNode.get(nodeBinding.node_id);
    if (!manifest) throw new Error(`IDENTITY_NODE_MANIFEST_MISSING:${nodeBinding.node_id}`);
    return Object.freeze({
      nodeId: manifest.node_id,
      realmId: manifest.realm_ref.ref,
      status: manifest.lifecycle_status,
      nodeProfile: manifest.node_profile,
      mallId: manifest.mall_id,
      hostNodeId: manifest.host_node_id,
      entries: nodeBinding.identity_entry_binding_refs.map((bindingRef) => {
        const binding = manifest.domain_bindings.find((candidate) => candidate.binding_ref.ref === bindingRef);
        if (!binding) throw new Error(`IDENTITY_NODE_ENTRY_BINDING_MISSING:${manifest.node_id}:${bindingRef}`);
        return Object.freeze({ host: binding.host, kind: bindingKind(binding), status: manifest.lifecycle_status });
      }),
      targets: nodeBinding.targets.map((target) => Object.freeze({
        surface: target.surface,
        target: target.target,
        membershipClient: target.membership_client,
        membershipOrganizationId: target.membership_organization_id,
        application: target.application,
        returnOrigin: `${bindingOrigin(manifest, target.return_binding_ref)}${target.return_path}`,
      })),
    });
  }),
});
const canonicalL0 = identityNodeManifest.nodes.find((node) => node.nodeId === 'node:zhudatuan:l0');
const canonicalL1 = identityNodeManifest.nodes.find((node) => node.nodeId === 'node:hbbtzn:l1');
if (!canonicalL0 || !canonicalL1) throw new Error('IDENTITY_CANONICAL_NODE_MISSING');
const accountsHost = (node) => node.entries.find((entry) => entry.kind === 'accounts')?.host
  ?? (() => { throw new Error(`IDENTITY_ACCOUNTS_ENTRY_MISSING:${node.nodeId}`); })();
const returnOrigin = (node, target) => node.targets.find((candidate) => candidate.target === target)?.returnOrigin
  ?? (() => { throw new Error(`IDENTITY_TARGET_MISSING:${node.nodeId}:${target}`); })();

export async function verifyIdentityRealmIsolation(database, options = {}) {
  let formalEvidence = null;
  await database.exec('begin');
  try {
    await assertCanonicalIdentityNodeManifest(database);
    await database.exec(`
      create temporary table identity_realm_fixture(
        level integer primary key,
        node_id text not null,
        realm_id text not null,
        node_profile text not null,
        mall_id text,
        host_node_id text,
        accounts_host text not null,
        auth_target text not null,
        membership_client text not null,
        organization_id text not null,
        principal_id text not null,
        account_id text not null,
        member_id text not null,
        membership_id text not null,
        session_id text not null,
        token_hash text not null
      );
      insert into identity_realm_fixture
      select level,case level
          when 0 then 'node:zhudatuan:l0'
          when 1 then 'node:hbbtzn:l1'
          else 'node:fixture:l'||level
        end,'realm:l'||level,
        case when level<=5 then 'operating_mall' else 'consumer' end,
        case when level=0 then 'mall-zhudatuan'
          when level=1 then 'mall:d1708f04df2dd8a61736852c4900fb43'
          when level<=5 then 'mall:realm-isolation:l'||level else null end,
        case when level<=5 then null else 'node:zhudatuan:l0' end,
        case level when 0 then '${accountsHost(canonicalL0)}' when 1 then '${accountsHost(canonicalL1)}'
          else 'accounts.l'||level||'.identity.test' end,
        case when level<=5 then 'console' else 'storefront' end,
        case when level<=5 then 'operator' else 'storefront' end,
        case when level=0 then 'tenant-zhudatuan'
          when level=1 then 'mall:d1708f04df2dd8a61736852c4900fb43' else 'mall-zhudatuan' end,
        'principal:realm-isolation:l'||level,'account:realm-isolation:l'||level,
        'member:realm-isolation:l'||level,'membership:realm-isolation:l'||level,
        'session:realm-isolation:l'||level,
        encode(public.digest('session-token:realm-isolation:l'||level,'sha256'),'hex')
      from generate_series(0,11) level;

      insert into organization.organization(
        id,kind,parent_id,name,timezone,status,version,created_at,updated_at
      )
      select organization_id,'mall','enterprise-zhudatuan','E12 Realm L1 Mall','Asia/Shanghai',
        'active',1,clock_timestamp(),clock_timestamp()
      from identity_realm_fixture where level=1
      on conflict(id) do nothing;
      insert into organization.unitclosure(ancestor_id,descendant_id,depth)
      select closure.ancestor_id,fixture.organization_id,closure.depth+1
      from identity_realm_fixture fixture
      join organization.unitclosure closure on closure.descendant_id='enterprise-zhudatuan'
      where fixture.level=1
      union all
      select organization_id,organization_id,0 from identity_realm_fixture where level=1
      on conflict do nothing;

      insert into identity.realm(
        id,node_id,status,created_at,updated_at,node_profile,mall_id,host_node_id,host_node_profile
      )
      select realm_id,node_id,'active',clock_timestamp(),clock_timestamp(),node_profile,mall_id,host_node_id,
        case when node_profile='consumer' then 'operating_mall' else null end
      from identity_realm_fixture where level>=2;

      insert into organization.node(
        id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at
      )
      select fixture.node_id,root.line_id,'hosted',fixture.node_profile,fixture.realm_id,fixture.mall_id,
        'active',clock_timestamp(),clock_timestamp()
      from identity_realm_fixture fixture
      cross join organization.node root
      where fixture.level>=2 and root.id='node:zhudatuan:l0';

      insert into organization.noderelation(
        line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
        relation_version,effective_at
      )
      select root.line_id,fixture.node_id,root.id,root.id,'L'||fixture.level,root.id,1,clock_timestamp()
      from identity_realm_fixture fixture
      cross join organization.node root
      where fixture.level>=2 and root.id='node:zhudatuan:l0';

      insert into identity.realmentry(host,realm_id,kind,status,created_at)
      select accounts_host,realm_id,'accounts','active',clock_timestamp()
      from identity_realm_fixture where level>=2
      union all
      select 'api.l'||level||'.identity.test',realm_id,'api','active',clock_timestamp()
      from identity_realm_fixture where level>=2
      union all
      select 'l'||level||'.identity.test',realm_id,'storefront','active',clock_timestamp()
      from identity_realm_fixture where level>=2;

      insert into identity.realmtarget(
        realm_id,surface,target,membership_client,membership_organization_id,application_slug,return_origin,created_at,
        node_profile
      )
      select realm_id,'admin','console','operator',organization_id,null,
        'https://console.l'||level||'.identity.test',clock_timestamp(),node_profile
      from identity_realm_fixture where level between 2 and 5
      union all
      select realm_id,'consumer','storefront','storefront',organization_id,'l'||level||'-storefront',
        'https://l'||level||'.identity.test',clock_timestamp(),node_profile
      from identity_realm_fixture where level>=2;

      insert into identity.principal(id,status,credential_version,created_at,updated_at)
      select principal_id,'active',1,clock_timestamp(),clock_timestamp() from identity_realm_fixture;

      insert into identity.account(
        id,realm_id,legacy_principal_id,status,credential_version,assurance_level,created_at,updated_at,
        mobile_ciphertext,mobile_token,mobile_masked,phone_verified_at
      )
      select account_id,realm_id,principal_id,'active',level+1,level%4,clock_timestamp(),clock_timestamp(),
        'ciphertext:shared-mobile:l'||level,repeat('a',64),'+86 138****8000',clock_timestamp()+level*interval '1 second'
      from identity_realm_fixture;

      insert into identity.credential(
        id,principal_id,provider,subject_hash,secret_hash,status,created_at,realm_id,account_id
      )
      select 'credential:realm-isolation:l'||level,principal_id,'password',repeat('b',64),
        'password-hash-l'||level,'active',clock_timestamp(),realm_id,account_id
      from identity_realm_fixture;

      insert into member.profile(id,principal_id,display_name,status,created_at,updated_at)
      select member_id,principal_id,'Realm isolation L'||level,'active',clock_timestamp(),clock_timestamp()
      from identity_realm_fixture;

      insert into access.membership(
        id,member_id,organization_id,client,status,access_version,joined_at
      )
      select membership_id,member_id,organization_id,membership_client,'active',1,clock_timestamp()
      from identity_realm_fixture;
      update access.membership membership
      set realm_id=realm.id,account_id=fixture.account_id,node_profile=realm.node_profile
      from identity_realm_fixture fixture join identity.realm realm on realm.id=fixture.realm_id
      where membership.id=fixture.membership_id;

      insert into access.membershiprole(membership_id,role_id,effective_at)
      select membership_id,'role:self',clock_timestamp() from identity_realm_fixture;
      insert into access.scopegrant(
        id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version
      )
      select 'scope:realm-isolation:l'||level,membership_id,'self','self:'||principal_id,
        'self:'||principal_id,'allow',clock_timestamp(),1
      from identity_realm_fixture;

      insert into identity.session(
        id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,
        user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at,realm_id,account_id,auth_target
      )
      select session_id,principal_id,membership_id,token_hash,level+1,1,membership_client,repeat('c',64),
        'realm-isolation-fixture','fixture-device',1,clock_timestamp()+interval '1 hour',clock_timestamp(),
        clock_timestamp(),realm_id,account_id,auth_target
      from identity_realm_fixture;

      insert into identity.authticket(
        id,session_id,token_hash,state_hash,nonce_hash,pkce_challenge,target,expires_at,created_at,realm_id,account_id
      )
      select 'ticket:realm-isolation:l'||level,session_id,
        encode(public.digest('ticket:realm-isolation:l'||level,'sha256'),'hex'),
        encode(public.digest('state:realm-isolation:l'||level,'sha256'),'hex'),
        encode(public.digest('nonce:realm-isolation:l'||level,'sha256'),'hex'),
        repeat('A',43),auth_target,clock_timestamp()+interval '10 minutes',clock_timestamp(),realm_id,account_id
      from identity_realm_fixture;

      create temporary table identity_l0_l1_consumer_fixture as
      select level,realm_id,accounts_host,principal_id,account_id,member_id,
        'membership:realm-isolation:l'||level||':consumer' membership_id,
        'session:realm-isolation:l'||level||':consumer' session_id,
        encode(public.digest('session-token:realm-isolation:l'||level||':consumer','sha256'),'hex') token_hash,
        'storefront' auth_target,
        case level when 0 then 'mall-zhudatuan' else 'mall:d1708f04df2dd8a61736852c4900fb43' end organization_id
      from identity_realm_fixture where level in(0,1);

      insert into access.membership(
        id,member_id,organization_id,client,status,access_version,joined_at
      )
      select membership_id,member_id,organization_id,'storefront','active',1,clock_timestamp()
      from identity_l0_l1_consumer_fixture;
      update access.membership membership
      set realm_id=realm.id,account_id=fixture.account_id,node_profile=realm.node_profile
      from identity_l0_l1_consumer_fixture fixture join identity.realm realm on realm.id=fixture.realm_id
      where membership.id=fixture.membership_id;
      insert into access.membershiprole(membership_id,role_id,effective_at)
      select membership_id,'role:self',clock_timestamp() from identity_l0_l1_consumer_fixture;
      insert into access.scopegrant(
        id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version
      )
      select 'scope:realm-isolation:l'||level||':consumer',membership_id,'self','self:'||principal_id,
        'self:'||principal_id,'allow',clock_timestamp(),1
      from identity_l0_l1_consumer_fixture;
      insert into identity.session(
        id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,
        user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at,realm_id,account_id,auth_target
      )
      select session_id,principal_id,membership_id,token_hash,level+1,1,'storefront',repeat('9',64),
        'realm-isolation-consumer-fixture','consumer-device',1,clock_timestamp()+interval '1 hour',
        clock_timestamp(),clock_timestamp(),realm_id,account_id,auth_target
      from identity_l0_l1_consumer_fixture;
      insert into identity.authticket(
        id,session_id,token_hash,state_hash,nonce_hash,pkce_challenge,target,expires_at,created_at,realm_id,account_id
      )
      select 'ticket:realm-isolation:l'||level||':consumer',session_id,
        encode(public.digest('ticket:realm-isolation:l'||level||':consumer','sha256'),'hex'),
        encode(public.digest('state:realm-isolation:l'||level||':consumer','sha256'),'hex'),
        encode(public.digest('nonce:realm-isolation:l'||level||':consumer','sha256'),'hex'),
        repeat('B',43),auth_target,clock_timestamp()+interval '10 minutes',clock_timestamp(),realm_id,account_id
      from identity_l0_l1_consumer_fixture;

      insert into identity.challenge(
        id,principal_id,purpose,destination_hash,code_hash,expires_at,created_at,realm_id,account_id
      )
      select 'challenge:realm-isolation:l'||level,principal_id,'login',repeat('d',64),
        'challenge-code-l'||level,clock_timestamp()+interval '10 minutes',clock_timestamp(),realm_id,account_id
      from identity_realm_fixture;

      insert into identity.assurance(
        id,principal_id,method,level,evidence_hash,verified_at,expires_at,realm_id,account_id
      )
      select 'assurance:realm-isolation:l'||level,principal_id,'phone_otp',2,repeat('e',64),
        clock_timestamp(),clock_timestamp()+interval '12 hours',realm_id,account_id
      from identity_realm_fixture;

      insert into identity.loginattempt(
        subject_hash,client_hash,window_started_at,failures,realm_id,account_id
      )
      select repeat('b',64),repeat('f',64),clock_timestamp(),level,realm_id,account_id
      from identity_realm_fixture;

      insert into identity.federatedidentity(
        id,principal_id,membership_id,provider,application_hash,subject_hash,union_hash,subject_ciphertext,
        subject_key_version,status,bound_at,created_at,updated_at,realm_id,account_id
      )
      select 'federated:realm-isolation:l'||level,principal_id,membership_id,'wechat',repeat('1',64),
        repeat('2',64),repeat('3',64),'wechat-ciphertext-l'||level,'fixture-key','active',clock_timestamp(),
        clock_timestamp(),clock_timestamp(),realm_id,account_id
      from identity_realm_fixture;
    `);

    await database.exec(`
      create temporary table identity_login_intent_issued as
      select issued.*
      from identity_realm_fixture source
      cross join lateral identity.issue_login_intent(
        'loginintent:00000000-0000-0000-0000-000000000001',repeat('7',64),
        source.session_id,source.account_id,source.realm_id,
        'node:hbbtzn:l1','consumer','zdt-l1-verify'
      ) issued
      where source.level=0;

      create temporary table identity_login_intent_wrong_target as
      select consumed.*
      from identity_realm_fixture target
      cross join lateral identity.consume_login_intent(
        repeat('7',64),target.realm_id,'storefront','zhudatuan-storefront',
        target.account_id,target.session_id
      ) consumed
      where target.level=0;

      create temporary table identity_login_intent_consumed as
      select consumed.*
      from identity_l0_l1_consumer_fixture target
      cross join lateral identity.consume_login_intent(
        repeat('7',64),target.realm_id,'storefront','zdt-l1-verify',
        target.account_id,target.session_id
      ) consumed
      where target.level=1;

      create temporary table identity_login_intent_replayed as
      select consumed.*
      from identity_l0_l1_consumer_fixture target
      cross join lateral identity.consume_login_intent(
        repeat('7',64),target.realm_id,'storefront','zdt-l1-verify',
        target.account_id,target.session_id
      ) consumed
      where target.level=1;
    `);

    await expectScalar(database, `select count(*)::integer value from identity_login_intent_issued`, 1,
      'IDENTITY_LOGIN_INTENT_ISSUE_FAILED');
    await expectScalar(database, `select count(*)::integer value from identity_login_intent_wrong_target`, 0,
      'IDENTITY_LOGIN_INTENT_WRONG_TARGET_ACCEPTED');
    await expectScalar(database, `select count(*)::integer value from identity_login_intent_consumed`, 1,
      'IDENTITY_LOGIN_INTENT_CONSUME_FAILED');
    await expectScalar(database, `select count(*)::integer value from identity_login_intent_replayed`, 0,
      'IDENTITY_LOGIN_INTENT_REPLAY_ACCEPTED');
    await expectScalar(database, `select count(*)::integer value from identity.loginintent
      where id='loginintent:00000000-0000-0000-0000-000000000001'
        and source_node_id='node:zhudatuan:l0' and target_node_id='node:hbbtzn:l1'
        and consumed_at is not null and target_session_id='session:realm-isolation:l1:consumer'`, 1,
      'IDENTITY_LOGIN_INTENT_AUDIT_EVIDENCE_INVALID');

    await expectScalar(database, `select count(*)::integer value from identity.credential
      where provider='password' and subject_hash=repeat('b',64)`, 12, 'IDENTITY_REALM_CREDENTIAL_COUNT_INVALID');
    await expectScalar(database, `select count(distinct secret_hash)::integer value from identity.credential
      where provider='password' and subject_hash=repeat('b',64)`, 12, 'IDENTITY_REALM_PASSWORD_ISOLATION_INVALID');
    await expectScalar(database, `select count(distinct credential_version)::integer value from identity.account
      where id like 'account:realm-isolation:%'`, 12, 'IDENTITY_REALM_CREDENTIAL_VERSION_ISOLATION_INVALID');
    await expectScalar(database, `select count(*)::integer value from identity.account
      where mobile_token=repeat('a',64)`, 12, 'IDENTITY_REALM_MOBILE_ISOLATION_INVALID');
    await expectScalar(database, `select count(*)::integer value from identity.challenge
      where destination_hash=repeat('d',64) and account_id is not null and realm_id is not null`, 12,
      'IDENTITY_REALM_CHALLENGE_ISOLATION_INVALID');
    await expectScalar(database, `select count(*)::integer value from identity.assurance
      where evidence_hash=repeat('e',64) and account_id is not null and realm_id is not null`, 12,
      'IDENTITY_REALM_ASSURANCE_ISOLATION_INVALID');
    await expectScalar(database, `select count(*)::integer value from identity.federatedidentity
      where provider='wechat' and application_hash=repeat('1',64) and subject_hash=repeat('2',64)`, 12,
      'IDENTITY_REALM_WECHAT_ISOLATION_INVALID');
    await expectScalar(database, `select count(*)::integer value from identity_realm_fixture fixture
      join identity.realm realm on realm.id=fixture.realm_id
      where realm.node_profile=fixture.node_profile
        and realm.mall_id is not distinct from fixture.mall_id
        and realm.host_node_id is not distinct from fixture.host_node_id`, 12,
      'IDENTITY_REALM_NODE_PROFILE_INVALID');
    await expectScalar(database, `select count(*)::integer value from identity.realmtarget target
      join identity.realm realm on realm.id=target.realm_id
      where realm.node_profile='consumer' and (target.surface='admin' or target.membership_client<>'storefront')`, 0,
      'IDENTITY_CONSUMER_ADMIN_TARGET_PRESENT');
    await expectScalar(database, `select count(*)::integer value from access.membership membership
      join identity.realm realm on realm.id=membership.realm_id
      where realm.node_profile='consumer' and membership.client<>'storefront'`, 0,
      'IDENTITY_CONSUMER_OPERATOR_MEMBERSHIP_PRESENT');

    await database.exec(`do $fixture$
      begin
        begin
          insert into identity.realmtarget(
            realm_id,surface,target,membership_client,membership_organization_id,application_slug,
            return_origin,created_at,node_profile
          ) values('realm:l6','admin','forbidden-console','operator','mall-zhudatuan',null,
            'https://console.l6.identity.test',clock_timestamp(),'consumer');
          raise exception 'IDENTITY_CONSUMER_ADMIN_TARGET_ACCEPTED';
        exception when check_violation or foreign_key_violation then null;
        end;
        begin
          insert into identity.realmtarget(
            realm_id,surface,target,membership_client,membership_organization_id,application_slug,
            return_origin,created_at
          ) values('realm:l6','consumer','storefront-without-profile','storefront','mall-zhudatuan',
            'l6-without-profile','https://l6.identity.test',clock_timestamp());
          raise exception 'IDENTITY_TARGET_PROFILE_DEFAULT_ACCEPTED';
        exception when not_null_violation then null;
        end;
        begin
          update access.membership set client='operator' where id='membership:realm-isolation:l6';
          raise exception 'IDENTITY_CONSUMER_OPERATOR_MEMBERSHIP_ACCEPTED';
        exception when check_violation or foreign_key_violation then null;
        end;
        begin
          update identity.realm set mall_id='mall:forbidden:l6' where id='realm:l6';
          raise exception 'IDENTITY_CONSUMER_MALL_ACCEPTED';
        exception when check_violation or foreign_key_violation then null;
        end;
      end
    $fixture$;`);

    const entryMatrix = await database.query(`with matrix as(
        select level,'admin' surface,accounts_host,session_id,account_id,realm_id,
          'console' auth_target
        from identity_realm_fixture where level in(0,1)
        union all
        select level,'consumer',accounts_host,session_id,account_id,realm_id,auth_target
        from identity_l0_l1_consumer_fixture
      )
      select matrix.level,matrix.surface,matrix.auth_target,resolved.account_id,resolved.realm_id,resolved.membership_id,
        resolved.target,target.return_origin
      from matrix cross join lateral identity.resolve_session(
        (select session.token_hash from identity.session session where session.id=matrix.session_id),matrix.accounts_host
      ) resolved join identity.realmtarget target on target.realm_id=resolved.realm_id and target.target=matrix.auth_target
      order by matrix.level,matrix.surface`);
    if (entryMatrix.rows.length !== 4 || entryMatrix.rows.some((row) =>
      row.account_id !== `account:realm-isolation:l${row.level}` || row.realm_id !== `realm:l${row.level}`
      || (row.surface === 'admin' && row.target !== 'console')
      || (row.surface === 'consumer' && row.target !== 'storefront')
      || (row.level === 0 && row.surface === 'admin' && row.auth_target !== 'console')
      || (row.level === 1 && row.surface === 'admin' && row.auth_target !== 'console')
      || (row.level === 0 && row.surface === 'consumer' && row.auth_target !== 'storefront')
      || (row.level === 1 && row.surface === 'consumer' && row.auth_target !== 'storefront')
      || row.return_origin !== ({
        '0:admin': returnOrigin(canonicalL0, 'console'),
        '0:consumer': returnOrigin(canonicalL0, 'storefront'),
        '1:admin': returnOrigin(canonicalL1, 'console'),
        '1:consumer': returnOrigin(canonicalL1, 'storefront'),
      })[`${row.level}:${row.surface}`])) {
      throw new Error(`IDENTITY_L0_L1_FOUR_ENTRY_MATRIX_INVALID:${JSON.stringify(entryMatrix.rows)}`);
    }
    await expectScalar(database, `with matrix as(
        select level,session_id from identity_realm_fixture where level in(0,1)
        union all select level,session_id from identity_l0_l1_consumer_fixture
      )
      select count(*)::integer value from matrix
      cross join lateral identity.resolve_session(
        (select session.token_hash from identity.session session where session.id=matrix.session_id),
        case matrix.level when 0 then '${accountsHost(canonicalL1)}' else '${accountsHost(canonicalL0)}' end
      ) resolved`, 0, 'IDENTITY_L0_L1_CROSS_HOST_ENTRY_ACCEPTED');

    await database.exec(`savepoint l0_l1_password_scope;
      update identity.account set credential_version=credential_version+1
      where id='account:realm-isolation:l1' and realm_id='realm:l1';`);
    await expectScalar(database, `with matrix as(
        select level,accounts_host,session_id from identity_realm_fixture where level in(0,1)
        union all select level,accounts_host,session_id from identity_l0_l1_consumer_fixture
      )
      select count(*)::integer value from matrix
      cross join lateral identity.resolve_session(
        (select session.token_hash from identity.session session where session.id=matrix.session_id),matrix.accounts_host
      ) resolved where matrix.level=0`, 2, 'IDENTITY_L1_PASSWORD_CHANGE_AFFECTED_L0');
    await expectScalar(database, `with matrix as(
        select level,accounts_host,session_id from identity_realm_fixture where level in(0,1)
        union all select level,accounts_host,session_id from identity_l0_l1_consumer_fixture
      )
      select count(*)::integer value from matrix
      cross join lateral identity.resolve_session(
        (select session.token_hash from identity.session session where session.id=matrix.session_id),matrix.accounts_host
      ) resolved where matrix.level=1`, 0, 'IDENTITY_L1_PASSWORD_CHANGE_NOT_SCOPED');
    await database.exec('rollback to savepoint l0_l1_password_scope; release savepoint l0_l1_password_scope;');

    await database.exec(`savepoint l0_l1_logout_scope;
      update identity.session set revoked_at=clock_timestamp(),revoked_reason='realm_fixture_logout'
      where account_id='account:realm-isolation:l0' and realm_id='realm:l0' and revoked_at is null;`);
    await expectScalar(database, `with matrix as(
        select level,accounts_host,session_id from identity_realm_fixture where level in(0,1)
        union all select level,accounts_host,session_id from identity_l0_l1_consumer_fixture
      )
      select count(*)::integer value from matrix
      cross join lateral identity.resolve_session(
        (select session.token_hash from identity.session session where session.id=matrix.session_id),matrix.accounts_host
      ) resolved where matrix.level=1`, 2, 'IDENTITY_L0_LOGOUT_AFFECTED_L1');
    await expectScalar(database, `with matrix as(
        select level,accounts_host,session_id from identity_realm_fixture where level in(0,1)
        union all select level,accounts_host,session_id from identity_l0_l1_consumer_fixture
      )
      select count(*)::integer value from matrix
      cross join lateral identity.resolve_session(
        (select session.token_hash from identity.session session where session.id=matrix.session_id),matrix.accounts_host
      ) resolved where matrix.level=0`, 0, 'IDENTITY_L0_LOGOUT_NOT_SCOPED');
    await database.exec('rollback to savepoint l0_l1_logout_scope; release savepoint l0_l1_logout_scope;');

    const resolved = await database.query(`select fixture.level,resolved.account_id,resolved.realm_id,resolved.membership_id
      from identity_realm_fixture fixture
      cross join lateral identity.resolve_session(fixture.token_hash,fixture.accounts_host) resolved
      order by fixture.level`);
    if (resolved.rows.length !== 12 || resolved.rows.some((row) => row.account_id !== `account:realm-isolation:l${row.level}`
      || row.realm_id !== `realm:l${row.level}` || row.membership_id !== `membership:realm-isolation:l${row.level}`)) {
      throw new Error(`IDENTITY_REALM_SESSION_RESOLUTION_INVALID:${JSON.stringify(resolved.rows)}`);
    }

    await expectScalar(database, `select count(*)::integer value
      from identity_realm_fixture fixture
      join identity_realm_fixture next on next.level=(fixture.level+1)%12
      cross join lateral identity.resolve_session(fixture.token_hash,next.accounts_host) resolved`, 0,
      'IDENTITY_REALM_CROSS_HOST_SESSION_ACCEPTED');

    await database.exec(`do $fixture$
      begin
        begin
          update identity.authticket
          set realm_id='realm:l1',account_id='account:realm-isolation:l1'
          where id='ticket:realm-isolation:l0';
          raise exception 'IDENTITY_REALM_CROSS_TICKET_ACCEPTED';
        exception when foreign_key_violation or check_violation then null;
        end;
      end
    $fixture$;`);

    const permission = await database.query(`select permission.code,permission.id
      from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id='role:self' and mapping.effect='allow' order by permission.code limit 1`);
    const permissionRow = permission.rows[0];
    if (!permissionRow) throw new Error('IDENTITY_REALM_PERMISSION_FIXTURE_MISSING');
    await database.query(`insert into access.membershipoverride(
      membership_id,permission_id,effect,granted_by,reason,effective_at
    ) values('membership:realm-isolation:l11',$1,'deny','realm-isolation-fixture','realm isolation acceptance',clock_timestamp())`,
    [permissionRow.id]);
    const authorization = await database.query(`select fixture.level,resolved.denies
      from identity_realm_fixture fixture cross join lateral access.resolve_membership(fixture.membership_id) resolved
      where fixture.level in(10,11) order by fixture.level`);
    if (authorization.rows.length !== 2
      || authorization.rows[0].denies.includes(permissionRow.code)
      || !authorization.rows[1].denies.includes(permissionRow.code)) {
      throw new Error('IDENTITY_REALM_PERMISSION_ISOLATION_INVALID');
    }

    if (options.collectEvidence === true) {
      formalEvidence = await collectFormalE12Evidence(database);
    }

    await database.exec(`update identity.account set credential_version=credential_version+1
      where id='account:realm-isolation:l11' and realm_id='realm:l11';`);
    await expectScalar(database, `select count(*)::integer value from identity_realm_fixture fixture
      cross join lateral identity.resolve_session(fixture.token_hash,fixture.accounts_host) resolved`, 11,
      'IDENTITY_REALM_CREDENTIAL_ROTATION_SCOPE_INVALID');
    await database.exec(`update identity.session set revoked_at=clock_timestamp(),revoked_reason='realm_fixture_logout'
      where account_id='account:realm-isolation:l10' and realm_id='realm:l10' and revoked_at is null;`);
    await expectScalar(database, `select count(*)::integer value from identity_realm_fixture fixture
      cross join lateral identity.resolve_session(fixture.token_hash,fixture.accounts_host) resolved`, 10,
      'IDENTITY_REALM_LOGOUT_SCOPE_INVALID');
  } finally {
    await database.exec('rollback');
  }
  return formalEvidence;
}

async function collectFormalE12Evidence(database) {
  const capturedAt = new Date().toISOString();
  const nodes = await database.query(`select level,node_id,realm_id,mall_id,accounts_host,organization_id,
      principal_id,account_id,membership_id,session_id,token_hash,membership_client
    from identity_realm_fixture where level in(0,1) order by level`);
  const nodeB = nodes.rows[0];
  const nodeA = nodes.rows[1];
  if (!nodeA || !nodeB) throw new Error('E12_FORMAL_BASELINE_FIXTURE_MISSING');

  await installCrossScopeFixture(database, nodeA);
  const before = await snapshotPersistentState(database, nodeA, nodeB);

  const positiveCases = [
    await resolveSessionCase(database, 'E12-POS-A-A', nodeA, nodeA.accounts_host),
    await resolveSessionCase(database, 'E12-POS-B-B', nodeB, nodeB.accounts_host),
  ];

  const unknownHost = await resolveSessionCase(database, 'E12-NEG-01-UNKNOWN-HOST', nodeA, 'unknown.e12.invalid');
  const ambiguousHost = await probeAmbiguousDatabaseHost(database, nodeA, nodeB);
  const crossRealm = await resolveSessionCase(database, 'E12-NEG-03-CROSS-REALM-HOST', nodeA, nodeB.accounts_host);
  const crossScope = await probeCrossScope(database, nodeA, nodeB);
  const wrongNode = await probeWrongNodeScope(nodeA, nodeB);
  const staleVersion = await probeSessionMutation(database, {
    caseId: 'E12-NEG-06-STALE-ACCESS-VERSION',
    savepoint: 'e12_stale_access_version',
    mutationSql: `update access.membership set access_version=access_version+1 where id=$1`,
    parameters: [nodeA.membership_id],
    source: nodeA,
  });
  const suspendedNode = await probeSessionMutation(database, {
    caseId: 'E12-NEG-07A-SUSPENDED-NODE',
    savepoint: 'e12_suspended_node',
    mutationSql: `update organization.node set status='suspended',updated_at=clock_timestamp() where id=$1`,
    parameters: [nodeA.node_id],
    source: nodeA,
  });
  const suspendedMembership = await probeSessionMutation(database, {
    caseId: 'E12-NEG-07B-SUSPENDED-MEMBERSHIP',
    savepoint: 'e12_suspended_membership',
    mutationSql: `update access.membership set status='suspended' where id=$1`,
    parameters: [nodeA.membership_id],
    source: nodeA,
  });
  const crossRealmWrite = await probeCrossRealmWrite(database, nodeA, nodeB);
  const forgeryCases = await probeAuthorityForgeries(database, nodeA, nodeB);
  const compatibilityPath = await probeCompatibilityPath(database);
  const after = await snapshotPersistentState(database, nodeA, nodeB);

  return Object.freeze({
    schema_version: 'e12-database-raw-evidence-v1',
    captured_at: capturedAt,
    baselines: Object.freeze({
      node_a: baselineIdentity(nodeA),
      node_b: baselineIdentity(nodeB),
    }),
    positive_cases: positiveCases,
    invalid_cases: [
      unknownHost,
      ambiguousHost,
      Object.freeze({ ...crossRealm, cross_realm_write_probe: crossRealmWrite }),
      crossScope,
      wrongNode,
      staleVersion,
      Object.freeze({
        case_id: 'E12-NEG-07-SUSPENDED-NODE-OR-MEMBERSHIP',
        request: { variants: ['suspended_node', 'suspended_membership'] },
        response: { node: suspendedNode.response, membership: suspendedMembership.response },
        variants: [suspendedNode, suspendedMembership],
      }),
    ],
    forgery_cases: forgeryCases,
    database_before: before,
    database_after: after,
    database_diff: compareSnapshots(before, after),
    compatibility_path: compatibilityPath,
  });
}

function baselineIdentity(row) {
  return Object.freeze({
    node_id: row.node_id,
    realm_id: row.realm_id,
    scope_id: row.organization_id,
    mall_id: row.mall_id,
    accounts_host: row.accounts_host,
    principal_id: row.principal_id,
    account_id: row.account_id,
    membership_id: row.membership_id,
    session_id: row.session_id,
  });
}

async function installCrossScopeFixture(database, nodeA) {
  await database.query(`insert into access.role(id,scope_id,name,status,version)
      values('role:e12-cross-scope-a',$1,'E12 Cross Scope A','active',1)`, [nodeA.organization_id]);
  await database.exec(`insert into access.rolepermission(role_id,permission_id,effect)
    select 'role:e12-cross-scope-a',id,'allow' from access.permission where code='access.scope.manage';`);
  await database.query(`insert into access.membershiprole(membership_id,role_id,effective_at)
      values($1,'role:e12-cross-scope-a',clock_timestamp())`, [nodeA.membership_id]);
  await database.query(`insert into access.scopegrant(
      id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version
    ) values('scope:e12-cross-scope-a',$1,'mall',$2,$2,'allow',clock_timestamp(),1)`,
  [nodeA.membership_id, nodeA.organization_id]);
}

async function resolveSessionCase(database, caseId, source, host) {
  const result = await database.query(`select actor_id,account_id,realm_id,session_id,membership_id,
      credential_version,access_version,target,membership_client,governance_organization_id,
      entry_realm_id,line_id,node_id,parent_node_id,signed_level,node_profile,mall_id,
      host_sovereign_node_id,relation_version
    from identity.resolve_session($1,$2)`, [source.token_hash, host]);
  return Object.freeze({
    case_id: caseId,
    request: {
      boundary: 'identity.resolve_session(text,text)',
      token_hash: source.token_hash,
      entry_host: host,
    },
    expected_context: caseId.startsWith('E12-POS-') ? {
      account_id: source.account_id,
      realm_id: source.realm_id,
      membership_id: source.membership_id,
      node_id: source.node_id,
      mall_id: source.mall_id,
    } : null,
    response: { row_count: result.rows.length, resolved_context: result.rows[0] ?? null },
  });
}

async function probeAmbiguousDatabaseHost(database, nodeA, nodeB) {
  await database.exec('savepoint e12_ambiguous_host');
  let databaseError = null;
  try {
    await database.query(`insert into identity.realmentry(host,realm_id,kind,status,created_at)
      values($1,$2,'accounts','active',clock_timestamp())`, [nodeA.accounts_host, nodeB.realm_id]);
  } catch (cause) {
    databaseError = serializeError(cause);
  }
  await database.exec('rollback to savepoint e12_ambiguous_host; release savepoint e12_ambiguous_host;');
  const remaining = await database.query('select host,realm_id from identity.realmentry where host=$1 order by realm_id', [nodeA.accounts_host]);
  return Object.freeze({
    case_id: 'E12-NEG-02-AMBIGUOUS-HOST',
    request: {
      boundary: 'identity.realmentry authority uniqueness',
      host: nodeA.accounts_host,
      existing_realm_id: nodeA.realm_id,
      attempted_realm_id: nodeB.realm_id,
    },
    response: { database_error: databaseError, authoritative_rows: remaining.rows },
  });
}

async function probeCrossScope(database, nodeA, nodeB) {
  const membership = await database.query(`select resolved.id,resolved.active,resolved.access_version,
      resolved.denies,resolved.grants
    from access.resolve_session_membership($1,$2,$3,$4) resolved`,
  [nodeA.membership_id, nodeA.realm_id, nodeA.membership_client, nodeA.organization_id]);
  const scope = await database.query(`select resolved.scope
    from access.resolve_session_scope($1,$2,$3,$4,'access.scopes.manage',null,$5) resolved`,
  [nodeA.membership_id, nodeA.realm_id, nodeA.membership_client, nodeA.organization_id, nodeB.organization_id]);
  const membershipRow = membership.rows[0];
  const scopeRow = scope.rows[0];
  if (!membershipRow || !scopeRow?.scope) {
    throw new Error(`E12_CROSS_SCOPE_RAW_CONTEXT_MISSING:${JSON.stringify({
      membership_rows: membership.rows,
      scope_rows: scope.rows,
      context: {
        membership_id: nodeA.membership_id,
        realm_id: nodeA.realm_id,
        client: nodeA.membership_client,
        organization_id: nodeA.organization_id,
        requested_scope_id: nodeB.organization_id,
      },
    })}`);
  }
  const { checkScope } = await import('@shop/authz');
  const decision = checkScope({
    id: membershipRow.id,
    active: membershipRow.active,
    accessVersion: Number(membershipRow.access_version),
    denies: membershipRow.denies,
    grants: membershipRow.grants,
  }, 'access.scope.manage', scopeRow.scope, new Date());
  return Object.freeze({
    case_id: 'E12-NEG-04-CROSS-SCOPE',
    request: {
      membership_id: nodeA.membership_id,
      membership_realm_id: nodeA.realm_id,
      membership_scope_id: nodeA.organization_id,
      requested_scope_id: nodeB.organization_id,
      operation: 'access.scopes.manage',
      permission: 'access.scope.manage',
    },
    response: {
      resolved_scope: scopeRow.scope,
      membership_access: membershipRow,
      policy_decision: decision,
    },
  });
}

async function probeWrongNodeScope(nodeA, nodeB) {
  const { NodeBoundScopeResolver } = await import('../../../01_core_hexin/services/commerce/src/foundation/security/NodeBoundScopeResolver.ts');
  const foreignScope = Object.freeze({ kind: 'tenant', id: nodeB.organization_id, path: Object.freeze([]) });
  const resolver = new NodeBoundScopeResolver({ resolve: async () => foreignScope }, nodeA.organization_id);
  let error = null;
  try {
    await resolver.resolve({ id: nodeA.principal_id }, 'access.scopes.manage');
  } catch (cause) {
    error = serializeError(cause);
  }
  return Object.freeze({
    case_id: 'E12-NEG-05-WRONG-NODE-IDENTITY',
    request: {
      authoritative_node_id: nodeA.node_id,
      claimed_node_id: nodeB.node_id,
      expected_scope_id: nodeA.organization_id,
      claimed_node_scope_id: nodeB.organization_id,
    },
    response: { error, resolved_foreign_scope: foreignScope },
  });
}

async function probeSessionMutation(database, input) {
  await database.exec(`savepoint ${input.savepoint}`);
  await database.query(input.mutationSql, input.parameters);
  const response = await resolveSessionCase(database, input.caseId, input.source, input.source.accounts_host);
  await database.exec(`rollback to savepoint ${input.savepoint}; release savepoint ${input.savepoint};`);
  return response;
}

async function probeCrossRealmWrite(database, nodeA, nodeB) {
  const access = await buildAccessContext(database, nodeA);
  const action = await sessionRevokeAction();
  const trace = 'e12-invalid-cross-realm-write';
  await database.exec('savepoint e12_cross_realm_write');
  const before = await writeProbeRows(database, nodeA, nodeB, trace);
  let response = null;
  let error = null;
  try {
    response = await action(operationRequest(access, nodeB.session_id, trace, {}), database);
  } catch (cause) {
    error = serializeError(cause);
  }
  const after = await writeProbeRows(database, nodeA, nodeB, trace);
  await database.exec('rollback to savepoint e12_cross_realm_write; release savepoint e12_cross_realm_write;');
  return Object.freeze({
    request: { source_realm_id: nodeA.realm_id, target_session_id: nodeB.session_id, target_realm_id: nodeB.realm_id },
    response,
    error,
    before,
    after,
  });
}

async function probeAuthorityForgeries(database, nodeA, nodeB) {
  const access = await buildAccessContext(database, nodeA);
  const action = await sessionRevokeAction();
  const forgeries = [
    ['realm', nodeB.realm_id, 'x-realm-id'],
    ['membership', nodeB.membership_id, 'x-membership-id'],
    ['scope', nodeB.organization_id, 'x-scope-hint'],
    ['node_id', nodeB.node_id, 'x-sfl-node-id'],
    ['mall_id', nodeB.mall_id, 'x-mall-id'],
    ['role', 'role-platform-owner-v2', 'x-role'],
  ];
  const cases = [];
  for (const [field, value, header] of forgeries) {
    const savepoint = `e12_forgery_${field}`;
    const trace = `e12-forgery-${field}`;
    const injected = { [field]: value };
    await database.exec(`savepoint ${savepoint}`);
    const before = await writeProbeRows(database, nodeA, nodeB, trace);
    let response = null;
    let error = null;
    try {
      response = await action(operationRequest(access, nodeA.session_id, trace, { header, value, injected }), database);
    } catch (cause) {
      error = serializeError(cause);
    }
    const after = await writeProbeRows(database, nodeA, nodeB, trace);
    await database.exec(`rollback to savepoint ${savepoint}; release savepoint ${savepoint};`);
    cases.push(Object.freeze({
      case_id: `E12-FORGE-${field.toUpperCase()}`,
      field,
      request: {
        method: 'DELETE',
        operation: 'identity.sessions.revoke',
        path_session_id: nodeA.session_id,
        headers: { [header]: value },
        body: injected,
      },
      authoritative_context: {
        realm_id: access.actor.realm,
        membership_id: access.membership.id,
        scope_id: access.scope.id,
        node_id: nodeA.node_id,
        mall_id: nodeA.mall_id,
        role_ids: ['role:self', 'role:e12-cross-scope-a'],
      },
      response,
      error,
      database_before: before,
      database_after_write_before_rollback: after,
    }));
  }
  return Object.freeze(cases);
}

async function buildAccessContext(database, node) {
  const session = await resolveSessionCase(database, 'E12-INTERNAL-ACCESS-CONTEXT', node, node.accounts_host);
  const actor = session.response.resolved_context;
  if (!actor) throw new Error('E12_ACCESS_SESSION_UNRESOLVED');
  const membership = await database.query(`select resolved.id,resolved.active,resolved.access_version,
      resolved.denies,resolved.grants from access.resolve_session_membership($1,$2,$3,$4) resolved`,
  [actor.membership_id, actor.realm_id, actor.membership_client, actor.governance_organization_id]);
  const scope = await database.query(`select resolved.scope from access.resolve_session_scope(
      $1,$2,$3,$4,'identity.sessions.revoke',$5,null) resolved`,
  [actor.membership_id, actor.realm_id, actor.membership_client, actor.governance_organization_id, actor.session_id]);
  const membershipRow = membership.rows[0];
  if (!membershipRow || !scope.rows[0]?.scope) throw new Error('E12_ACCESS_CONTEXT_INCOMPLETE');
  return Object.freeze({
    actor: Object.freeze({
      id: actor.actor_id,
      account: actor.account_id,
      realm: actor.realm_id,
      membershipClient: actor.membership_client,
      governanceOrganization: actor.governance_organization_id,
      session: actor.session_id,
      membership: actor.membership_id,
      credentialVersion: Number(actor.credential_version),
      accessVersion: Number(actor.access_version),
      target: actor.target,
      assurance: Object.freeze({ level: 1 }),
    }),
    membership: Object.freeze({
      id: membershipRow.id,
      active: membershipRow.active,
      accessVersion: Number(membershipRow.access_version),
      denies: membershipRow.denies,
      grants: membershipRow.grants,
    }),
    scope: scope.rows[0].scope,
    accessVersion: Number(actor.access_version),
    capabilities: Object.freeze(['identity.sessions.revoke']),
    assurance: Object.freeze({ level: 1 }),
    trace: 'e12-authoritative-access-context',
  });
}

async function sessionRevokeAction() {
  const { sessionTicketOperations } = await import('../../../01_core_hexin/services/commerce/src/modules/identity/05_interface_jieru/http/SessionTicketOperations.ts');
  const actions = sessionTicketOperations({
    codeDigest: () => '',
    digest: () => '',
    kms: {},
    passwords: {},
    tickets: {},
  });
  const action = actions['identity.sessions.revoke'];
  if (typeof action !== 'function') throw new Error('E12_SESSION_REVOKE_ACTION_MISSING');
  return action;
}

function operationRequest(access, sessionId, trace, forgery) {
  const headers = forgery.header === undefined ? {} : { [forgery.header]: String(forgery.value) };
  const body = forgery.injected ?? {};
  return Object.freeze({
    type: 'identity.sessions.revoke',
    access,
    input: Object.freeze({
      path: Object.freeze({ sessionid: sessionId }),
      query: Object.freeze({}),
      headers: Object.freeze(headers),
      body: Object.freeze(body),
      rawBody: JSON.stringify(body),
      deadline: Date.now() + 30_000,
      signal: new AbortController().signal,
      idempotency: trace,
    }),
  });
}

async function writeProbeRows(database, nodeA, nodeB, trace) {
  const [sessions, outbox] = await Promise.all([
    database.query(`select id,realm_id,membership_id,revoked_at,revoked_reason
      from identity.session where id in($1,$2) order by id`, [nodeA.session_id, nodeB.session_id]),
    database.query(`select event_type,aggregate_type,aggregate_id,scope_id,trace_id,payload
      from runtime.outbox where trace_id=$1 order by id`, [trace]),
  ]);
  return Object.freeze({ sessions: sessions.rows, outbox: outbox.rows });
}

async function probeCompatibilityPath(database) {
  const availability = await database.query(`select
      to_regprocedure('identity.resolve_session(text)')::text legacy_session_resolver,
      to_regprocedure('identity.resolve_session(text,text)')::text authoritative_session_resolver,
      to_regprocedure('identity.resolve_active_membership_context(text,text,text)')::text active_membership_resolver,
      to_regprocedure('access.resolve_session_membership(text,text,text,text)')::text scoped_membership_resolver,
      to_regprocedure('access.resolve_session_scope(text,text,text,text,text,text,text)')::text scoped_scope_resolver`);
  return Object.freeze({
    request_path: [
      'server-authoritative Host resolver',
      'identity.resolve_session(text,text)',
      'identity.resolve_active_membership_context(text,text,text)',
      'access.resolve_session_membership(text,text,text,text)',
      'access.resolve_session_scope(text,text,text,text,text,text,text)',
    ],
    resolver_availability: availability.rows[0],
  });
}

async function snapshotPersistentState(database, nodeA, nodeB) {
  const tables = await database.query(`select schemaname,tablename from pg_tables
    where schemaname not like 'pg_%' and schemaname not in('information_schema','supabase_migrations')
    order by schemaname,tablename`);
  const tableDigests = {};
  for (const { schemaname, tablename } of tables.rows) {
    const identifier = `${quoteIdentifier(schemaname)}.${quoteIdentifier(tablename)}`;
    const digest = await database.query(`select count(*)::integer row_count,
      md5(coalesce(string_agg(row_json,E'\\n' order by row_json),'')) content_md5
      from(select row_to_json(e12_snapshot_record_9f31)::text row_json
        from ${identifier} e12_snapshot_record_9f31) rows`);
    tableDigests[`${schemaname}.${tablename}`] = digest.rows[0];
  }
  const ownership = await database.query(`select 'realm' record_type,id,coalesce(node_id,'') owner_a,
      coalesce(status,'') owner_b,coalesce(mall_id,'') owner_c from identity.realm where id in($1,$2)
    union all select 'account',id,realm_id,status,credential_version::text from identity.account where id in($3,$4)
    union all select 'membership',id,coalesce(realm_id,''),coalesce(account_id,''),organization_id
      from access.membership where id in($5,$6)
    union all select 'node',id,realm_id,status,coalesce(mall_id,'') from organization.node where id in($7,$8)
    order by record_type,id`, [nodeA.realm_id, nodeB.realm_id, nodeA.account_id, nodeB.account_id,
    nodeA.membership_id, nodeB.membership_id, nodeA.node_id, nodeB.node_id]);
  const outbox = await database.query(`select count(*)::integer row_count,
    count(*) filter(where trace_id like 'e12-%')::integer e12_row_count from runtime.outbox`);
  return Object.freeze({ table_digests: tableDigests, authoritative_ownership_rows: ownership.rows, outbox: outbox.rows[0] });
}

function compareSnapshots(before, after) {
  const changedTables = Object.keys(before.table_digests).filter((table) =>
    JSON.stringify(before.table_digests[table]) !== JSON.stringify(after.table_digests[table]));
  return Object.freeze({
    changed_tables: changedTables,
    changed_table_count: changedTables.length,
    authoritative_ownership_changed: JSON.stringify(before.authoritative_ownership_rows)
      !== JSON.stringify(after.authoritative_ownership_rows),
    outbox_row_delta: Number(after.outbox.row_count) - Number(before.outbox.row_count),
    e12_outbox_row_delta: Number(after.outbox.e12_row_count) - Number(before.outbox.e12_row_count),
  });
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function serializeError(cause) {
  if (cause && typeof cause === 'object') {
    return Object.freeze({
      name: cause.name ?? 'Error',
      message: cause.message ?? String(cause),
      code: cause.code ?? null,
      operation_result: cause.result ?? null,
    });
  }
  return Object.freeze({ name: 'Error', message: String(cause), code: null, operation_result: null });
}

async function assertCanonicalIdentityNodeManifest(database) {
  const [realmResult, entryResult, targetResult] = await Promise.all([
    database.query(`select id,node_id,status,node_profile,mall_id,host_node_id,host_node_profile
      from identity.realm order by id`),
    database.query(`select host,realm_id,kind,status from identity.realmentry order by host`),
    database.query(`select realm_id,surface,target,membership_client,membership_organization_id,
      application_slug,return_origin,node_profile from identity.realmtarget order by realm_id,target`),
  ]);
  const expected = {
    realms: identityNodeManifest.nodes.map((node) => ({
      id: node.realmId, node_id: node.nodeId, status: node.status, node_profile: node.nodeProfile,
      mall_id: node.mallId, host_node_id: node.hostNodeId,
      host_node_profile: node.nodeProfile === 'consumer' ? 'operating_mall' : null,
    })).sort((left, right) => left.id.localeCompare(right.id)),
    entries: identityNodeManifest.nodes.flatMap((node) => node.entries.map((entry) => ({
      host: entry.host, realm_id: node.realmId, kind: entry.kind, status: entry.status,
    }))).sort((left, right) => left.host.localeCompare(right.host)),
    targets: identityNodeManifest.nodes.flatMap((node) => node.targets.map((target) => ({
      realm_id: node.realmId, surface: target.surface, target: target.target,
      membership_client: target.membershipClient, membership_organization_id: target.membershipOrganizationId,
      application_slug: target.application, return_origin: target.returnOrigin, node_profile: node.nodeProfile,
    }))).sort((left, right) => `${left.realm_id}:${left.target}`.localeCompare(`${right.realm_id}:${right.target}`)),
  };
  const actual = { realms: realmResult.rows, entries: entryResult.rows, targets: targetResult.rows };
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`IDENTITY_NODE_MANIFEST_MIGRATION_DRIFT:${identityNodeManifest.revision}`);
  }
}

async function expectScalar(database, sql, expected, code) {
  const result = await database.query(sql);
  if (result.rows[0]?.value !== expected) throw new Error(`${code}:${JSON.stringify(result.rows[0] ?? null)}`);
}
