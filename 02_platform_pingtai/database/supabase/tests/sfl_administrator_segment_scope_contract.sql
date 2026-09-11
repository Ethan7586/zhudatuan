create function pg_temp.admin_scope_request(p_action text,p_segment text,p_key text,p_root text default 'node:a:l0')
returns jsonb language sql immutable as $function$
  select jsonb_build_object(
    'action',p_action,'role_id','role:segment-administrator','segment',p_segment,
    'root_node_id',p_root,'idempotency_key',p_key,'trace_id','trace:'||p_key
  )
$function$;

create temporary table administrator_segment_before as
select node.id node_id,node.line_id,node.realm_id,node.node_profile,node.mall_id,
  relation.parent_node_id,relation.original_parent_node_id,relation.signed_level,relation.relation_version
from organization.node node join organization.noderelation relation on relation.node_id=node.id
  and relation.line_id=node.line_id and relation.superseded_at is null;

do $grant$
declare changed record; replay record;
begin
  select * into changed from access.change_administrator_segment_scope(
    'membership:owner','membership:admin-first',1,pg_temp.admin_scope_request('grant','first_segment','scope:first'));
  if changed.action<>'grant' or changed.segment<>'first_segment' or changed.access_version<>2 or changed.replayed
    or changed.business_number!~'^SFL-ADMIN-[0-9A-F]{16}$' then raise exception 'SFL_ADMIN_FIRST_SCOPE_INVALID'; end if;
  select * into replay from access.change_administrator_segment_scope(
    'membership:owner','membership:admin-first',1,pg_temp.admin_scope_request('grant','first_segment','scope:first'));
  if not replay.replayed or replay.business_number<>changed.business_number or replay.scope_version<>changed.scope_version then
    raise exception 'SFL_ADMIN_SCOPE_REPLAY_INVALID';
  end if;
  perform access.change_administrator_segment_scope(
    'membership:owner','membership:admin-second',1,pg_temp.admin_scope_request('grant','second_segment','scope:second'));
  perform access.change_administrator_segment_scope(
    'membership:owner','membership:admin-both',1,pg_temp.admin_scope_request('grant','both_segments','scope:both'));
  perform access.change_administrator_segment_scope(
    'membership:owner','membership:admin-dual',1,pg_temp.admin_scope_request('grant','first_segment','scope:dual:first'));
end
$grant$;

do $read_scope$
declare context record;
begin
  if (select array_agg(signed_level order by signed_level) from access.list_administrator_members(
      'membership:admin-first',null,100))<>array['L0','L3','L5']
    or (select array_agg(signed_level order by signed_level) from access.list_administrator_members(
      'membership:admin-second',null,100))<>array['L11','L6','L8']
    or (select count(*) from access.list_administrator_members('membership:admin-both',null,100))<>6 then
    raise exception 'SFL_ADMIN_SEGMENT_READ_FILTER_INVALID';
  end if;
  if access.administrator_member_visible('membership:admin-first','node:a:l8')
    or access.administrator_member_visible('membership:admin-second','node:a:l3')
    or access.administrator_member_visible('membership:admin-both','node:a:l-1')
    or access.administrator_member_visible('membership:admin-both','node:b:l3')
    or exists(select 1 from access.read_administrator_member('membership:admin-first','node:a:l8')) then
    raise exception 'SFL_ADMIN_SCOPE_OUTSIDE_VISIBLE';
  end if;
  select * into context from access.resolve_administrator_context('membership:admin-dual');
  if context.principal_id<>'principal:dual' or context.active_membership_id<>'membership:admin-dual'
    or context.realm_id<>'realm:a-l0' or context.segment<>'first_segment'
    or not ('member.read'=any(context.permissions)) or not ('member.manage'=any(context.permissions)) then
    raise exception 'SFL_ADMIN_ACTIVE_IDENTITY_CONTEXT_INVALID';
  end if;
  if exists(select 1 from access.resolve_administrator_context('membership:member-dual'))
    or exists(select 1 from access.resolve_administrator_context('membership:member-only')) then
    raise exception 'SFL_MEMBER_IDENTITY_GAINED_ADMINISTRATOR_CONTEXT';
  end if;
end
$read_scope$;

do $write_scope$
declare context record; note record;
begin
  select * into context from access.resolve_administrator_context('membership:admin-first');
  select * into note from access.record_administrator_member_note(
    'membership:admin-first',context.administrator_identity_id,context.scope_version,
    'node:a:l3','note:first:l3','已完成会员资料复核','trace:note:first:l3');
  if note.target_node_id<>'node:a:l3' or note.replayed or note.business_number!~'^SFL-NOTE-[0-9A-F]{16}$' then
    raise exception 'SFL_ADMIN_MEMBER_WRITE_INVALID';
  end if;
  begin
    perform access.record_administrator_member_note(
      'membership:admin-first',context.administrator_identity_id,context.scope_version,
      'node:a:l8','note:first:l8','越界写入','trace:note:first:l8');
    raise exception 'EXPECTED_SCOPE_DENIAL';
  exception when others then
    if sqlerrm not like '%SFL_ADMIN_MEMBER_WRITE_DENIED%' then raise; end if;
  end;
  if exists(select 1 from access.administratormembernote where target_node_id='node:a:l8') then
    raise exception 'SFL_ADMIN_MEMBER_OUTSIDE_WRITE_PERSISTED';
  end if;
