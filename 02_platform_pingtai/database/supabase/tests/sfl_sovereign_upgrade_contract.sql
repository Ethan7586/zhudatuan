create function pg_temp.sovereign_request(p_key text)
returns jsonb language sql immutable as $function$
  select jsonb_build_object(
    'idempotency_key','sovereign-upgrade:'||p_key,
    'brand_ref','brand:'||p_key||':v1',
    'public_api_host','api.'||p_key||'.example.com',
    'storefront_host','shop.'||p_key||'.example.com',
    'accounts_host','accounts.'||p_key||'.example.com',
    'console_host','console.'||p_key||'.example.com',
    'payment_callback_host','pay.'||p_key||'.example.com',
    'edge_binding_ref','edge:'||p_key||':v1',
    'tunnel_ref','tunnel:'||p_key||':v1',
    'gateway_ref','gateway:'||p_key||':v1',
    'runtime_identity_ref','runtime:'||p_key||':v1',
    'data_scope_ref','scope:'||p_key||':v1',
    'secret_binding_set_ref','secrets:'||p_key||':v1',
    'payment_binding_ref','payment:'||p_key||':v1',
    'callback_binding_ref','callback:'||p_key||':v1',
    'runtime_config_ref','runtime-config:'||p_key||':v1'
  )
$function$;

select pg_temp.seed_hosted_node('upgrade-l2','node:hbbtzn:l1',2,'node:hbbtzn:l1');
select pg_temp.seed_hosted_node('upgrade-chain-l3','node:upgrade-l2:l2',3,'node:hbbtzn:l1');
select pg_temp.seed_hosted_node('upgrade-chain-l4','node:upgrade-chain-l3:l3',4,'node:hbbtzn:l1');
select pg_temp.seed_hosted_node('upgrade-l5','node:upgrade-chain-l4:l4',5,'node:hbbtzn:l1');
select pg_temp.seed_hosted_node('upgrade-consumer','node:upgrade-chain-l3:l3',4,'node:hbbtzn:l1');
select pg_temp.seed_hosted_node('upgrade-rollback','node:open-a-l6:l6',7,'node:zhudatuan:l0');
select pg_temp.seed_hosted_node('upgrade-fault-domain','node:upgrade-l2:l2',3,'node:hbbtzn:l1');
select pg_temp.seed_hosted_node('upgrade-fault-tunnel','node:open-a-l8:l8',9,'node:zhudatuan:l0');
select pg_temp.seed_hosted_node('upgrade-fault-manifest','node:upgrade-fault-tunnel:l9',10,'node:zhudatuan:l0');
select pg_temp.seed_hosted_node('upgrade-concurrent','node:zhudatuan:l0',6,'node:zhudatuan:l0');
select pg_temp.seed_hosted_node('upgrade-race','node:upgrade-fault-manifest:l10',11,'node:zhudatuan:l0');

select pg_temp.seed_member_identity('upgrade-l2','node:upgrade-l2:l2','mall-zhudatuan',repeat('1',64));
select pg_temp.seed_member_identity('upgrade-l5','node:upgrade-l5:l5','mall-zhudatuan',repeat('2',64));
select pg_temp.seed_member_identity('upgrade-consumer','node:upgrade-consumer:l4','mall-zhudatuan',repeat('3',64));
select pg_temp.seed_member_identity('upgrade-rollback','node:upgrade-rollback:l7','mall-zhudatuan',repeat('4',64));
select pg_temp.seed_member_identity('upgrade-fault-domain','node:upgrade-fault-domain:l3','mall-zhudatuan',repeat('5',64));
select pg_temp.seed_member_identity('upgrade-fault-tunnel','node:upgrade-fault-tunnel:l9','mall-zhudatuan',repeat('6',64));
select pg_temp.seed_member_identity('upgrade-fault-manifest','node:upgrade-fault-manifest:l10','mall-zhudatuan',repeat('7',64));
select pg_temp.seed_member_identity('upgrade-concurrent','node:upgrade-concurrent:l6','mall-zhudatuan',repeat('8',64));
select pg_temp.seed_member_identity('upgrade-race','node:upgrade-race:l11','mall-zhudatuan',repeat('9',64));

