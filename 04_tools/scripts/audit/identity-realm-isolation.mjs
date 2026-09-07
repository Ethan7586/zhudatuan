export async function verifyIdentityRealmIsolation(database) {
  await database.exec('begin');
  try {
    await database.exec(`
      create temporary table identity_realm_fixture(
        level integer primary key,
        node_id text not null,
        realm_id text not null,
        accounts_host text not null,
        admin_target text not null,
        organization_id text not null,
        principal_id text not null,
        account_id text not null,
        member_id text not null,
        membership_id text not null,
        session_id text not null,
        token_hash text not null
      );
      insert into identity_realm_fixture
      select level,'l'||level,'realm:l'||level,
        case level when 0 then 'accounts.zhudatuan.com' when 1 then 'accounts.hbbtzn.com'
          else 'accounts.l'||level||'.identity.test' end,
        case level when 1 then 'console-hbbtzn' else 'console' end,
        case level when 1 then 'mall:d1708f04df2dd8a61736852c4900fb43' else 'tenant-zhudatuan' end,
        'principal:realm-isolation:l'||level,'account:realm-isolation:l'||level,
        'member:realm-isolation:l'||level,'membership:realm-isolation:l'||level,
        'session:realm-isolation:l'||level,
        encode(public.digest('session-token:realm-isolation:l'||level,'sha256'),'hex')
      from generate_series(0,11) level;

      insert into identity.realm(id,node_id,status,created_at,updated_at)
      select realm_id,node_id,'active',clock_timestamp(),clock_timestamp()
      from identity_realm_fixture where level>=2;

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
        realm_id,surface,target,membership_client,membership_organization_id,application_slug,return_origin,created_at
      )
      select realm_id,'admin','console','operator','tenant-zhudatuan',null,
        'https://console.l'||level||'.identity.test',clock_timestamp()
      from identity_realm_fixture where level>=2
      union all
      select realm_id,'consumer','storefront','storefront','mall-zhudatuan','l'||level||'-storefront',
        'https://l'||level||'.identity.test',clock_timestamp()
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
        id,member_id,organization_id,client,status,access_version,joined_at,realm_id,account_id
      )
      select membership_id,member_id,organization_id,'operator','active',1,clock_timestamp(),realm_id,account_id
      from identity_realm_fixture;

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
      select session_id,principal_id,membership_id,token_hash,level+1,1,'operator',repeat('c',64),
        'realm-isolation-fixture','fixture-device',1,clock_timestamp()+interval '1 hour',clock_timestamp(),
        clock_timestamp(),realm_id,account_id,admin_target
      from identity_realm_fixture;

      insert into identity.authticket(
        id,session_id,token_hash,state_hash,nonce_hash,pkce_challenge,target,expires_at,created_at,realm_id,account_id
      )
      select 'ticket:realm-isolation:l'||level,session_id,
        encode(public.digest('ticket:realm-isolation:l'||level,'sha256'),'hex'),
        encode(public.digest('state:realm-isolation:l'||level,'sha256'),'hex'),
        encode(public.digest('nonce:realm-isolation:l'||level,'sha256'),'hex'),
        repeat('A',43),admin_target,clock_timestamp()+interval '10 minutes',clock_timestamp(),realm_id,account_id
      from identity_realm_fixture;

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

    const resolved = await database.query(`select fixture.level,resolved.account_id,resolved.realm_id,resolved.membership_id
      from identity_realm_fixture fixture
      cross join lateral identity.resolve_session(fixture.token_hash,fixture.accounts_host) resolved
      order by fixture.level`);
    if (resolved.rows.length !== 12 || resolved.rows.some((row) => row.account_id !== `account:realm-isolation:l${row.level}`
      || row.realm_id !== `realm:l${row.level}` || row.membership_id !== `membership:realm-isolation:l${row.level}`)) {
      throw new Error('IDENTITY_REALM_SESSION_RESOLUTION_INVALID');
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
}

async function expectScalar(database, sql, expected, code) {
  const result = await database.query(sql);
  if (result.rows[0]?.value !== expected) throw new Error(`${code}:${JSON.stringify(result.rows[0] ?? null)}`);
}
