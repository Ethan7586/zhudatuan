create function pg_temp.seed_hosted_node(
  p_key text,p_parent text,p_level integer,p_host text
) returns text language plpgsql as $function$
declare
  v_node text:='node:'||p_key||':l'||p_level;
  v_realm text:='realm:'||p_key||'-l'||p_level;
begin
  insert into identity.realm(
    id,node_id,status,created_at,updated_at,node_profile,mall_id,host_node_id,host_node_profile
  ) values(v_realm,v_node,'active',clock_timestamp(),clock_timestamp(),'consumer',null,p_host,'operating_mall');
  perform organization.provision_hosted_node(jsonb_build_object(
    'idempotency_key','seed:'||p_key||':l'||p_level,'node_id',v_node,'parent_node_id',p_parent,
    'realm_id',v_realm,'node_profile','consumer','mall_id',null,'signed_level','L'||p_level,
    'effective_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'requested_by','contract','trace_id','seed:'||p_key||':l'||p_level
  ));
  return v_node;
end
$function$;

create function pg_temp.seed_member_identity(
  p_key text,p_node text,p_organization text,p_subject char(64)
) returns text language plpgsql as $function$
declare
  v_realm text;
  v_principal text:='principal:'||p_key;
  v_account text:='account:'||p_key;
  v_membership text:='membership:'||p_key;
begin
  select realm_id into v_realm from organization.node where id=p_node;
  insert into identity.principal(id,status,created_at,updated_at)
  values(v_principal,'active',clock_timestamp(),clock_timestamp());
  insert into identity.account(id,realm_id,legacy_principal_id,status,credential_version,assurance_level,created_at,updated_at)
  values(v_account,v_realm,v_principal,'active',1,2,clock_timestamp(),clock_timestamp());
  insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,created_at,realm_id,account_id)
  values('credential:'||p_key,v_principal,'password',p_subject,'hash:'||p_key,'active',clock_timestamp(),v_realm,v_account);
  insert into access.membership(id,member_id,organization_id,client,status,realm_id,account_id,node_profile,access_version)
  values(v_membership,'member:'||p_key,p_organization,'storefront','active',v_realm,v_account,'consumer',1);
  insert into identity.realmtarget(
    realm_id,surface,target,membership_client,membership_organization_id,application_slug,return_origin,created_at,node_profile
  ) values(v_realm,'consumer','storefront-'||p_key,'storefront',p_organization,null,
    'https://host.test/'||p_key,clock_timestamp(),'consumer');
  return v_membership;
end
$function$;

select pg_temp.seed_hosted_node('open-a-l3','node:zhudatuan:l0',3,'node:zhudatuan:l0');
select pg_temp.seed_hosted_node('open-a-l6','node:zhudatuan:l0',6,'node:zhudatuan:l0');
select pg_temp.seed_hosted_node('open-a-l7','node:open-a-l6:l6',7,'node:zhudatuan:l0');
select pg_temp.seed_hosted_node('open-a-l8','node:open-a-l7:l7',8,'node:zhudatuan:l0');
select pg_temp.seed_hosted_node('open-a-l9','node:open-a-l8:l8',9,'node:zhudatuan:l0');
select pg_temp.seed_hosted_node('open-a-l10','node:open-a-l9:l9',10,'node:zhudatuan:l0');
select pg_temp.seed_hosted_node('open-a-l11','node:open-a-l10:l10',11,'node:zhudatuan:l0');

select pg_temp.seed_hosted_node('open-b-l6','node:mall-b:l0',6,'node:mall-b:l0');
select pg_temp.seed_hosted_node('open-b-l7','node:open-b-l6:l6',7,'node:mall-b:l0');
select pg_temp.seed_hosted_node('open-b-l8','node:open-b-l7:l7',8,'node:mall-b:l0');

select pg_temp.seed_hosted_node('rollback-l6','node:zhudatuan:l0',6,'node:zhudatuan:l0');
select pg_temp.seed_hosted_node('concurrent-l6','node:zhudatuan:l0',6,'node:zhudatuan:l0');
select pg_temp.seed_hosted_node('race-l6','node:zhudatuan:l0',6,'node:zhudatuan:l0');