do $open$
declare p_key text;
begin
  foreach p_key in array array['upgrade-l2','upgrade-l5','upgrade-rollback','upgrade-fault-domain',
    'upgrade-fault-tunnel','upgrade-fault-manifest','upgrade-concurrent','upgrade-race'] loop
    perform organization.open_hosted_member_mall(
      'membership:'||p_key,
      'node:'||p_key||':l'||case p_key when 'upgrade-l2' then '2' when 'upgrade-l5' then '5'
        when 'upgrade-rollback' then '7' when 'upgrade-fault-domain' then '3'
        when 'upgrade-fault-tunnel' then '9' when 'upgrade-fault-manifest' then '10'
        when 'upgrade-concurrent' then '6' else '11' end,
      jsonb_build_object('idempotency_key','opening:'||p_key,'mall_name','商城 '||p_key,
        'operating_entity_name','经营主体 '||p_key));
  end loop;
end
$open$;

create temp table sovereign_upgrade_before as
select node.id node_id,node.line_id,node.realm_id,node.mall_id,node.node_profile,node.sovereignty_tier,
  relation.parent_node_id,relation.original_parent_node_id,relation.signed_level,
  relation.host_sovereign_node_id,relation.relation_version,
  membership.id membership_id,membership.account_id,account.legacy_principal_id principal_id,
  opening.operating_entity_id,
  array(select closure.ancestor_node_id from organization.nodeclosure closure
    where closure.line_id=node.line_id and closure.descendant_node_id=node.id and closure.superseded_at is null
    order by closure.depth desc) lineage,
  (select count(*) from organization.noderelation history where history.node_id=node.id) relation_count
from organization.node node
join organization.noderelation relation on relation.line_id=node.line_id and relation.node_id=node.id
  and relation.superseded_at is null
join access.membership membership on membership.realm_id=node.realm_id and membership.status='active'
join identity.account account on account.id=membership.account_id and account.realm_id=membership.realm_id
left join organization.hostedmallopening opening on opening.node_id=node.id
where node.id in('node:upgrade-l2:l2','node:upgrade-l5:l5','node:open-a-l8:l8','node:open-b-l8:l8',
  'node:upgrade-rollback:l7','node:upgrade-fault-domain:l3','node:upgrade-fault-tunnel:l9',
  'node:upgrade-fault-manifest:l10','node:upgrade-concurrent:l6','node:upgrade-race:l11');

do $upgrade$
declare sample record; upgraded record; replay record;
begin
  for sample in select * from (values
    ('upgrade-l2','node:upgrade-l2:l2','membership:upgrade-l2','L2'),
    ('upgrade-l5','node:upgrade-l5:l5','membership:upgrade-l5','L5'),
    ('open-a-l8','node:open-a-l8:l8','membership:open-a-l8','L8')
  ) value(sample_key,node_id,membership_id,expected_level) loop
    select * into upgraded from organization.upgrade_hosted_mall_to_sovereign(
      sample.membership_id,sample.node_id,pg_temp.sovereign_request(sample.sample_key));
    if upgraded.node_id<>sample.node_id or upgraded.signed_level<>sample.expected_level
      or upgraded.source_tier<>'hosted' or upgraded.target_tier<>'sovereign'
      or upgraded.node_profile<>'operating_mall' or upgraded.status<>'upgraded'
      or upgraded.host_sovereign_node_id<>sample.node_id or upgraded.previous_relation_version<>1
      or upgraded.active_relation_version<>2 or upgraded.manifest_version<>1
      or upgraded.manifest_digest!~'^sha256:[0-9a-f]{64}$' or not upgraded.recoverable or upgraded.replayed then
      raise exception 'SFL_SOVEREIGN_UPGRADE_SAMPLE_INVALID:%',sample.sample_key;
    end if;
  end loop;

  select * into replay from organization.upgrade_hosted_mall_to_sovereign(
    'membership:open-a-l8','node:open-a-l8:l8',pg_temp.sovereign_request('open-a-l8'));
  if not replay.replayed or replay.upgrade_id<>(select upgrade_id from organization.sovereignupgrade
    where node_id='node:open-a-l8:l8') then raise exception 'SFL_SOVEREIGN_UPGRADE_REPLAY_INVALID'; end if;

  begin
    perform organization.upgrade_hosted_mall_to_sovereign('membership:open-a-l8','node:open-a-l8:l8',
      pg_temp.sovereign_request('open-a-l8')||jsonb_build_object('brand_ref','brand:changed:v2'));
    raise exception 'EXPECTED_IDEMPOTENCY_CONFLICT';
  exception when others then
    if sqlerrm not like '%SFL_SOVEREIGN_UPGRADE_IDEMPOTENCY_KEY_REUSED%' then raise; end if;
  end;
  begin
    perform organization.upgrade_hosted_mall_to_sovereign('membership:upgrade-l2','node:upgrade-l2:l2',
      jsonb_set(pg_temp.sovereign_request('upgrade-l2'),'{idempotency_key}','"other-key"'));
    raise exception 'EXPECTED_NODE_CONFLICT';
  exception when others then
    if sqlerrm not like '%SFL_SOVEREIGN_UPGRADE_NODE_ALREADY_CLAIMED%' then raise; end if;
  end;
