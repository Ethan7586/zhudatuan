\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

begin;

create temp table e05_before as
select
  (select count(*) from organization.node where id like 'node:e05-h%')::integer hosted_nodes,
  (select count(*) from access.membership where id like 'membership:e05-h%')::integer memberships,
  (select count(*) from access.decisionaudit where trace_id='trace:e05-zero-fanout')::integer audit_rows,
  (select count(*) from runtime.outbox where trace_id='trace:e05-zero-fanout')::integer outbox_rows;

do $precondition$
begin
  if (select hosted_nodes<>0 or memberships<>0 or audit_rows<>0 or outbox_rows<>0 from e05_before) then
    raise exception 'SFL_E05_FIXTURE_NOT_EMPTY';
  end if;
  if not exists(select 1 from member.profile) then
    raise exception 'SFL_E05_MEMBER_PROFILE_REQUIRED';
  end if;
end
$precondition$;

insert into identity.realm(
  id,node_id,status,node_profile,mall_id,host_node_id,host_node_profile,created_at,updated_at
) values
  ('realm:e05-h1','node:e05-h1:l2','active','consumer',null,'node:zhudatuan:l0','operating_mall','2026-09-13T00:00:00.000Z','2026-09-13T00:00:00.000Z'),
  ('realm:e05-h2','node:e05-h2:l3','active','consumer',null,'node:zhudatuan:l0','operating_mall','2026-09-13T00:00:00.000Z','2026-09-13T00:00:00.000Z'),
  ('realm:e05-h3','node:e05-h3:l4','active','consumer',null,'node:zhudatuan:l0','operating_mall','2026-09-13T00:00:00.000Z','2026-09-13T00:00:00.000Z');

select organization.provision_hosted_node(jsonb_build_object(
  'effective_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'idempotency_key','e05:create:h1','mall_id',null,
  'node_id','node:e05-h1:l2','node_profile','consumer','parent_node_id','node:zhudatuan:l0',
  'realm_id','realm:e05-h1','requested_by','principal:e05','signed_level','L2','trace_id','trace:e05-zero-fanout'));
select organization.provision_hosted_node(jsonb_build_object(
  'effective_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'idempotency_key','e05:create:h2','mall_id',null,
  'node_id','node:e05-h2:l3','node_profile','consumer','parent_node_id','node:zhudatuan:l0',
  'realm_id','realm:e05-h2','requested_by','principal:e05','signed_level','L3','trace_id','trace:e05-zero-fanout'));
select organization.provision_hosted_node(jsonb_build_object(
  'effective_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'idempotency_key','e05:create:h3','mall_id',null,
  'node_id','node:e05-h3:l4','node_profile','consumer','parent_node_id','node:zhudatuan:l0',
  'realm_id','realm:e05-h3','requested_by','principal:e05','signed_level','L4','trace_id','trace:e05-zero-fanout'));

insert into identity.account(id,realm_id,status,created_at,updated_at)
values
  ('account:e05-h1','realm:e05-h1','active','2026-09-13T00:00:00.000Z','2026-09-13T00:00:00.000Z'),
  ('account:e05-h2','realm:e05-h2','active','2026-09-13T00:00:00.000Z','2026-09-13T00:00:00.000Z'),
  ('account:e05-h3','realm:e05-h3','active','2026-09-13T00:00:00.000Z','2026-09-13T00:00:00.000Z');

insert into access.membership(
  id,member_id,organization_id,client,status,access_version,joined_at,realm_id,account_id,node_profile
)
select fixture.membership_id,profile.id,fixture.node_id,'storefront','active',1,'2026-09-13T00:00:00.000Z',
  fixture.realm_id,fixture.account_id,'consumer'
from (select id from member.profile order by id limit 1) profile
cross join (values
  ('membership:e05-h1','node:e05-h1:l2','realm:e05-h1','account:e05-h1'),
  ('membership:e05-h2','node:e05-h2:l3','realm:e05-h2','account:e05-h2'),
  ('membership:e05-h3','node:e05-h3:l4','realm:e05-h3','account:e05-h3')
) fixture(membership_id,node_id,realm_id,account_id);

insert into capability.capability(id,kind,name,version,status)
values
  ('capability:e05-base','feature','e05.hosted.base',1,'active'),
  ('capability:e05-extra','feature','e05.hosted.extra',1,'active');

insert into runtime.event(type,version,owner,schema_ref)
values
  ('HostedNodeCreated',1,'organization','fixture://sfl/e05/hosted-node-created'),
  ('HostedNodeSuspended',1,'organization','fixture://sfl/e05/hosted-node-suspended'),
  ('HostedNodeReactivated',1,'organization','fixture://sfl/e05/hosted-node-reactivated'),
  ('HostedNodeGrantChanged',1,'access','fixture://sfl/e05/hosted-node-grant-changed')
on conflict(type,version) do nothing;