select pg_temp.seed_member_identity('open-a-l3','node:open-a-l3:l3','mall-zhudatuan',repeat('3',64));
select pg_temp.seed_member_identity('open-a-l6','node:open-a-l6:l6','mall-zhudatuan',repeat('6',64));
select pg_temp.seed_member_identity('open-a-l8','node:open-a-l8:l8','mall-zhudatuan',repeat('8',64));
select pg_temp.seed_member_identity('open-a-l11','node:open-a-l11:l11','mall-zhudatuan',repeat('b',64));
select pg_temp.seed_member_identity('open-b-l8','node:open-b-l8:l8','mall:mall-b',repeat('8',64));
select pg_temp.seed_member_identity('rollback-l6','node:rollback-l6:l6','mall-zhudatuan',repeat('c',64));
select pg_temp.seed_member_identity('concurrent-l6','node:concurrent-l6:l6','mall-zhudatuan',repeat('d',64));
select pg_temp.seed_member_identity('race-l6','node:race-l6:l6','mall-zhudatuan',repeat('e',64));

create temp table hosted_mall_opening_before as
select node.id node_id,node.line_id,node.realm_id,node.sovereignty_tier,node.node_profile,node.mall_id,
  relation.parent_node_id,relation.original_parent_node_id,relation.signed_level,relation.host_sovereign_node_id,
  relation.relation_version,relation.effective_at,relation.superseded_at,
  membership.id membership_id,membership.account_id,account.legacy_principal_id principal_id,
  array(select closure.ancestor_node_id from organization.nodeclosure closure
    where closure.line_id=node.line_id and closure.descendant_node_id=node.id and closure.superseded_at is null
    order by closure.depth desc) lineage,
  (select count(*) from organization.noderelation history
    where history.line_id=node.line_id and history.node_id=node.id) relation_history_count,
  (select count(*) from organization.hostednodeprovisioning) provisioning_count
from organization.node node
join organization.noderelation relation on relation.line_id=node.line_id and relation.node_id=node.id
  and relation.superseded_at is null
join identity.realm realm on realm.id=node.realm_id
join access.membership membership on membership.realm_id=realm.id and membership.status='active'
join identity.account account on account.id=membership.account_id and account.realm_id=membership.realm_id
where node.id in('node:open-a-l3:l3','node:open-a-l6:l6','node:open-a-l8:l8','node:open-a-l11:l11',
  'node:open-b-l8:l8','node:rollback-l6:l6','node:concurrent-l6:l6','node:race-l6:l6');

do $opening$
declare
  sample record;
  opened record;
  replay record;
  same_phone char(64):=repeat('8',64);