end
$upgrade$;

do $invariants$
declare changed integer;
begin
  select count(*) into changed from sovereign_upgrade_before before
  join organization.node node on node.id=before.node_id
  join organization.noderelation relation on relation.line_id=node.line_id and relation.node_id=node.id
    and relation.superseded_at is null
  join access.membership membership on membership.id=before.membership_id
  join identity.account account on account.id=membership.account_id and account.realm_id=membership.realm_id
  where before.node_id in('node:upgrade-l2:l2','node:upgrade-l5:l5','node:open-a-l8:l8') and (
    node.id<>before.node_id or node.line_id<>before.line_id or node.realm_id<>before.realm_id
    or node.mall_id<>before.mall_id or node.node_profile<>before.node_profile or node.sovereignty_tier<>'sovereign'
    or relation.parent_node_id is distinct from before.parent_node_id
    or relation.original_parent_node_id is distinct from before.original_parent_node_id
    or relation.signed_level<>before.signed_level or relation.host_sovereign_node_id<>node.id
    or membership.id<>before.membership_id or membership.account_id<>before.account_id
    or account.legacy_principal_id<>before.principal_id
    or before.lineage<>array(select closure.ancestor_node_id from organization.nodeclosure closure
      where closure.line_id=node.line_id and closure.descendant_node_id=node.id and closure.superseded_at is null
      order by closure.depth desc)
    or (select count(*) from organization.noderelation history where history.node_id=node.id)<>before.relation_count+1
  );
  if changed<>0 then raise exception 'SFL_SOVEREIGN_UPGRADE_IDENTITY_OR_LINEAGE_CHANGED'; end if;
  if (select sovereignty_tier from organization.node where id='node:open-b-l8:l8')<>'hosted'
    or exists(select 1 from organization.sovereignupgrade where node_id='node:open-b-l8:l8') then
    raise exception 'SFL_SOVEREIGN_UPGRADE_REALM_B_CHANGED';
  end if;
  if (select sovereignty_tier from organization.node where id='node:upgrade-consumer:l4')<>'hosted'
    or exists(select 1 from organization.sovereignupgrade where node_id='node:upgrade-consumer:l4') then
    raise exception 'SFL_SOVEREIGN_UPGRADE_CONSUMER_CHANGED';
  end if;
  if (select count(*) from organization.sovereignupgrade where status='upgraded')<>3
    or (select count(*) from organization.domainbindingset where status='active')<>3
    or (select count(*) from organization.domainbinding where status='active')<>15
    or (select count(*) from organization.noderesourcebindingset where status='active')<>3
    or (select count(*) from organization.nodemanifestversion where status='active')<>3
    or exists(select 1 from organization.nodemanifestversion where manifest ? 'release_pointer_ref'
      and manifest->'release_pointer_ref'<>'null'::jsonb) then
    raise exception 'SFL_SOVEREIGN_UPGRADE_ACTIVE_FACTS_INVALID';
  end if;
  if (select count(distinct host) from organization.domainbinding)<>15
    or (select count(distinct secret_binding_set_ref) from organization.noderesourcebindingset)<>3
    or (select count(distinct payment_binding_ref) from organization.noderesourcebindingset)<>3
    or (select count(distinct runtime_identity_ref) from organization.noderesourcebindingset)<>3
    or (select count(distinct manifest_digest) from organization.nodemanifestversion)<>3 then
    raise exception 'SFL_SOVEREIGN_UPGRADE_RESOURCE_ISOLATION_INVALID';
  end if;