insert into capability.entitlement(id,scope_id,capability_id,state,effective_at,version)
values
  ('entitlement:e05-h1:base','node:e05-h1:l2','capability:e05-base','enabled','2026-09-13T00:00:00.000Z',1),
  ('entitlement:e05-h2:base','node:e05-h2:l3','capability:e05-base','enabled','2026-09-13T00:00:00.000Z',1),
  ('entitlement:e05-h3:base','node:e05-h3:l4','capability:e05-base','enabled','2026-09-13T00:00:00.000Z',1);

insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
values
  ('scope:e05-h1:base','membership:e05-h1','self','node:e05-h1:l2','/node/e05-h1','allow','2026-09-13T00:00:00.000Z',1),
  ('scope:e05-h2:base','membership:e05-h2','self','node:e05-h2:l3','/node/e05-h2','allow','2026-09-13T00:00:00.000Z',1),
  ('scope:e05-h3:base','membership:e05-h3','self','node:e05-h3:l4','/node/e05-h3','allow','2026-09-13T00:00:00.000Z',1);

insert into access.decisionaudit(id,actor_id,operation,resource_id,scope_id,decision,reason,policy_version,trace_id,decided_at)
select 'audit:e05:create:'||suffix,'principal:e05','organization.hosted.create',node_id,node_id,'allow',
  'E05_HOSTED_DATA_ONLY','sfl-e05-v1','trace:e05-zero-fanout','2026-09-13T00:00:00.000Z'
from (values('h1','node:e05-h1:l2'),('h2','node:e05-h2:l3'),('h3','node:e05-h3:l4')) item(suffix,node_id);

insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
select 'outbox:e05:create:'||suffix,'HostedNodeCreated',1,'node',node_id,node_id,
  jsonb_build_object('node_id',node_id,'infrastructure_action_count',0),'trace:e05-zero-fanout',
  '2026-09-13T00:00:00.000Z','2026-09-13T00:00:00.000Z'
from (values('h1','node:e05-h1:l2'),('h2','node:e05-h2:l3'),('h3','node:e05-h3:l4')) item(suffix,node_id);

update organization.node set status='suspended',updated_at='2026-09-13T00:01:00.000Z'
where id='node:e05-h2:l3';
insert into access.decisionaudit values(
  'audit:e05:suspend','principal:e05','organization.hosted.suspend','node:e05-h2:l3','node:e05-h2:l3',
  'allow','E05_HOSTED_DATA_ONLY','sfl-e05-v1','trace:e05-zero-fanout','2026-09-13T00:01:00.000Z');
insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
values('outbox:e05:suspend','HostedNodeSuspended',1,'node','node:e05-h2:l3','node:e05-h2:l3',
  '{"node_id":"node:e05-h2:l3","infrastructure_action_count":0}','trace:e05-zero-fanout',
  '2026-09-13T00:01:00.000Z','2026-09-13T00:01:00.000Z');

do $suspended$
begin
  if exists(select 1 from organization.node where id='node:e05-h2:l3' and status='active') then
    raise exception 'SFL_E05_SUSPENDED_NODE_STILL_ACTIVE';
  end if;
end
$suspended$;

update organization.node set status='active',updated_at='2026-09-13T00:02:00.000Z'
where id='node:e05-h2:l3';
insert into access.decisionaudit values(
  'audit:e05:reactivate','principal:e05','organization.hosted.reactivate','node:e05-h2:l3','node:e05-h2:l3',
  'allow','E05_HOSTED_DATA_ONLY','sfl-e05-v1','trace:e05-zero-fanout','2026-09-13T00:02:00.000Z');
insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
values('outbox:e05:reactivate','HostedNodeReactivated',1,'node','node:e05-h2:l3','node:e05-h2:l3',
  '{"node_id":"node:e05-h2:l3","infrastructure_action_count":0}','trace:e05-zero-fanout',
  '2026-09-13T00:02:00.000Z','2026-09-13T00:02:00.000Z');

insert into capability.entitlement(id,scope_id,capability_id,state,effective_at,version)
values('entitlement:e05-h3:extra','node:e05-h3:l4','capability:e05-extra','enabled','2026-09-13T00:03:00.000Z',1);
insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
values('scope:e05-h3:extra','membership:e05-h3','self','node:e05-h3:l4','/node/e05-h3/extra','allow','2026-09-13T00:03:00.000Z',2);
update access.membership set access_version=2 where id='membership:e05-h3';
insert into access.decisionaudit values(
  'audit:e05:grant','principal:e05','organization.hosted.grant','node:e05-h3:l4','node:e05-h3:l4',
  'allow','E05_HOSTED_DATA_ONLY','sfl-e05-v1','trace:e05-zero-fanout','2026-09-13T00:03:00.000Z');
insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
values('outbox:e05:grant','HostedNodeGrantChanged',1,'node','node:e05-h3:l4','node:e05-h3:l4',
  '{"action":"grant","infrastructure_action_count":0}','trace:e05-zero-fanout',
  '2026-09-13T00:03:00.000Z','2026-09-13T00:03:00.000Z');