begin
  for sample in select * from (values
    ('open-a-l3','L3'),('open-a-l6','L6'),('open-a-l8','L8'),('open-a-l11','L11')
  ) value(sample_key,expected_level) loop
    select * into opened from organization.open_hosted_member_mall(
      'membership:'||sample.sample_key,'node:'||sample.sample_key||':l'||substring(sample.expected_level from 2),
      jsonb_build_object('idempotency_key','opening:'||sample.sample_key,
        'mall_name','商城 '||sample.sample_key,'operating_entity_name','经营主体 '||sample.sample_key)
    );
    if opened.signed_level<>sample.expected_level or opened.sovereignty_tier<>'hosted'
      or opened.node_profile<>'operating_mall' or opened.capabilities<>array['consumer','operating_mall']
      or opened.capability_version<>2 or opened.relation_version<>1 or opened.replayed then
      raise exception 'SFL_HOSTED_MALL_OPENING_SAMPLE_INVALID:%',sample.sample_key;
    end if;
  end loop;

  if (select node_profile from organization.node where id='node:open-b-l8:l8')<>'consumer'
    or exists(select 1 from organization.hostedmallopening where node_id='node:open-b-l8:l8') then
    raise exception 'SFL_HOSTED_MALL_OPENING_REALM_B_PREMATURE_MUTATION';
  end if;
  if (select count(distinct realm_id) from identity.credential where subject_hash=same_phone)<>2 then
    raise exception 'SFL_HOSTED_MALL_OPENING_SHARED_CREDENTIAL_FIXTURE_INVALID';
  end if;

  select * into opened from organization.open_hosted_member_mall(
    'membership:open-b-l8','node:open-b-l8:l8',jsonb_build_object(
      'idempotency_key','opening:open-b-l8','mall_name','商城 open-b-l8','operating_entity_name','经营主体 open-b-l8'));
  if opened.realm_id=(select realm_id from organization.hostedmallopening where node_id='node:open-a-l8:l8')
    or opened.line_id=(select line_id from organization.hostedmallopening where node_id='node:open-a-l8:l8')
    or opened.mall_id=(select mall_id from organization.hostedmallopening where node_id='node:open-a-l8:l8') then
    raise exception 'SFL_HOSTED_MALL_OPENING_MULTI_REALM_NOT_ISOLATED';
  end if;

  select * into replay from organization.open_hosted_member_mall(
    'membership:open-a-l8','node:open-a-l8:l8',jsonb_build_object(
      'idempotency_key','opening:open-a-l8','mall_name','商城 open-a-l8','operating_entity_name','经营主体 open-a-l8'));
  if not replay.replayed or replay.mall_id<>(select mall_id from organization.hostedmallopening where node_id='node:open-a-l8:l8') then
    raise exception 'SFL_HOSTED_MALL_OPENING_REPLAY_INVALID';
  end if;

  begin
    perform organization.open_hosted_member_mall(
      'membership:open-a-l8','node:open-a-l8:l8',jsonb_build_object(
        'idempotency_key','opening:open-a-l8','mall_name','被替换的商城名','operating_entity_name','经营主体 open-a-l8'));
    raise exception 'EXPECTED_IDEMPOTENCY_CONFLICT';
  exception when others then
    if sqlerrm not like '%SFL_HOSTED_MALL_OPENING_IDEMPOTENCY_KEY_REUSED%' then raise; end if;
  end;
  begin
    perform organization.open_hosted_member_mall(
      'membership:open-a-l8','node:open-a-l8:l8',jsonb_build_object(
        'idempotency_key','opening:different-key','mall_name','商城 open-a-l8','operating_entity_name','经营主体 open-a-l8'));
    raise exception 'EXPECTED_NODE_CONFLICT';
  exception when others then
    if sqlerrm not like '%SFL_HOSTED_MALL_ALREADY_OPEN%' then raise; end if;
  end;
end
$opening$;

do $immutability$
declare changed_count integer;
begin
  select count(*) into changed_count
  from hosted_mall_opening_before before
  join organization.node node on node.id=before.node_id
  join organization.noderelation relation on relation.line_id=node.line_id and relation.node_id=node.id
    and relation.superseded_at is null
  join access.membership membership on membership.id=before.membership_id
  join identity.account account on account.id=membership.account_id and account.realm_id=membership.realm_id
  where before.node_id not in('node:rollback-l6:l6','node:concurrent-l6:l6') and (
    node.id<>before.node_id or node.line_id<>before.line_id or node.realm_id<>before.realm_id
    or node.sovereignty_tier<>before.sovereignty_tier
    or relation.parent_node_id is distinct from before.parent_node_id
    or relation.original_parent_node_id is distinct from before.original_parent_node_id
    or relation.signed_level<>before.signed_level
    or relation.host_sovereign_node_id<>before.host_sovereign_node_id
    or relation.relation_version<>before.relation_version or relation.effective_at<>before.effective_at
    or relation.superseded_at is distinct from before.superseded_at
    or membership.id<>before.membership_id or membership.account_id<>before.account_id
    or account.legacy_principal_id<>before.principal_id
    or before.lineage<>array(select closure.ancestor_node_id from organization.nodeclosure closure
      where closure.line_id=node.line_id and closure.descendant_node_id=node.id and closure.superseded_at is null
      order by closure.depth desc)
    or before.relation_history_count<>(select count(*) from organization.noderelation history
      where history.line_id=node.line_id and history.node_id=node.id)
  );
  if changed_count<>0 then raise exception 'SFL_HOSTED_MALL_OPENING_LINEAGE_CHANGED'; end if;
  if exists(select 1 from organization.hostedmallopening opening
      join organization.nodecapabilityversion baseline on baseline.node_id=opening.node_id and baseline.capability_version=1
      join organization.nodecapabilityversion upgraded on upgraded.node_id=opening.node_id
        and upgraded.capability_version=opening.capability_version
      where baseline.capabilities<>array['consumer'] or upgraded.capabilities<>array['consumer','operating_mall'])
    or (select count(*) from organization.nodecapabilityversion capability
      where capability.opening_id is not null)<>5 then
    raise exception 'SFL_HOSTED_MALL_OPENING_CAPABILITY_HISTORY_INVALID';
  end if;