end
$invariants$;

do $consumer_only$
begin
  begin
    perform organization.upgrade_hosted_mall_to_sovereign(
      'membership:upgrade-consumer','node:upgrade-consumer:l4',pg_temp.sovereign_request('upgrade-consumer'));
    raise exception 'EXPECTED_CONTEXT_FAILURE';
  exception when others then
    if sqlerrm not like '%SFL_SOVEREIGN_UPGRADE_CONTEXT_INVALID%' then raise; end if;
  end;
  if exists(select 1 from organization.sovereignupgrade where node_id='node:upgrade-consumer:l4')
    or exists(select 1 from organization.nodemanifestversion where node_id='node:upgrade-consumer:l4') then
    raise exception 'SFL_SOVEREIGN_UPGRADE_CONSUMER_MUTATED';
  end if;
end
$consumer_only$;

do $faults$
declare sample record; before_relations bigint;
begin
  for sample in select * from (values
    ('upgrade-fault-domain','node:upgrade-fault-domain:l3','membership:upgrade-fault-domain','after-plan'),
    ('upgrade-fault-tunnel','node:upgrade-fault-tunnel:l9','membership:upgrade-fault-tunnel','after-resources'),
    ('upgrade-fault-manifest','node:upgrade-fault-manifest:l10','membership:upgrade-fault-manifest','after-manifest')
  ) value(sample_key,node_id,membership_id,interrupt_at) loop
    select count(*) into before_relations from organization.noderelation where node_id=sample.node_id;
    perform set_config('sfl.sovereign_upgrade_interrupt',sample.interrupt_at,true);
    begin
      perform organization.upgrade_hosted_mall_to_sovereign(
        sample.membership_id,sample.node_id,pg_temp.sovereign_request(sample.sample_key));
      raise exception 'EXPECTED_INTERRUPTION';
    exception when others then
      if sqlerrm not like '%SFL_SOVEREIGN_UPGRADE_TEST_INTERRUPT%' then raise; end if;
    end;
    perform set_config('sfl.sovereign_upgrade_interrupt','',true);
    if (select sovereignty_tier from organization.node where id=sample.node_id)<>'hosted'
      or exists(select 1 from organization.sovereignupgrade where node_id=sample.node_id)
      or exists(select 1 from organization.nodemanifestversion where node_id=sample.node_id)
      or (select count(*) from organization.noderelation where node_id=sample.node_id)<>before_relations then
      raise exception 'SFL_SOVEREIGN_UPGRADE_FAULT_NOT_ROLLED_BACK:%',sample.sample_key;
    end if;
    perform organization.upgrade_hosted_mall_to_sovereign(
      sample.membership_id,sample.node_id,pg_temp.sovereign_request(sample.sample_key));
  end loop;
end
$faults$;

do $rollback$
declare upgraded record;
begin
  select * into upgraded from organization.upgrade_hosted_mall_to_sovereign(
    'membership:upgrade-rollback','node:upgrade-rollback:l7',pg_temp.sovereign_request('upgrade-rollback'));
  perform organization.rollback_sovereign_upgrade(upgraded.upgrade_id,'contract recovery');
  if (select sovereignty_tier from organization.node where id=upgraded.node_id)<>'hosted'
    or (select host_sovereign_node_id from organization.noderelation where node_id=upgraded.node_id
      and superseded_at is null)<>upgraded.previous_host_sovereign_node_id
    or (select status from organization.sovereignupgrade where upgrade_id=upgraded.upgrade_id)<>'rolled_back'
    or (select status from organization.nodemanifestversion where upgrade_id=upgraded.upgrade_id)<>'rolled_back'
    or not exists(select 1 from organization.hostedmallopening where node_id=upgraded.node_id and status='active') then
    raise exception 'SFL_SOVEREIGN_UPGRADE_ROLLBACK_INVALID';
  end if;
end
$rollback$;