update capability.entitlement set state='disabled',expires_at='2026-09-13T00:04:00.000Z',version=2
where id='entitlement:e05-h3:extra';
update access.scopegrant set expires_at='2026-09-13T00:04:00.000Z',access_version=3
where id='scope:e05-h3:extra';
update access.membership set access_version=3 where id='membership:e05-h3';
insert into access.decisionaudit values(
  'audit:e05:revoke','principal:e05','organization.hosted.revoke','node:e05-h3:l4','node:e05-h3:l4',
  'allow','E05_HOSTED_DATA_ONLY','sfl-e05-v1','trace:e05-zero-fanout','2026-09-13T00:04:00.000Z');
insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
values('outbox:e05:revoke','HostedNodeGrantChanged',1,'node','node:e05-h3:l4','node:e05-h3:l4',
  '{"action":"revoke","infrastructure_action_count":0}','trace:e05-zero-fanout',
  '2026-09-13T00:04:00.000Z','2026-09-13T00:04:00.000Z');

do $verify$
begin
  if (select count(*) from organization.node where id like 'node:e05-h%' and sovereignty_tier='hosted')<>3
    or (select count(*) from organization.noderelation where node_id like 'node:e05-h%' and superseded_at is null)<>3
    or (select count(*) from access.membership where id like 'membership:e05-h%' and status='active')<>3
    or (select count(*) from access.scopegrant where id like 'scope:e05-h%:base' and expires_at is null)<>3
    or (select count(*) from capability.entitlement where id like 'entitlement:e05-h%:base' and state='enabled')<>3
    or (select count(*) from access.decisionaudit where trace_id='trace:e05-zero-fanout')<>7
    or (select count(*) from runtime.outbox where trace_id='trace:e05-zero-fanout')<>7 then
    raise exception 'SFL_E05_EXPECTED_FACTS_INVALID';
  end if;
  if exists(select 1 from access.scopegrant where id='scope:e05-h3:extra'
      and effect='allow' and (expires_at is null or expires_at>'2026-09-13T00:04:00.000Z'))
    or exists(select 1 from capability.entitlement where id='entitlement:e05-h3:extra' and state='enabled') then
    raise exception 'SFL_E05_REVOKED_ACCESS_REMAINS';
  end if;
  if exists(select 1 from organization.nodemanifestversion where node_id like 'node:e05-h%')
    or exists(select 1 from organization.noderesourcebindingset where node_id like 'node:e05-h%') then
    raise exception 'SFL_E05_HOSTED_INFRASTRUCTURE_FACT_PRESENT';
  end if;
end
$verify$;

select jsonb_build_object(
  'schema','sfl.e05.hosted-before-after.v1',
  'host_sovereign_node','node:zhudatuan:l0',
  'hosted_nodes',jsonb_build_array('node:e05-h1:l2','node:e05-h2:l3','node:e05-h3:l4'),
  'operations',jsonb_build_array('create','suspend','reactivate','grant','revoke'),
  'before',(select to_jsonb(e05_before) from e05_before),
  'after',jsonb_build_object(
    'hosted_nodes',(select count(*) from organization.node where id like 'node:e05-h%'),
    'active_nodes',(select count(*) from organization.node where id like 'node:e05-h%' and status='active'),
    'memberships',(select count(*) from access.membership where id like 'membership:e05-h%'),
    'active_base_scopes',(select count(*) from access.scopegrant where id like 'scope:e05-h%:base' and expires_at is null),
    'base_entitlements',(select count(*) from capability.entitlement where id like 'entitlement:e05-h%:base' and state='enabled'),
    'extra_scope_rows',(select count(*) from access.scopegrant where id='scope:e05-h3:extra'),
    'extra_scope_active',(select count(*) from access.scopegrant where id='scope:e05-h3:extra'
      and (expires_at is null or expires_at>'2026-09-13T00:04:00.000Z')),
    'extra_entitlement_state',(select state from capability.entitlement where id='entitlement:e05-h3:extra'),
    'audit_rows',(select count(*) from access.decisionaudit where trace_id='trace:e05-zero-fanout'),
    'outbox_rows',(select count(*) from runtime.outbox where trace_id='trace:e05-zero-fanout'),
    'manifest_rows',(select count(*) from organization.nodemanifestversion where node_id like 'node:e05-h%'),
    'resource_binding_rows',(select count(*) from organization.noderesourcebindingset where node_id like 'node:e05-h%')
  ),
  'access_checks',jsonb_build_object(
    'suspended_denied',true,
    'reactivated_allowed',(select status='active' from organization.node where id='node:e05-h2:l3'),
    'revoked_extra_scope_denied',not exists(select 1 from access.scopegrant where id='scope:e05-h3:extra'
      and (expires_at is null or expires_at>'2026-09-13T00:04:00.000Z'))
  )
)::text;

rollback;
