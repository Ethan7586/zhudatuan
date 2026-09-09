begin;

select pg_advisory_xact_lock(hashtext('sfl:reprovision-disabled-autonode-identity-realm:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'AUTONODE_IDENTITY_REPROVISION_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260909062500'
        and checksum='1dac0e1d1a329ea966975df812bffbe076155c9aa7d8f9da88d3350f23604ed3')
    or exists(select 1 from runtime.schemaversion where version>'20260909062500') then
    raise exception 'AUTONODE_IDENTITY_REPROVISION_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

create or replace function identity.provision_node_realm(p_fact jsonb)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,pg_temp
as $function$
declare
  v_activation text := nullif(btrim(p_fact->>'activation_request_id'),'');
  v_provisioning text := nullif(btrim(p_fact->>'provisioning_request_id'),'');
  v_manifest_id text := nullif(btrim(p_fact->>'manifest_id'),'');
  v_manifest_digest text := nullif(btrim(p_fact->>'manifest_digest'),'');
  v_realm jsonb := p_fact->'realm';
  v_realm_id text := nullif(btrim(v_realm->>'id'),'');
  v_node_id text := nullif(btrim(v_realm->>'node_id'),'');
  v_node_profile text := nullif(btrim(v_realm->>'node_profile'),'');
  v_mall_id text := nullif(btrim(v_realm->>'mall_id'),'');
  v_host_node_id text := nullif(btrim(v_realm->>'host_node_id'),'');
  v_existing identity.nodeprovisioning%rowtype;
  v_entry_count integer;
  v_target_count integer;
  v_reconfigured boolean := false;
begin
  if p_fact->>'schema_version'<>'sfl.autonode-identity-realm-fact.v1'
    or v_activation is null or v_provisioning is null or v_manifest_id is null
    or v_manifest_digest is null or v_manifest_digest !~ '^sha256:[0-9a-f]{64}$'
    or jsonb_typeof(v_realm)<>'object'
    or jsonb_typeof(p_fact->'entries')<>'array'
    or jsonb_typeof(p_fact->'targets')<>'array'
    or v_realm_id is null or v_node_id is null
    or v_node_profile not in('operating_mall','consumer') then
    raise exception 'AUTONODE_IDENTITY_REALM_FACT_INVALID';
  end if;
  if (v_node_profile='operating_mall' and (v_mall_id is null or v_host_node_id is not null))
    or (v_node_profile='consumer' and (v_mall_id is not null or v_host_node_id is null)) then
    raise exception 'AUTONODE_IDENTITY_REALM_PROFILE_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtext('autonode:'||v_activation));
  select * into v_existing from identity.nodeprovisioning
  where activation_request_id=v_activation for update;

  if found then
    if v_existing.provisioning_request_id<>v_provisioning
      or v_existing.node_id<>v_node_id or v_existing.realm_id<>v_realm_id then
      raise exception 'AUTONODE_IDENTITY_REALM_IDEMPOTENCY_CONFLICT';
    end if;
    if v_existing.fact<>p_fact then
      if v_existing.status<>'disabled'
        or not exists(select 1 from identity.realm
          where id=v_realm_id and node_id=v_node_id and status='disabled'
            and node_profile=v_node_profile
            and mall_id is not distinct from v_mall_id
            and host_node_id is not distinct from v_host_node_id)
        or exists(select 1 from identity.realmentry where realm_id=v_realm_id and status<>'disabled') then
        raise exception 'AUTONODE_IDENTITY_REALM_REPROVISION_INVALID';
      end if;

      delete from identity.realmtarget where realm_id=v_realm_id;
      delete from identity.realmentry where realm_id=v_realm_id;

      insert into identity.realmentry(host,realm_id,kind,status,created_at)
      select entry.host,v_realm_id,entry.kind,'active',clock_timestamp()
      from jsonb_to_recordset(p_fact->'entries') as entry(host text,kind text,status text)
      where entry.status='active';
      get diagnostics v_entry_count=row_count;
      if v_entry_count<>jsonb_array_length(p_fact->'entries') or v_entry_count<2 then
        raise exception 'AUTONODE_IDENTITY_REALM_ENTRIES_INVALID';
      end if;

      insert into identity.realmtarget(
        realm_id,surface,target,membership_client,membership_organization_id,
        application_slug,return_origin,created_at,node_profile
      )
      select v_realm_id,target.surface,target.target,target.membership_client,target.membership_organization_id,
        target.application_slug,target.return_origin,clock_timestamp(),v_node_profile
      from jsonb_to_recordset(p_fact->'targets') as target(
        surface text,target text,membership_client text,membership_organization_id text,
        application_slug text,return_origin text,node_profile text
      )
      where target.node_profile=v_node_profile;
      get diagnostics v_target_count=row_count;
      if v_target_count<>jsonb_array_length(p_fact->'targets') or v_target_count<1 then
        raise exception 'AUTONODE_IDENTITY_REALM_TARGETS_INVALID';
      end if;

      update identity.nodeprovisioning set
        manifest_id=v_manifest_id,
        manifest_digest=v_manifest_digest,
        fact=p_fact,
        status='active',
        updated_at=clock_timestamp()
      where activation_request_id=v_activation;
      v_reconfigured := true;
    end if;
  else
    if exists(select 1 from identity.nodeprovisioning
        where provisioning_request_id=v_provisioning or node_id=v_node_id or realm_id=v_realm_id)
      or exists(select 1 from identity.realm where id=v_realm_id or node_id=v_node_id) then
      raise exception 'AUTONODE_IDENTITY_REALM_OWNERSHIP_CONFLICT';
    end if;

    insert into identity.realm(
      id,node_id,status,created_at,updated_at,version,node_profile,mall_id,host_node_id,host_node_profile
    ) values(
      v_realm_id,v_node_id,'active',clock_timestamp(),clock_timestamp(),0,v_node_profile,v_mall_id,v_host_node_id,
      case when v_node_profile='consumer' then 'operating_mall' else null end
    );

    insert into identity.realmentry(host,realm_id,kind,status,created_at)
    select entry.host,v_realm_id,entry.kind,'active',clock_timestamp()
    from jsonb_to_recordset(p_fact->'entries') as entry(host text,kind text,status text)
    where entry.status='active';
    get diagnostics v_entry_count=row_count;
    if v_entry_count<>jsonb_array_length(p_fact->'entries') or v_entry_count<2 then
      raise exception 'AUTONODE_IDENTITY_REALM_ENTRIES_INVALID';
    end if;

    insert into identity.realmtarget(
      realm_id,surface,target,membership_client,membership_organization_id,
      application_slug,return_origin,created_at,node_profile
    )
    select v_realm_id,target.surface,target.target,target.membership_client,target.membership_organization_id,
      target.application_slug,target.return_origin,clock_timestamp(),v_node_profile
    from jsonb_to_recordset(p_fact->'targets') as target(
      surface text,target text,membership_client text,membership_organization_id text,
      application_slug text,return_origin text,node_profile text
    )
    where target.node_profile=v_node_profile;
    get diagnostics v_target_count=row_count;
    if v_target_count<>jsonb_array_length(p_fact->'targets') or v_target_count<1 then
      raise exception 'AUTONODE_IDENTITY_REALM_TARGETS_INVALID';
    end if;

    insert into identity.nodeprovisioning(
      activation_request_id,provisioning_request_id,node_id,realm_id,manifest_id,manifest_digest,
      fact,status,created_at,updated_at
    ) values(
      v_activation,v_provisioning,v_node_id,v_realm_id,v_manifest_id,v_manifest_digest,
      p_fact,'active',clock_timestamp(),clock_timestamp()
    );
  end if;

  update identity.realm set status='active',updated_at=clock_timestamp(),version=version+1
  where id=v_realm_id and status<>'active';
  update identity.realmentry set status='active' where realm_id=v_realm_id and status<>'active';
  update identity.nodeprovisioning set status='active',updated_at=clock_timestamp()
  where activation_request_id=v_activation and status<>'active';

  if (select count(*) from identity.realmentry where realm_id=v_realm_id)
      <>jsonb_array_length(p_fact->'entries')
    or (select count(*) from identity.realmtarget where realm_id=v_realm_id)
      <>jsonb_array_length(p_fact->'targets') then
    raise exception 'AUTONODE_IDENTITY_REALM_FACT_DRIFT';
  end if;

  return jsonb_build_object(
    'activation_request_id',v_activation,
    'node_id',v_node_id,
    'realm_id',v_realm_id,
    'status','active',
    'reconfigured',v_reconfigured,
    'entry_count',jsonb_array_length(p_fact->'entries'),
    'target_count',jsonb_array_length(p_fact->'targets')
  );
end
$function$;

revoke all on function identity.provision_node_realm(jsonb) from public;
grant execute on function identity.provision_node_realm(jsonb) to zhudatuanprovisioningapi;

insert into runtime.schemaversion(version,checksum)
values('20260909063000','3db05bef6312ad2f2508a64f788b254329ab0448ec7c11c443e3273356529090');

do $assert$
begin
  if to_regprocedure('identity.provision_node_realm(jsonb)') is null
    or has_function_privilege('public','identity.provision_node_realm(jsonb)','execute')
    or not has_function_privilege('zhudatuanprovisioningapi','identity.provision_node_realm(jsonb)','execute')
    or not exists(select 1 from runtime.schemaversion
      where version='20260909063000'
        and checksum='3db05bef6312ad2f2508a64f788b254329ab0448ec7c11c443e3273356529090') then
    raise exception 'AUTONODE_IDENTITY_REPROVISION_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