end
$immutability$;

do $zero_infrastructure$
begin
  if exists(select 1 from organization.hostedmallconfiguration configuration
      where configuration.infrastructure_mode<>'shared_host' or configuration.entry_mode<>'hosted_path'
        or configuration.payment_mode<>'host_shared_reference'
        or configuration.shared_payment_binding_ref<>'host-sovereign-node:'||configuration.host_sovereign_node_id||':payment')
    or exists(select 1 from identity.realmentry entry
      join organization.hostedmallopening opening on opening.realm_id=entry.realm_id)
    or exists(select 1 from organization.hostedmallopening opening
      where opening.host_sovereign_node_id=opening.node_id or opening.sovereignty_tier<>'hosted')
    or (select max(provisioning_count) from hosted_mall_opening_before)
      <>(select count(*) from organization.hostednodeprovisioning)
    or (select count(*) from runtime.outbox where event_type='sfl.hosted_mall.opened')<>5
    or (select count(*) from organization.change where kind='sfl.hosted_mall.opened')<>5 then
    raise exception 'SFL_HOSTED_MALL_OPENING_ZERO_INFRASTRUCTURE_INVALID';
  end if;
end
$zero_infrastructure$;

do $interruption$
declare before_row hosted_mall_opening_before%rowtype;
begin
  select * into before_row from hosted_mall_opening_before where node_id='node:rollback-l6:l6';
  perform set_config('sfl.hosted_mall_opening_interrupt','after-config',true);
  begin
    perform organization.open_hosted_member_mall(
      'membership:rollback-l6','node:rollback-l6:l6',jsonb_build_object(
        'idempotency_key','opening:rollback-l6','mall_name','回滚商城','operating_entity_name','回滚经营主体'));
    raise exception 'EXPECTED_INTERRUPTION';
  exception when others then
    if sqlerrm not like '%SFL_HOSTED_MALL_OPENING_TEST_INTERRUPT%' then raise; end if;
  end;
  perform set_config('sfl.hosted_mall_opening_interrupt','',true);
  if exists(select 1 from organization.hostedmallopening where node_id=before_row.node_id)
    or (select node_profile from organization.node where id=before_row.node_id)<>before_row.node_profile
    or (select mall_id from organization.node where id=before_row.node_id) is not null
    or (select count(*) from organization.nodecapabilityversion where node_id=before_row.node_id)<>1
    or (select count(*) from organization.noderelation where node_id=before_row.node_id)<>before_row.relation_history_count then
    raise exception 'SFL_HOSTED_MALL_OPENING_INTERRUPTION_ROLLBACK_INVALID';
  end if;
  perform organization.open_hosted_member_mall(
    'membership:rollback-l6','node:rollback-l6:l6',jsonb_build_object(
      'idempotency_key','opening:rollback-l6','mall_name','回滚商城','operating_entity_name','回滚经营主体'));
  if (select count(*) from organization.hostedmallopening where node_id=before_row.node_id)<>1
    or (select count(*) from organization.nodecapabilityversion where node_id=before_row.node_id)<>2 then
    raise exception 'SFL_HOSTED_MALL_OPENING_INTERRUPTION_RETRY_INVALID';
  end if;
end
$interruption$;

do $failed_request$
declare before_row hosted_mall_opening_before%rowtype;
begin
  select * into before_row from hosted_mall_opening_before where node_id='node:concurrent-l6:l6';
  begin
    perform organization.open_hosted_member_mall(
      'membership:concurrent-l6','node:concurrent-l6:l6',jsonb_build_object(
        'idempotency_key','opening:invalid','mall_name','','operating_entity_name','失败经营主体'));
    raise exception 'EXPECTED_VALIDATION_FAILURE';
  exception when others then
    if sqlerrm not like '%SFL_HOSTED_MALL_OPENING_REQUEST_INVALID%' then raise; end if;
  end;
  if (select node_profile from organization.node where id=before_row.node_id)<>before_row.node_profile
    or (select count(*) from organization.noderelation where node_id=before_row.node_id)<>before_row.relation_history_count
    or (select count(*) from organization.nodecapabilityversion where node_id=before_row.node_id)<>1 then
    raise exception 'SFL_HOSTED_MALL_OPENING_FAILED_REQUEST_MUTATED_NODE';
  end if;
end
$failed_request$;
