begin;

do $block$ declare target text; begin
  foreach target in array array['identity','organization','access','capability','partner','member','qualification','catalog','pricing','inventory','experience','marketing','cart','checkout','ordering','fulfillment','verification','payment','voucher','benefit','finance','invoice','channel','support','notification','reporting','risk','audit','extension','runtime'] loop
    execute format('revoke all on schema %I from public,anon,authenticated,service_role',target);
    execute format('revoke all privileges on all tables in schema %I from public,anon,authenticated,service_role',target);
    execute format('revoke all privileges on all sequences in schema %I from public,anon,authenticated,service_role',target);
    execute format('revoke execute on all functions in schema %I from public,anon,authenticated,service_role',target);
  end loop;
end $block$;

revoke all on schema public from public,anon,authenticated,service_role;
revoke execute on all functions in schema public from public,anon,authenticated,service_role;
revoke all privileges on all tables in schema public from public,anon,authenticated,service_role;

alter default privileges revoke execute on functions from public;
alter default privileges revoke all on tables from public;
alter default privileges revoke all on sequences from public;

create or replace function access.scope_allowed(p_scope text)
returns boolean language sql stable security definer set search_path=access,organization,pg_temp as $function$
  select p_scope is not null and (
    p_scope=nullif(current_setting('app.scope_id',true),'') or
    exists(select 1 from organization.unitclosure closure
      where closure.ancestor_id=nullif(current_setting('app.scope_id',true),'') and closure.descendant_id=p_scope)
  )
$function$;
revoke all on function access.scope_allowed(text) from public;

grant usage on schema identity,organization,access,capability,partner,member,qualification,catalog,pricing,inventory,experience,marketing,
  cart,checkout,ordering,fulfillment,verification,payment,voucher,benefit,finance,invoice,channel,support,notification,reporting,risk,audit,extension,runtime
  to shopapp,shopjob;
grant select,insert,update,delete on all tables in schema identity,organization,access,capability,partner,member,qualification,catalog,pricing,inventory,
  experience,marketing,cart,checkout,ordering,fulfillment,verification,payment,voucher,benefit,finance,invoice,channel,support,notification,reporting,risk,audit,extension,runtime
  to shopapp,shopjob;
grant usage,select on all sequences in schema identity,organization,access,capability,partner,member,qualification,catalog,pricing,inventory,
  experience,marketing,cart,checkout,ordering,fulfillment,verification,payment,voucher,benefit,finance,invoice,channel,support,notification,reporting,risk,audit,extension,runtime
  to shopapp,shopjob;
grant execute on function access.scope_allowed(text) to shopapp;

do $policies$ declare target record; predicate text; begin
  for target in
    select table_schema,table_name,
      exists(select 1 from information_schema.columns columninfo where columninfo.table_schema=tables.table_schema and columninfo.table_name=tables.table_name and columninfo.column_name='scope_id') has_scope,
      exists(select 1 from information_schema.columns columninfo where columninfo.table_schema=tables.table_schema and columninfo.table_name=tables.table_name and columninfo.column_name='tenant_id') has_tenant
    from information_schema.tables tables where tables.table_type='BASE TABLE' and tables.table_schema=any(array[
      'identity','organization','access','capability','partner','member','qualification','catalog','pricing','inventory','experience','marketing','cart','checkout','ordering',
      'fulfillment','verification','payment','voucher','benefit','finance','invoice','channel','support','notification','reporting','risk','audit','extension','runtime'])
  loop
    predicate := case when target.table_schema='runtime' then 'current_setting(''app.workload'',true)=''api'''
      when target.has_scope then 'access.scope_allowed(scope_id)'
      when target.has_tenant then 'tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')'
      else 'current_setting(''app.workload'',true)=''api''' end;
    execute format('create policy appscope on %I.%I for all to shopapp using (%s) with check (%s)',target.table_schema,target.table_name,predicate,predicate);
    execute format('create policy jobscope on %I.%I for all to shopjob using (true) with check (true)',target.table_schema,target.table_name);
  end loop;
end $policies$;

grant usage on schema identity,access,capability,organization,member,runtime to shopapp;
grant execute on function identity.resolve_session(text),access.resolve_membership(text),access.membership_version(text),access.resolve_scope(text,text,text),access.resource_scope(text,text,text),access.scope_object(text),capability.membership_operations(text) to shopapp;

grant usage on schema extension,channel,catalog,inventory,ordering,fulfillment,runtime to shopapp,shopjob;
grant execute on function extension.enabled_installations(),extension.runnable_installations(),channel.private_enabled(text),channel.pull_private_catalog(text,text),channel.pull_private_stock(text,jsonb),channel.submit_private_order(text,text,text,jsonb),channel.cancel_private_order(text,text,text,text),channel.pull_private_tracking(text,text),channel.submit_private_refund(text,text,jsonb),channel.build_private_statement(text,jsonb) to shopapp,shopjob;

grant usage on schema runtime to shopjob;
grant select,insert,update,delete on runtime.outbox,runtime.inbox,runtime.deadletter,runtime.lease,runtime.job,runtime.projectionoffset to shopjob;
grant execute on function runtime.claim_job(text,text,integer,integer),runtime.accept_inbox(text,text,text,integer,text,jsonb),runtime.acquire_lease(text,text,integer),runtime.release_lease(text,text,text),runtime.accept_provider_webhook(text,text,text,jsonb,text,text,text,integer,jsonb) to shopjob;
grant execute on function runtime.accept_provider_webhook(text,text,text,jsonb,text,text,text,integer,jsonb) to shopapp;

grant usage on schema reporting to shopread;
grant select on reporting.metric,reporting.fact to shopread;
create policy readmetric on reporting.metric for select to shopread using(true);
create policy readfact on reporting.fact for select to shopread using(true);

do $roles$ declare role_row record; begin
  for role_row in select rolname,rolbypassrls from pg_roles where rolname in('shopapp','shopjob','shopread') loop
    if role_row.rolbypassrls then raise exception 'APPLICATION_ROLE_BYPASSES_RLS:%',role_row.rolname; end if;
  end loop;
end $roles$;

commit;