end
$write_scope$;

do $versioning$
declare previous_scope_id text; changed record;
begin
  select scope_id into previous_scope_id from access.administratorsegmentscope scope
  join access.administratoridentity identity on identity.id=scope.administrator_identity_id
  where identity.membership_id='membership:admin-dual' and scope.status='active';
  select * into changed from access.change_administrator_segment_scope(
    'membership:owner','membership:admin-dual',2,pg_temp.admin_scope_request('replace','both_segments','scope:dual:both'));
  if changed.scope_version<>2 or changed.access_version<>3 or changed.segment<>'both_segments'
    or (select status from access.administratorsegmentscope where scope_id=previous_scope_id)<>'revoked'
    or (select count(*) from access.administratorsegmentscope scope join access.administratoridentity identity
      on identity.id=scope.administrator_identity_id where identity.membership_id='membership:admin-dual')<>2 then
    raise exception 'SFL_ADMIN_SCOPE_VERSION_HISTORY_INVALID';
  end if;
  if exists(select 1 from access.administratorsegmentscope scope join access.administratoridentity identity
      on identity.id=scope.administrator_identity_id where identity.membership_id='membership:admin-dual'
      and scope.scope_version=1 and scope.access_version<>2) then raise exception 'SFL_ADMIN_OLD_SCOPE_REWRITTEN'; end if;
  begin
    perform access.change_administrator_segment_scope(
      'membership:owner','membership:admin-dual',3,
      pg_temp.admin_scope_request('replace','first_segment','scope:dual:both'));
    raise exception 'EXPECTED_IDEMPOTENCY_CONFLICT';
  exception when others then
    if sqlerrm not like '%SFL_ADMIN_SCOPE_IDEMPOTENCY_KEY_REUSED%' then raise; end if;
  end;
end
$versioning$;

do $revoke$
declare before_version bigint;
begin
  select access_version into before_version from access.membership where id='membership:admin-second';
  perform access.change_administrator_segment_scope(
    'membership:owner','membership:admin-second',before_version,
    pg_temp.admin_scope_request('revoke','second_segment','scope:second:revoke'));
  if exists(select 1 from access.resolve_administrator_context('membership:admin-second'))
    or (select status from access.administratoridentity where membership_id='membership:admin-second')<>'revoked'
    or (select access_version from access.membership where id='membership:admin-second')<>before_version+1 then
    raise exception 'SFL_ADMIN_SCOPE_REVOKE_INVALID';
  end if;
end
$revoke$;

do $rollback$
begin
  perform set_config('sfl.admin_scope_interrupt','after-scope',true);
  begin
    perform access.change_administrator_segment_scope(
      'membership:owner','membership:admin-fault',1,pg_temp.admin_scope_request('grant','both_segments','scope:fault'));
    raise exception 'EXPECTED_INTERRUPTION';
  exception when others then
    if sqlerrm not like '%SFL_ADMIN_SCOPE_TEST_INTERRUPT%' then raise; end if;
  end;
  perform set_config('sfl.admin_scope_interrupt','',true);
  if exists(select 1 from access.administratoridentity where membership_id='membership:admin-fault')
    or (select access_version from access.membership where id='membership:admin-fault')<>1
    or exists(select 1 from access.administratorsegmentchange where idempotency_key='scope:fault') then
    raise exception 'SFL_ADMIN_SCOPE_INTERRUPTION_NOT_ROLLED_BACK';
  end if;
  perform access.change_administrator_segment_scope(
    'membership:owner','membership:admin-fault',1,pg_temp.admin_scope_request('grant','both_segments','scope:fault'));
end
$rollback$;

do $invariants$
begin
  if exists(
    select 1 from administrator_segment_before before
    full join (
      select node.id node_id,node.line_id,node.realm_id,node.node_profile,node.mall_id,
        relation.parent_node_id,relation.original_parent_node_id,relation.signed_level,relation.relation_version
      from organization.node node join organization.noderelation relation on relation.node_id=node.id
        and relation.line_id=node.line_id and relation.superseded_at is null
    ) after using(node_id)
    where before is distinct from after
  ) then raise exception 'SFL_ADMIN_ROLE_CHANGED_MEMBER_NODE_FACTS'; end if;
  if exists(select 1 from organization.noderelation where signed_level not in('L0','L3','L5','L6','L8','L11','L-1'))
    or (select count(*) from runtime.outbox where event_type='access.administrator.scope.changed')<>7
    or (select count(*) from runtime.outbox where event_type='access.administrator.member.noted')<>1
    or exists(select 1 from access.administratoridentity identity join access.membership membership
      on membership.id=identity.membership_id where membership.client<>'operator') then
    raise exception 'SFL_ADMIN_SEGMENT_FINAL_FACTS_INVALID';
  end if;
end
$invariants$;
